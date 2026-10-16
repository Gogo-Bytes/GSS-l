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
    expect(manifest.rules).toHaveLength(98);
    expect(manifest.preservedRules).toEqual([]);
    expect(report).toMatchObject({ atomicModules: 1, preservedModules: 0, atomicCoverage: 1 });
    for (const property of ['content', 'list-style-type', 'list-style-position', 'overflow-wrap', 'font-family', 'letter-spacing']) {
      expect(manifest.rules.some((rule) => rule.property === property)).toBe(true);
    }
  });

  it('does not imply support for the rejected overlapping hover and pressed background effects', () => {
    const session = createGssCompilerSession({ projectRoot: root });
    const original = source.replace('.button:hover { border-color: #527c64; }', '.button:hover { background-color: #edf3ed; }')
      .replace('.button[aria-pressed="true"] { background-color: #dfeee3; }', '.button[aria-pressed="true"] { background-color: #dfeee3; border-color: #527c64; }');
    const result = session.replaceStylesheet({ id: `${root}Article.gss`, source: original });
    expect(result.committed).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'GSS1205', reason: 'ambiguous-coactive-state-conflict' })]));
  });
});
