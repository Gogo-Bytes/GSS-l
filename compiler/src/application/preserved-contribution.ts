import selectorParser from 'postcss-selector-parser';
import type { CompatibilityTransformer } from './compatibility-transformer.js';
import type { ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { GssDiagnostic, ReplaceStylesheetInput, StyleModuleArtifact } from '../public-types.js';
import type { PlanningStylesheet } from './css-parser-port.js';
import type { NameAllocatorPort } from './name-allocator.js';
import type { ModuleContribution } from './module-contribution.js';
import { bindCssAssets } from './asset-values.js';
import { collectAssetDependencies } from './stylesheet-assets.js';
import { indentCss, type PlannedResource } from './resource-planning.js';
import { ensureScopePath, toScopeSchema, renderModuleCode, renderDeclarationCode, type MutableScopeNode } from './scope-exports.js';

// The caller chooses fallback and validates compatibility before entering here.
// This path preserves authored rule order and uses scope markers, not atoms.
export function preparePreservedContribution(input: {
  input: ReplaceStylesheetInput;
  moduleId: string;
  parsed: PlanningStylesheet;
  rules: readonly ParsedStyleRule[];
  conditionDiagnostics: readonly GssDiagnostic[];
  fallbackProperties: readonly string[];
  fallbackCompatibilityProperties?: readonly string[];
  nameAllocator: NameAllocatorPort;
  compatibility?: CompatibilityTransformer | undefined;
  resources: readonly PlannedResource[];
}): ModuleContribution {
  const roots = new Map<string, MutableScopeNode>();
  for (const rule of input.rules) {
    for (let index = 0; index < rule.path.length; index += 1) {
      const path = rule.path.slice(0, index + 1);
      ensureScopePath(roots, path).classNames.add(input.nameAllocator.createScopeMarker(input.moduleId, path));
    }
    for (const observation of rule.observations.flat()) {
      if (!observation.observedClass) continue;
      const path = [observation.observedClass];
      ensureScopePath(roots, path).classNames.add(input.nameAllocator.createScopeMarker(input.moduleId, path));
    }
  }

  const exports = Object.fromEntries(
    [...roots.entries()].map(([name, scope]) => [name, toScopeSchema(scope)])
  );
  const bindings = new Map((input.input.assetReferences ?? []).map(({ url, identity }) => [url, identity]));
  const preservedBlocks = [...input.rules]
    .sort((left, right) => left.sourceOrdinal - right.sourceOrdinal)
    .map((rule) => {
      const { css, declarationOffsets } = renderPreservedRule(rule, input.moduleId, input.nameAllocator, input.compatibility);
      return { moduleId: input.moduleId, source: rule.source, declarationOffsets, css,
        ...bindCssAssets(css, bindings) };
    });
  const fallbackReasons = [
    ...input.fallbackProperties.map((property) => ({ property, reason: 'property-effect-not-registered' as const })),
    ...(input.fallbackCompatibilityProperties ?? []).map((property) =>
      ({ property, reason: 'compatibility-sequence-unatomizable' as const }))
  ];
  const scopeSchema = { moduleId: input.moduleId, exports };
  const artifact: StyleModuleArtifact = {
    id: input.input.id,
    scopeSchema,
    moduleCode: renderModuleCode(exports),
    declarationCode: renderDeclarationCode(exports),
    dependencies: collectAssetDependencies(input.parsed),
    compilationMode: 'preserved',
    fallbackReasons
  };
  return {
    artifact,
    rules: [],
    preservedBlocks,
    resources: input.resources,
    diagnostics: [
      ...input.conditionDiagnostics,
      {
        code: 'GSS1104',
        severity: 'warning',
        phase: 'plan',
        message: input.fallbackCompatibilityProperties?.length
          ? `Module was preserved because compatibility sequences cannot be atomized: ${input.fallbackCompatibilityProperties.join(', ')}.`
          : `Module was preserved because property effects are not registered: ${input.fallbackProperties.join(', ')}.`,
        id: input.input.id,
        reason: 'module-preserved-fallback',
        suggestion: 'Verify the property name or register its complete effect family.'
      }
    ],
    sourceText: input.input.source
  };
}

function renderPreservedRule(
  rule: ParsedStyleRule,
  moduleId: string,
  nameAllocator: NameAllocatorPort,
  compatibility?: CompatibilityTransformer
): { css: string; declarationOffsets: readonly number[] } {
  const selector = selectorParser((root) => {
    for (const branch of root.nodes) {
      let pathIndex = 0;
      for (const node of branch.nodes) {
        if (node.type === 'class') {
          pathIndex += 1;
          node.value = nameAllocator.createScopeMarker(moduleId, rule.path.slice(0, pathIndex));
          continue;
        }
        if (node.type !== 'pseudo' || node.value !== ':has') continue;
        node.walkClasses((observed) => {
          observed.value = nameAllocator.createScopeMarker(moduleId, [observed.value]);
        });
      }
    }
  }).processSync(rule.selector);
  const physical = rule.declarations.flatMap((declaration) =>
    (compatibility ? compatibility.expand(declaration)! : [declaration])
      .map((entry) => ({ entry, offset: declaration.source.start }))
  );
  const declarations = physical.map(({ entry: { property, value, important } }) =>
    `  ${property}: ${value}${important ? ' !important' : ''};`).join('\n');
  let css = `${selector} {\n${declarations}\n}`;
  for (const condition of [...rule.conditions].reverse()) {
    css = `@${condition.kind} ${condition.query} {\n${indentCss(css)}\n}`;
  }
  if (rule.layer !== 'unlayered') {
    css = `@layer ${rule.layer} {\n${indentCss(css)}\n}`;
  }
  return { css, declarationOffsets: physical.map(({ offset }) => offset) };
}

