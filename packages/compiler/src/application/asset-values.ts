import postcss, { type AnyNode } from 'postcss';
import { assetOccurrences } from './stylesheet-assets.js';

export type AssetBindings = ReadonlyMap<string, string>;
export type AssetUrlResolver = (identity: string) => string;
type ValuePart = string | { asset: string };

/** Typed parts distinguish an asset identity from authored text that happens to look like one. */
export function identifyAssetValue(value: string, bindings: AssetBindings): { value: string; assetValue?: true } {
  if (bindings.size === 0) return { value };
  const parts: ValuePart[] = [];
  let offset = 0;
  for (const occurrence of assetOccurrences(value)) {
    const identity = bindings.get(occurrence.url);
    if (identity === undefined) continue;
    parts.push(value.slice(offset, occurrence.start), { asset: identity });
    offset = occurrence.end;
  }
  if (parts.length === 0) return { value };
  parts.push(value.slice(offset));
  // Keep opaque identities exact even though the general readable-name encoder normalizes NFC.
  const serialized = JSON.stringify(parts).split('').map((character) => character.charCodeAt(0) <= 127
    ? character : `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`).join('');
  return { value: serialized, assetValue: true };
}

export function renderAssetValue(value: { value: string; assetValue?: true }, resolve: AssetUrlResolver): string {
  if (!value.assetValue) return value.value;
  const parts: ValuePart[] = JSON.parse(value.value);
  return parts.map((part) => typeof part === 'string' ? part : `url("${escapeCssString(resolve(part.asset))}")`).join('');
}

export function bindCssAssets(css: string, bindings: AssetBindings): {
  assetIdentity?: string;
  renderCss?: (resolve: AssetUrlResolver) => string;
} {
  if (bindings.size === 0) return {};
  const root = postcss.parse(css);
  let bound = false;
  function describe(node: AnyNode): unknown {
    if (node.type === 'decl') {
      const value = identifyAssetValue(node.value, bindings);
      bound ||= value.assetValue === true;
      return ['declaration', node.prop, node.important ?? false, value];
    }
    if (node.type === 'comment') return ['comment', node.text];
    const children = node.nodes?.map(describe) ?? [];
    if (node.type === 'atrule') return ['at-rule', node.name, node.params, children];
    if (node.type === 'rule') return ['rule', node.selector, children];
    return [node.type, children];
  }
  const description = describe(root);
  if (!bound) return {};
  return {
    assetIdentity: JSON.stringify(['bound-css', description]),
    renderCss(resolve) {
      const rendered = root.clone();
      rendered.walkDecls((declaration) => {
        declaration.value = renderAssetValue(identifyAssetValue(declaration.value, bindings), resolve);
      });
      return rendered.toString();
    }
  };
}

function escapeCssString(value: string): string {
  return [...value].map((character) => {
    if (character === '\\' || character === '"') return `\\${character}`;
    const code = character.codePointAt(0)!;
    return code <= 31 || code === 127 ? `\\${code.toString(16)} ` : character;
  }).join('');
}
