import type { ParsedStyleRule, SourceSpan } from '../domain/parsed-stylesheet.js';
import type { PureDeclarationIdentity } from '../domain/readable-name.js';
import { declarationSequence } from '../domain/validate-declarations.js';
import type { CompatibilityTransformer, PhysicalDeclaration } from './compatibility-transformer.js';
import { identifyAssetValue, identifyDeclarationValue, type AssetBindings } from './asset-values.js';
import { assetOccurrences } from './stylesheet-assets.js';

type DeclarationIdentity = Pick<PureDeclarationIdentity, 'property' | 'value' | 'assetValue' | 'fallbackValues' | 'important'>;

function declarationKey({ property, value, assetValue, fallbackValues, important }: DeclarationIdentity): string {
  return JSON.stringify([property, fallbackValues, value, assetValue === true, important]);
}

/** Transform each alternative separately so host optimization cannot discard an earlier fallback. */
export function analyzeCompatibility(
  rules: readonly ParsedStyleRule[], bindings: AssetBindings, compatibility?: CompatibilityTransformer
) {
  const groups = rules.flatMap(rule => rule.declarations.map(declaration => ({ declaration,
    alternatives: declarationSequence(declaration).map(authored => ({ authored,
      physical: compatibility ? compatibility.expand(authored) : [authored] }))
  })));
  if (compatibility && groups.some(({ alternatives }) => alternatives.some(({ authored, physical }) =>
    physical === undefined || !physicalAssetsPreserved(authored.value, physical)))) return { error: 'shape' as const };
  if (compatibility && groups.some(({ alternatives }) => alternatives.some(({ authored, physical }) =>
    physical?.some(entry => entry.important !== authored.important)))) return { error: 'importance' as const };
  const physicalByDeclaration = new Map<string, readonly PhysicalDeclaration[]>();
  const offsets = new Map<SourceSpan, readonly number[]>();
  const compatibilityFallback = new Set<string>();
  for (const { declaration, alternatives } of groups) {
    const physical = alternatives.flatMap(({ physical }) => physical ?? []);
    physicalByDeclaration.set(declarationKey({ ...declaration, ...identifyDeclarationValue(declaration, bindings) }),
      physical.map(entry => ({ ...entry, ...identifyAssetValue(entry.value, bindings) })));
    offsets.set(declaration.source, alternatives.flatMap(({ authored, physical }) =>
      (physical ?? []).map(() => authored.source.start)));
    if (physical.some(entry => entry.property !== declaration.property)) compatibilityFallback.add(declaration.property);
  }
  return {
    getPhysicalDeclarations: (identity: DeclarationIdentity) => physicalByDeclaration.get(declarationKey(identity)),
    getDeclarationOffsets: (source: SourceSpan) => offsets.get(source),
    compatibilityFallback: [...compatibilityFallback].sort()
  };
}

function physicalAssetsPreserved(authored: string, physical: readonly PhysicalDeclaration[]): boolean {
  const original = new Set(assetOccurrences(authored).map(({ url }) => url));
  const transformed = new Set(physical.flatMap(({ value }) => assetOccurrences(value).map(({ url }) => url)));
  return original.size === transformed.size && [...original].every((url) => transformed.has(url));
}
