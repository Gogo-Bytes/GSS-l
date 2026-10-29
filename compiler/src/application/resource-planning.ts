import postcss from 'postcss';
import valueParser from 'postcss-value-parser';
import type { CompatibilityTransformer } from './compatibility-transformer.js';
import type { ParsedDeclaration, ParsedFontFaceResource, ParsedGlobalResource, ParsedKeyframesRegistration, ParsedPropertyRegistration, ParsedStyleRule, SourceSpan } from '../domain/parsed-stylesheet.js';
import { bindCssAssets, type AssetBindings, type AssetUrlResolver } from './asset-values.js';
import { assetOccurrences } from './stylesheet-assets.js';
import type { NameAllocatorPort } from './name-allocator.js';

// Resource planning preserves authored origins and asset identity; the session
// still checks conflicts before committing a contribution.
export type PlannedResource = {
  kind: 'property' | 'keyframes' | 'font-face';
  name: string;
  conflictKey?: string;
  identity: string;
  css: string;
  renderCss?: (resolve: AssetUrlResolver) => string;
  source: SourceSpan;
  descriptorOffsets?: ReadonlyMap<string, number>;
  frameOffsets?: ReadonlyMap<string, { offset: number; descriptorOffsets: ReadonlyMap<string, number> }>;
};

// CSS animation shorthand consumes component keywords before a possible animation-name;
// Level 2 also admits dashed timeline identifiers. We do not parse that grammar for
// the MVP: reject local-name collisions rather than changing a native component
// token into a generated keyframe name.
const animationComponentKeywords = new Set([
  'ease', 'linear', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end',
  'auto', 'infinite', 'normal', 'reverse', 'alternate', 'alternate-reverse',
  'none', 'forwards', 'backwards', 'both', 'running', 'paused'
]);

export function findAmbiguousKeyframeInShorthand(
  rules: readonly ParsedStyleRule[],
  keyframeNames: ReadonlyMap<string, string>
): ParsedDeclaration | undefined {
  for (const rule of rules) for (const declaration of rule.declarations) {
    if (declaration.property !== 'animation') continue;
    const collision = valueParser(declaration.value).nodes.some((node) =>
      node.type === 'word' && keyframeNames.has(node.value) &&
      (animationComponentKeywords.has(node.value.toLowerCase()) || node.value.startsWith('--')));
    if (collision) return declaration;
  }
  return undefined;
}

export function rewriteKeyframeReferences(
  rules: readonly ParsedStyleRule[],
  keyframeNames: ReadonlyMap<string, string>
): readonly ParsedStyleRule[] {
  return rules.map((rule) => ({
    ...rule,
    declarations: rule.declarations.map((declaration) => {
      if (declaration.property !== 'animation-name' && declaration.property !== 'animation') {
        return declaration;
      }
      const parsedValue = valueParser(declaration.value);
      for (const node of parsedValue.nodes) {
        if (node.type !== 'word') continue;
        const generatedName = keyframeNames.get(node.value);
        if (generatedName) node.value = generatedName;
      }
      return { ...declaration, value: parsedValue.toString() };
    })
  }));
}

export function planResource(
  resource: ParsedGlobalResource,
  moduleId: string,
  bindings: AssetBindings,
  nameAllocator: NameAllocatorPort,
  compatibility?: CompatibilityTransformer
): PlannedResource | undefined {
  const base = resource.kind === 'property' ? planPropertyRegistration(resource)
    : resource.kind === 'keyframes' ? planKeyframesRegistration(resource, moduleId, nameAllocator)
    : planFontFaceResource(resource);
  const physical = compatibility?.expandResource(base.css, resource.kind);
  if (compatibility && (!physical || !resourceAssetsPreserved(base.css, physical))) return undefined;
  const planned = { ...base, ...(physical ? { css: physical } : {}), source: resource.source };
  const assets = bindCssAssets(planned.css, bindings);
  const descriptorOffsets = resource.kind === 'keyframes' ? undefined : new Map(
    resource.declarations.filter((declaration) => resource.declarations.filter((other) =>
      other.property === declaration.property).length === 1).map((declaration) =>
      [declaration.property, declaration.source.start] as const)
  );
  const frameOffsets = resource.kind !== 'keyframes' ? undefined : new Map(
    resource.frames.filter((frame) => resource.frames.filter((other) =>
      other.selector === frame.selector).length === 1).map((frame) => [frame.selector, {
      offset: frame.source.start,
      descriptorOffsets: new Map(frame.declarations.filter((declaration) => frame.declarations.filter((other) =>
        other.property === declaration.property).length === 1).map((declaration) =>
        [declaration.property, declaration.source.start] as const))
    }] as const)
  );
  const sourced = { ...planned, ...(descriptorOffsets ? { descriptorOffsets } : {}),
    ...(frameOffsets ? { frameOffsets } : {}) };
  return assets.assetIdentity && assets.renderCss
    ? { ...sourced, identity: assets.assetIdentity, renderCss: assets.renderCss }
    : sourced;
}

