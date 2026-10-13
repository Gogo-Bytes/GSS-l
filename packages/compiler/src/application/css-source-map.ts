import postcss from 'postcss';
import { GenMapping, addSegment, toEncodedMap } from '@jridgewell/gen-mapping';
import type { SourceMapArtifact } from './source-adapter.js';

export type CssMapBlock = {
  css: string;
  /** One deterministic primary origin; other owners remain in the manifest. */
  origin?: { moduleId: string; offset: number; descriptorOffsets?: ReadonlyMap<string, number>;
    declarationOffsets?: readonly number[];
    frameOffsets?: ReadonlyMap<string, { offset: number; descriptorOffsets: ReadonlyMap<string, number> }> };
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
      const addOrigin = (generatedLine: number, generatedColumn: number, offset: number) => {
        const before = source.slice(0, offset).split(/\r\n|\r|\n/);
        addSegment(map, generatedLine, generatedColumn, block.origin!.moduleId,
          before.length - 1, before.at(-1)!.length, undefined, source);
      };
      addOrigin(line, 0, block.origin.offset);
      if (block.origin.frameOffsets) {
        postcss.parse(block.css).walkRules((rule) => {
          const frame = block.origin!.frameOffsets!.get(rule.selector);
          const start = rule.source?.start;
          if (!frame || !start) return;
          addOrigin(line + start.line - 1, start.column - 1, frame.offset);
          rule.walkDecls((declaration) => {
            const position = declaration.source?.start;
            const offset = frame.descriptorOffsets.get(declaration.prop);
            if (position && offset !== undefined) addOrigin(line + position.line - 1, position.column - 1, offset);
          });
        });
      }
      if (block.declarationPositions || block.origin.descriptorOffsets || block.origin.declarationOffsets) {
        let declarationIndex = 0;
        postcss.parse(block.css).walkDecls((declaration) => {
          const start = declaration.source?.start;
          const offset = block.declarationPositions ? block.origin!.offset
            : block.origin!.declarationOffsets?.[declarationIndex] ??
              block.origin!.descriptorOffsets?.get(declaration.prop);
          declarationIndex += 1;
          if (start && offset !== undefined) addOrigin(line + start.line - 1, start.column - 1, offset);
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
