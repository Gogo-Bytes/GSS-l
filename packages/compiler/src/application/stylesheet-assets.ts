import valueParser from 'postcss-value-parser';
import { parseStylesheet, type ParsedStylesheet } from '../infrastructure/postcss-stylesheet-parser.js';
import type { GssDiagnostic, ReplaceStylesheetInput } from '../public-types.js';

export function discoverStylesheetAssets(input: Pick<ReplaceStylesheetInput, 'id' | 'source'>): {
  urls: readonly string[];
  diagnostics: readonly GssDiagnostic[];
} {
  const parsed = parseStylesheet(input.id, input.source);
  return { urls: collectAssetDependencies(parsed), diagnostics: parsed.diagnostics };
}

export function collectAssetDependencies(parsed: ParsedStylesheet): readonly string[] {
  const values = [
    ...parsed.rules.flatMap((rule) => rule.declarations.map(({ value }) => value)),
    ...parsed.resources.flatMap((resource) => resource.kind === 'keyframes'
      ? resource.frames.flatMap((frame) => frame.declarations.map(({ value }) => value))
      : resource.declarations.map(({ value }) => value))
  ];
  return [...new Set(values.flatMap((value) => assetOccurrences(value).map(({ url }) => url)))];
}

export function assetOccurrences(value: string): { url: string; start: number; end: number }[] {
  const occurrences: { url: string; start: number; end: number }[] = [];
  valueParser(value).walk((node) => {
    if (node.type !== 'function' || node.value.toLowerCase() !== 'url') return;
    const raw = valueParser.stringify(node.nodes).trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
    const url = raw.replace(/\\(?:([\da-f]{1,6})(?:\r\n|[\t\n\f\r ])?|\r\n|[\n\r\f]|([\s\S]))/gi,
      (_match, hex: string | undefined, escaped: string | undefined) => {
        if (!hex) return escaped ?? '';
        const code = Number.parseInt(hex, 16);
        return String.fromCodePoint(code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? 0xfffd : code);
      });
    if (url) occurrences.push({ url, start: node.sourceIndex, end: node.sourceEndIndex });
    return false;
  });
  return occurrences;
}
