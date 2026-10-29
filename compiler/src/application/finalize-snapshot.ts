import { compareCodeUnits } from '../domain/compare-code-units.js';
import { compareRuleOrder } from '../domain/rule-order-planner.js';
import type { FinalizedGssSnapshot, FinalizeGssOptions, GssCompilerConfig } from '../public-types.js';
import { renderAssetValue, type AssetUrlResolver } from './asset-values.js';
import { renderCssWithSourceMap, type CssMapBlock } from './css-source-map.js';
import type { ModuleContribution } from './module-contribution.js';
import type { PlannedDeclaration } from './atomic-emission.js';
import type { PlannedResource } from './resource-planning.js';

export function finalizeSnapshot(
  modules: ReadonlyMap<string, ModuleContribution>,
  generation: number,
  config: GssCompilerConfig,
  options?: FinalizeGssOptions
): FinalizedGssSnapshot {
  const urls = new Map<string, string>();
  const resolve: AssetUrlResolver = (identity) => {
    if (urls.has(identity)) return urls.get(identity)!;
    const url = options?.resolveAssetUrl?.(identity);
    if (typeof url !== 'string' || url.length === 0) throw new Error(`Missing output URL for GSS Asset ${identity}.`);
    urls.set(identity, url);
    return url;
  };
  const sourceTexts = new Map([...modules.values()].map(({ artifact, sourceText }) =>
    [artifact.scopeSchema.moduleId, sourceText] as const));
  type Origin = { moduleId: string; offset: number; end: number;
    descriptorOffsets?: ReadonlyMap<string, number>;
    frameOffsets?: NonNullable<PlannedResource['frameOffsets']> };
  const uniqueResources = new Map<string, {
    resource: PlannedResource;
    sources: Set<string>;
    origins: Origin[];
  }>();
  for (const contribution of modules.values()) {
    for (const resource of contribution.resources) {
      const registered = uniqueResources.get(resource.identity) ?? {
        resource,
        sources: new Set<string>(),
        origins: []
      };
      registered.sources.add(contribution.artifact.scopeSchema.moduleId);
      registered.origins.push({ moduleId: contribution.artifact.scopeSchema.moduleId,
        offset: resource.source.start, end: resource.source.end,
        ...(resource.descriptorOffsets ? { descriptorOffsets: resource.descriptorOffsets } : {}),
        ...(resource.frameOffsets ? { frameOffsets: resource.frameOffsets } : {}) });
      uniqueResources.set(resource.identity, registered);
    }
  }
  const orderedResources = [...uniqueResources.values()]
    .sort((left, right) => compareCodeUnits(left.resource.identity, right.resource.identity));
  const uniqueRules = new Map<string, {
    rule: PlannedDeclaration;
    sources: Set<string>;
    origins: Origin[];
  }>();
  for (const contribution of modules.values()) {
    for (const rule of contribution.rules) {
      const identity = serializeIdentity(rule.identity);
      // Observed declaration identity captures the relation and value, but different authored
      // selector-list maxima can give that same branch distinct emitted selector specificity.
      const key = 'subjectPath' in rule.identity
        ? JSON.stringify([identity, rule.selector])
        : identity;
      const registered = uniqueRules.get(key) ?? { rule, sources: new Set<string>(), origins: [] };
      registered.sources.add(contribution.artifact.scopeSchema.moduleId);
      registered.origins.push({ moduleId: contribution.artifact.scopeSchema.moduleId,
        offset: rule.source.start, end: rule.source.end });
      uniqueRules.set(key, registered);
    }
  }

  const orderedRules = [...uniqueRules.values()].sort((left, right) =>
    compareRuleOrder(left.rule, right.rule, config)
  );
  const orderedPreservedBlocks = [...modules.values()]
    .flatMap(({ preservedBlocks }) => preservedBlocks)
    .sort((left, right) => compareCodeUnits(left.moduleId, right.moduleId));
  const layerPrelude = config.layers?.length
    ? `@layer ${config.layers.join(', ')};`
    : '';
  const compareOrigins = (a: Origin, b: Origin) =>
    compareCodeUnits(a.moduleId, b.moduleId) || a.offset - b.offset || a.end - b.end;
  const primary = (origins: readonly Origin[]) => [...origins].sort(compareOrigins)[0]!;
  const manifestOrigins = (origins: readonly Origin[]) => [...new Map(
    [...origins].sort(compareOrigins).map(({ moduleId, offset, end }) =>
      [JSON.stringify([moduleId, offset, end]), { moduleId, range: { start: offset, end } }] as const)
  ).values()];
  const sections: CssMapBlock[][] = [
    layerPrelude ? [{ css: layerPrelude }] : [],
    orderedResources.map(({ resource, origins }) => ({
      css: resource.renderCss?.(resolve) ?? resource.css, origin: primary(origins)
    })),
    orderedPreservedBlocks.map(({ css, renderCss, moduleId, source, declarationOffsets }) => ({
      css: renderCss?.(resolve) ?? css, origin: { moduleId, offset: source.start, declarationOffsets }
    })),
    orderedRules.map(({ rule, origins }) => ({
      css: renderRule(rule, resolve), origin: primary(origins), declarationPositions: true
    }))
  ];
  const rendered = renderCssWithSourceMap(sections, sourceTexts);
  return {
    generation,
    css: rendered.css,
    sourceMap: rendered.sourceMap,
    manifest: {
      modules: [...modules.values()].map(({ artifact }) => artifact.scopeSchema.moduleId).sort(),
      moduleDetails: [...modules.values()]
        .map(({ artifact }) => ({
          id: artifact.scopeSchema.moduleId,
          compilationMode: artifact.compilationMode,
          fallbackReasons: artifact.fallbackReasons
        }))
        .sort((left, right) => compareCodeUnits(left.id, right.id)),
      resources: orderedResources.map(({ resource, sources, origins }) => ({
        kind: resource.kind,
        name: resource.name,
        sources: [...sources].sort(),
        origins: manifestOrigins(origins)
      })),
      preservedRules: orderedPreservedBlocks.map(({ moduleId, source }) => ({
        moduleId, range: { start: source.start, end: source.end }
      })),
      rules: orderedRules.map(({ rule: { kind, className, selector, identity }, sources, origins }) => ({
        kind,
        className,
        selector,
        property: identity.property,
        value: renderAssetValue(identity, resolve),
        important: identity.important,
        sources: [...sources].sort(),
        origins: manifestOrigins(origins)
      }))
    },
    report: {
      modules: modules.size,
      rules: orderedRules.length,
      resources: orderedResources.length,
      atomicModules: [...modules.values()].filter(({ artifact }) =>
        artifact.compilationMode === 'atomic'
      ).length,
      preservedModules: [...modules.values()].filter(({ artifact }) => artifact.compilationMode === 'preserved').length,
      atomicCoverage: modules.size === 0
        ? 1
        : [...modules.values()].filter(({ artifact }) =>
            artifact.compilationMode === 'atomic'
          ).length / modules.size
    }
  };
}


