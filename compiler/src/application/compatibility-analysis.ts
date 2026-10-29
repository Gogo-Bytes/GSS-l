import type { ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { CompatibilityTransformer, PhysicalDeclaration } from '../infrastructure/lightning-compatibility-transformer.js';
import { identifyAssetValue, type AssetBindings } from './asset-values.js';
import { assetOccurrences } from './stylesheet-assets.js';

/** Analyze physical declarations without deciding the module's fallback. Shape
 * and asset loss precede importance checks; the caller retains diagnostic and
 * logical/physical conflict precedence. */
export function analyzeCompatibility(
  rules: readonly ParsedStyleRule[], bindings: AssetBindings, compatibility?: CompatibilityTransformer
) {
  const physicalDeclarations = rules.flatMap((rule) => rule.declarations.map((declaration) => ({
    declaration, physical: compatibility?.expand(declaration)
  })));
  if (compatibility && physicalDeclarations.some(({ declaration, physical }) =>
    physical === undefined || !physicalAssetsPreserved(declaration.value, physical))) return { error: 'shape' as const };
  if (compatibility && physicalDeclarations.some(({ declaration, physical }) =>
    physical?.some((entry) => entry.important !== declaration.important))) return { error: 'importance' as const };
  const physicalByDeclaration = new Map(physicalDeclarations.filter(({ physical }) => physical !== undefined)
    .map(({ declaration, physical }) => {
      const identified = identifyAssetValue(declaration.value, bindings);
      return [JSON.stringify([declaration.property, identified.value, identified.assetValue === true, declaration.important]),
        physical!.map((entry) => ({ ...entry, ...identifyAssetValue(entry.value, bindings) }))] as const;
    }));
  const compatibilityFallback = [...new Set(physicalDeclarations.filter(({ declaration, physical }) =>
    physical?.some((entry) => entry.property !== declaration.property))
    .map(({ declaration }) => declaration.property))].sort();
  return { physicalByDeclaration, compatibilityFallback };
}

function physicalAssetsPreserved(authored: string, physical: readonly PhysicalDeclaration[]): boolean {
  const original = new Set(assetOccurrences(authored).map(({ url }) => url));
  const transformed = new Set(physical.flatMap(({ value }) => assetOccurrences(value).map(({ url }) => url)));
  return original.size === transformed.size && [...original].every((url) => transformed.has(url));
}
