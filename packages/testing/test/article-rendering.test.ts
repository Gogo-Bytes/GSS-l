import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGssCompilerSession } from '@gss-l/compiler';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../acceptance/article/', import.meta.url));
const source = readFileSync(`${root}Article.gss`, 'utf8');

describe('article rendering business input', () => {
  it('atomizes the approved article design using existing effects, including list markers and quote pseudo-elements', () => {
    const session = createGssCompilerSession({ projectRoot: root });
    expect(session.replaceStylesheet({ id: `${root}Article.gss`, source })).toMatchObject({
      committed: true, diagnostics: [], module: { compilationMode: 'atomic', fallbackReasons: [] }
    });
    const { manifest, report } = session.finalize();
    expect(manifest.modules).toEqual(['Article.gss']);
    // Original business input is unchanged; safe adjacent occurrence versions share.
    expect(manifest.rules).toHaveLength(131);
    expect(manifest.preservedRules).toEqual([]);
    expect(report).toMatchObject({ atomicModules: 1, preservedModules: 0, atomicCoverage: 1 });
    for (const property of ['content', 'list-style-type', 'list-style-position', 'overflow-wrap', 'font-family', 'letter-spacing']) {
      expect(manifest.rules.some((rule) => rule.property === property)).toBe(true);
    }
  });

  it('accepts the historical original hover/pressed input unchanged within the bounded current-node rank slice', () => {
    const session = createGssCompilerSession({ projectRoot: root });
    const original = readFileSync(new URL('../acceptance/atom-ranks/article-original.gss', import.meta.url), 'utf8');
    // The frozen approved business design remains separate and unchanged.
    expect(original).toBe(source.replace('.button:hover { border-color: #527c64; }', '.button:hover { background-color: #edf3ed; }')
      .replace('.button[aria-pressed="true"] { background-color: #dfeee3; }', '.button[aria-pressed="true"] { background-color: #dfeee3; border-color: #527c64; }'));
    expect(session.replaceStylesheet({ id: `${root}Article.gss`, source: original })).toMatchObject({
      committed: true, diagnostics: [], module: { compilationMode: 'atomic', fallbackReasons: [] }
    });
    const classes = session.getScopeSchema(`${root}Article.gss`)!.exports.button!.selfClassName.split(' ');
    expect(session.finalize().manifest.rules.filter((rule) => classes.includes(rule.className) && rule.property === 'background-color')
      .map((rule) => rule.value)).toEqual(['#ffffff', '#edf3ed', '#dfeee3']);
  });
});