function renderRule(rule: PlannedDeclaration, resolve: AssetUrlResolver): string {
  const { property, important } = rule.identity;
  const value = renderAssetValue(rule.identity, resolve);
  const declarations = rule.physicalDeclarations ?? [{ property, value, important }];
  let css = `${rule.selector} {\n${declarations.map((declaration) =>
    `  ${declaration.property}: ${renderAssetValue(declaration, resolve)}${declaration.important ? ' !important' : ''};`).join('\n')}\n}`;
  for (const wrapper of [...(rule.wrappers ?? [])].reverse()) {
    css = `@${wrapper.kind} ${wrapper.query} {\n${indentCss(css)}\n}`;
  }
  if (rule.layer && rule.layer !== 'unlayered') {
    css = `@layer ${rule.layer} {\n${indentCss(css)}\n}`;
  }
  return css;
}


function indentCss(css: string): string {
  return css.split('\n').map((line) => `  ${line}`).join('\n');
}

function serializeIdentity(identity: PlannedDeclaration['identity']): string {
  // Equal property-local ranks can occupy different output slots in different
  // modules. Keep the slot in identity as well as order; merging loses precedence.
  if (identity.assetValue) {
    const plain = { ...identity };
    delete plain.assetValue;
    return JSON.stringify(['asset-identity', serializeIdentity(plain)]);
  }
  if ('subjectPath' in identity) {
    return JSON.stringify([
      'observed',
      identity.moduleId,
      identity.layer,
      identity.condition,
      identity.subjectPath,
      identity.relation,
      identity.observedClass,
      identity.observedState,
      identity.observedResidual,
      identity.property,
      identity.value,
      identity.important,
      ...(identity.atomRank === undefined ? [] : [identity.atomRank]),
      ...(identity.orderSlot === undefined ? [] : ['order', identity.orderSlot])
    ]);
  }
  if ('relations' in identity) {
    return JSON.stringify([
      'contextual',
      identity.moduleId,
      identity.layer,
      identity.condition,
      identity.relations,
      identity.sourceState,
      identity.sourceAttribute,
      identity.sourcePath,
      identity.targetPath,
      identity.authoredPath,
      identity.property,
      identity.value,
      identity.important,
      ...(identity.atomRank === undefined ? [] : [identity.atomRank]),
      ...(identity.orderSlot === undefined ? [] : ['order', identity.orderSlot])
    ]);
  }
  return JSON.stringify([
    'pure',
    identity.layer,
    identity.condition,
    identity.state,
    identity.pseudoElement,
    identity.ownership,
    identity.property,
    identity.value,
    identity.important,
    ...(identity.atomRank === undefined ? [] : [identity.atomRank]),
    ...(identity.orderSlot === undefined ? [] : ['order', identity.orderSlot])
  ]);
}