function planPropertyRegistration(resource: ParsedPropertyRegistration): Omit<PlannedResource, 'source'> {
  const declarations = resource.declarations
    .map(({ property, value }) => `  ${property}: ${value};`)
    .join('\n');
  return {
    kind: resource.kind,
    name: resource.name,
    conflictKey: `property:${resource.name}`,
    identity: JSON.stringify([
      resource.kind,
      resource.name,
      resource.declarations.map(({ property, value }) => [property, value])
    ]),
    css: `@property ${resource.name} {\n${declarations}\n}`
  };
}

function planFontFaceResource(resource: ParsedFontFaceResource): Omit<PlannedResource, 'source'> {
  const descriptor = (name: string, fallback: string): string =>
    resource.declarations.find(({ property }) => property === name)?.value ?? fallback;
  const signature = [
    descriptor('font-family', ''),
    descriptor('font-style', 'normal'),
    descriptor('font-weight', 'normal'),
    descriptor('font-stretch', 'normal'),
    descriptor('unicode-range', 'all')
  ].join('|');
  const declarations = resource.declarations
    .map(({ property, value }) => `  ${property}: ${value};`)
    .join('\n');
  return {
    kind: resource.kind,
    name: signature,
    conflictKey: `font-face:${signature}`,
    identity: JSON.stringify([
      resource.kind,
      resource.declarations.map(({ property, value }) => [property, value])
    ]),
    css: `@font-face {\n${declarations}\n}`
  };
}

function planKeyframesRegistration(
  resource: ParsedKeyframesRegistration,
  moduleId: string,
  nameAllocator: NameAllocatorPort
): Omit<PlannedResource, 'source'> {
  const generatedName = nameAllocator.createKeyframesName(moduleId, resource.name);
  const frames = resource.frames.map((frame) => {
    const declarations = frame.declarations
      .map(({ property, value }) => `    ${property}: ${value};`)
      .join('\n');
    return `  ${frame.selector} {\n${declarations}\n  }`;
  }).join('\n');
  let css = `@keyframes ${generatedName} {\n${frames}\n}`;
  for (const condition of [...resource.conditions].reverse()) {
    css = `@${condition.kind} ${condition.query} {\n${indentCss(css)}\n}`;
  }
  if (resource.layer !== 'unlayered') {
    css = `@layer ${resource.layer} {\n${indentCss(css)}\n}`;
  }
  return {
    kind: resource.kind,
    name: generatedName,
    identity: JSON.stringify([
      resource.kind,
      moduleId,
      resource.name,
      resource.layer,
      resource.conditions,
      resource.frames.map(({ selector, declarations }) => ({
        selector,
        declarations: declarations.map(({ property, value, important }) => ({ property, value, important }))
      }))
    ]),
    css
  };
}

function resourceAssetsPreserved(authored: string, physical: string): boolean {
  const urls = (css: string) => {
    const found = new Set<string>();
    postcss.parse(css).walkDecls((declaration) => {
      for (const { url } of assetOccurrences(declaration.value)) found.add(url);
    });
    return found;
  };
  const original = urls(authored);
  const transformed = urls(physical);
  return original.size === transformed.size && [...original].every((url) => transformed.has(url));
}

export function indentCss(css: string): string {
  return css.split('\n').map((line) => `  ${line}`).join('\n');
}

export function findConflictingResource(
  modules: ReadonlyMap<string, { readonly resources: readonly PlannedResource[] }>,
  replacingId: string,
  incoming: readonly PlannedResource[]
): string | undefined {
  const incomingByName = new Map<string, string>();
  for (const resource of incoming) {
    if (!resource.conflictKey) continue;
    const previous = incomingByName.get(resource.conflictKey);
    if (previous && previous !== resource.identity) return resource.name;
    incomingByName.set(resource.conflictKey, resource.identity);
    for (const [moduleId, contribution] of modules) {
      if (moduleId === replacingId) continue;
      const conflict = contribution.resources.find((registered) =>
        registered.conflictKey === resource.conflictKey &&
        registered.identity !== resource.identity
      );
      if (conflict) return resource.name;
    }
  }
  return undefined;
}
