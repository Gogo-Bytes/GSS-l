import postcss from 'postcss';
import { GenMapping, addSegment, toEncodedMap } from '@jridgewell/gen-mapping';
import type { SourceMapArtifact } from './source-adapter.js';

export type CssMapBlock = {
  css: string;
  /** One deterministic primary origin; other owners remain in the manifest. */
  origin?: { moduleId: string; offset: number };
  /** Physical alternatives of an atom all point to its authored declaration. */
  declarationPositions?: boolean;
};

export function renderCssWithSourceMap(
  sections: readonly (readonly CssMapBlock[])[],
  sourceTexts: ReadonlyMap<string, string>
): { css: string; sourceMap: SourceMapArtifact & { version: 3 } } {
  const map = new GenMapping();
  const parts: string[] = [];
  let line = 0;
  for (const block of sections.flat()) {
    if (parts.length) { parts.push('\n\n'); line += 2; }
    parts.push(block.css);
    if (block.origin) {
      const source = sourceTexts.get(block.origin.moduleId);
      if (source === undefined) throw new Error(`Missing committed GSS source for ${block.origin.moduleId}.`);
      const before = source.slice(0, block.origin.offset).split(/\r\n|\r|\n/);
      const originalLine = before.length - 1;
      const originalColumn = before.at(-1)!.length;
      addSegment(map, line, 0, block.origin.moduleId, originalLine, originalColumn, undefined, source);
      if (block.declarationPositions) {
        postcss.parse(block.css).walkDecls((declaration) => {
          const start = declaration.source?.start;
          if (start) addSegment(map, line + start.line - 1, start.column - 1,
            block.origin!.moduleId, originalLine, originalColumn, undefined, source);
        });
      }
    } else {
      addSegment(map, line, 0);
    }
    line += block.css.split('\n').length - 1;
  }
  const encoded = toEncodedMap(map);
  return { css: parts.join(''), sourceMap: {
    version: 3, names: [...encoded.names], sources: encoded.sources.map((source) => {
      if (source === null) throw new Error('GSS source map contains an unmapped source entry.');
      return source;
    }),
    mappings: encoded.mappings,
    ...(encoded.sourcesContent ? { sourcesContent: [...encoded.sourcesContent] } : {})
  } };
}
