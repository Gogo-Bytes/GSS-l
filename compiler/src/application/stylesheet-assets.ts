import valueParser from 'postcss-value-parser';
import type { CssParserPort, ParsedStylesheet } from './css-parser-port.js';
import type { GssDiagnostic, ReplaceStylesheetInput } from '../public-types.js';

export function discoverAssets(input: Pick<ReplaceStylesheetInput, 'id' | 'source'>, cssParser: CssParserPort): {
  urls: readonly string[];
  diagnostics: readonly GssDiagnostic[];
} {
  const parsed = cssParser.parseStylesheet(input.id, input.source);
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
  function record(node: valueParser.Node, raw: string) {
    const url = raw.replace(/\\(?:([\da-f]{1,6})(?:\r\n|[\t\n\f\r ])?|\r\n|[\n\r\f]|([\s\S]))/gi,
      (_match, hex: string | undefined, escaped: string | undefined) => {
        if (!hex) return escaped ?? '';
        const code = Number.parseInt(hex, 16);
        return String.fromCodePoint(code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? 0xfffd : code);
      });
    if (url) occurrences.push({ url, start: node.sourceIndex, end: node.sourceEndIndex });
  }

  function visit(nodes: readonly valueParser.Node[], inImageSet = false) {
    let candidateStart = inImageSet;
    for (const node of nodes) {
      if (node.type === 'space' || node.type === 'comment') continue;
      if (candidateStart && node.type === 'string') record(node, node.value);
      candidateStart = inImageSet && node.type === 'div' && node.value === ',';
      if (node.type !== 'function') continue;
      const name = node.value.toLowerCase();
      if (name === 'url') {
        const raw = valueParser.stringify(node.nodes).trim().replace(/^(['"])([\s\S]*)\1$/, '$2');
        record(node, raw);
      } else {
        visit(node.nodes, name === 'image-set');
      }
    }
  }

  visit(valueParser(value).nodes);
  return occurrences;
}
