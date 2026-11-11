import { renderWrappedCss } from './render-wrapped-css.js';
import { getOwnershipPath } from '../domain/ownership-path.js';
import selectorParser from 'postcss-selector-parser';
import type { CompatibilityTransformer } from './compatibility-transformer.js';
import type { ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { GssDiagnostic, ReplaceStylesheetInput, StyleModuleArtifact } from '../public-types.js';
import type { ParsedStylesheet } from './css-parser-port.js';
import type { NameAllocatorPort } from './name-allocator.js';
import type { ModuleContribution } from './module-contribution.js';
import { bindCssAssets } from './asset-values.js';
import { collectAssetDependencies } from './stylesheet-assets.js';
import type { PlannedResource } from './resource-planning.js';
import { ensureScopePath, toScopeSchema, renderModuleCode, renderDeclarationCode, type MutableScopeNode } from './scope-exports.js';

// The caller chooses fallback and validates compatibility before entering here.
// This path preserves authored rule order and uses scope markers, not atoms.
export function preparePreservedContribution(input: {
  input: ReplaceStylesheetInput;
  moduleId: string;
  parsed: ParsedStylesheet;
  rules: readonly ParsedStyleRule[];
  conditionDiagnostics: readonly GssDiagnostic[];
  fallbackProperties: readonly string[];
  fallbackCompatibilityProperties?: readonly string[];
  nameAllocator: NameAllocatorPort;
  compatibility?: CompatibilityTransformer | undefined;
  resources: readonly PlannedResource[];
}): ModuleContribution {
  const roots = new Map<string, MutableScopeNode>();
  const bindings = new Map((input.input.assetReferences ?? []).map(({ url, identity }) => [url, identity]));
  const preservedBlocks = [...input.rules]
    .sort((left, right) => left.sourceOrdinal - right.sourceOrdinal)
    .map((rule) => {
      const { css, declarationOffsets } = renderPreservedRule(rule, input.moduleId, input.nameAllocator, roots, input.compatibility);
      return { moduleId: input.moduleId, source: rule.source, declarationOffsets, css,
        ...bindCssAssets(css, bindings) };
    });
  const exports = Object.fromEntries(
    [...roots.entries()].map(([name, scope]) => [name, toScopeSchema(scope)])
  );
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
  roots: Map<string, MutableScopeNode>,
  compatibility?: CompatibilityTransformer
): { css: string; declarationOffsets: readonly number[] } {
  const authoredPath = getOwnershipPath(rule.nodes);
  const selector = selectorParser((root) => {
    for (const branch of root.nodes) {
      let pathIndex = 0;
      // Admission excludes explicit globals. Only direct classes advance the ownership path.
      branch.walkClasses(node => {
        const path = node.parent === branch ? authoredPath.slice(0, ++pathIndex) : [node.value];
        const marker = nameAllocator.createScopeMarker(moduleId, path);
        ensureScopePath(roots, path).classNames.add(marker);
        node.value = marker;
      });
    }
  }).processSync(rule.selector);
  const physical = rule.declarations.flatMap((declaration) =>
    (compatibility ? compatibility.expand(declaration)! : [declaration])
      .map((entry) => ({ entry, offset: declaration.source.start }))
  );
  const css = renderWrappedCss([
    `${selector} {`,
    ...physical.map(({ entry: { property, value, important } }) =>
      `  ${property}: ${value}${important ? ' !important' : ''};`),
    '}'
  ], rule.conditions, rule.layer);
  return { css, declarationOffsets: physical.map(({ offset }) => offset) };
}

