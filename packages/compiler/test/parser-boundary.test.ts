import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

describe('parser failures through the public session', () => {
  it.each(['.good, .bad)', '.good, .bad[=x]', '.good, .bad:'])(
    'rejects malformed selector branch %s without losing the last contribution', (selector) => {
      const compiler = createGssCompilerSession({ projectRoot: '/private/project' });
      const id = '/private/project/card.gss';
      compiler.replaceStylesheet({ id, source: '.card { color: red; }' });
      const previous = compiler.finalize();
      const schema = compiler.getScopeSchema(id);
      const result = compiler.replaceStylesheet({ id, source: `${selector} { color: blue; }` });
      expect(result).toMatchObject({ id, committed: false, generation: 1, diagnostics: [{
        code: 'GSS1001', phase: 'parse', severity: 'error', id
      }] });
      expect(result.diagnostics[0]!.message).not.toContain('/private');
      expect(result.module).toBeUndefined();
      expect(compiler.finalize()).toEqual(previous);
      expect(compiler.getScopeSchema(id)).toEqual(schema);
    }
  );
});

describe('parser seam output compatibility', () => {
  it.each([
    '.good, div { color: blue; }',
    '.good { color: blue; } .outer { & .good, & .bad) { width: 1px; } }',
    '.good { color: blue; /* comment */ }',
    '/* 😀 */ .good { color: blue; }',
    '.good { color: blue;'
  ])('does not commit a partial contribution for %s', (source) => {
    const id = '/private/project/card.gss';
    const compiler = createGssCompilerSession({ projectRoot: '/private/project' });
    compiler.replaceStylesheet({ id, source: '.card { color: red; }' });
    const previous = compiler.finalize();
    const failed = compiler.replaceStylesheet({ id, source });
    expect(failed).toMatchObject({ committed: false, generation: 1 });
    expect(failed.diagnostics.some(({ severity }) => severity === 'error')).toBe(true);
    expect(failed.diagnostics.every(({ message }) => !message.includes('/private'))).toBe(true);
    expect(compiler.finalize()).toEqual(previous);
  });

  it('keeps keyframes identity independent of frame/declaration source locations', () => {
    const keyframes = '@keyframes pulse { from { width: 1px; } to { width: 2px; } }';
    const shifted = '@keyframes pulse {\r\n from { width: /*😀*/ 1px; }\r\n to { width: 2px; }\r\n }';
    const compile = (root: string, source: string) => {
      const compiler = createGssCompilerSession({ projectRoot: root });
      const result = compiler.replaceStylesheet({ id: `${root}/card.gss`, source });
      expect(result.committed).toBe(true);
      expect(result.diagnostics).toEqual([]);
      return compiler.finalize();
    };
    const baseline = compile('/one', keyframes);
    expect(baseline.report.resources).toBe(1);
    expect(baseline.manifest.resources).toHaveLength(1);
    expect(compile('/two', `\r\n${shifted}`)).toEqual(baseline);
    // Same local resource at distinct authored offsets must still deduplicate.
    expect(compile('/three', `${keyframes}\r\n${shifted}`)).toEqual(baseline);
    expect(JSON.stringify(baseline)).not.toContain('/one');
  });

  it('shares identical global resources across Modules despite source offsets and keeps conflicts transactional', () => {
    const source = '@property --size { syntax: "<length>"; inherits: false; initial-value: 1px; } ' +
      '@font-face { font-family: Demo; src: url(demo.woff2); }';
    const compiler = createGssCompilerSession({ projectRoot: '/private/project' });
    const first = '/private/project/a.gss';
    const second = '/private/project/b.gss';
    expect(compiler.replaceStylesheet({ id: first, source }).committed).toBe(true);
    expect(compiler.replaceStylesheet({ id: second, source: `\r\n${source.replace('1px;', '/*😀*/ 1px;')}` }).committed).toBe(true);
    const shared = compiler.finalize();
    expect(shared.report.resources).toBe(2);
    expect(shared.manifest.resources.map(({ sources }) => sources)).toEqual([['a.gss', 'b.gss'], ['a.gss', 'b.gss']]);
    expect(JSON.stringify(shared)).not.toContain('/private');
    expect(compiler.replaceStylesheet({ id: second, source: source.replace('1px;', '2px;') })).toMatchObject({
      committed: false, generation: 2, diagnostics: [{ code: 'GSS1301', phase: 'registry', id: second }]
    });
    expect(compiler.finalize()).toEqual(shared);
  });
});

it('retains complete pre-seam public output goldens for nesting, resources and preserved fallback', () => {
  // Captured from clean baseline 6864013 before the parser/composition changes.
  const cases = JSON.parse(readFileSync(new URL('./fixtures/parser-seam-baseline.json', import.meta.url), 'utf8')) as {
    source: string; result: unknown; snapshot: unknown;
  }[];
  for (const fixture of cases) {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });
    expect(compiler.replaceStylesheet({ id: '/project/card.gss', source: fixture.source })).toEqual(fixture.result);
    expect(compiler.finalize()).toEqual(fixture.snapshot);
  }
});

it.each(['\uFEFF', '\uFFFE'])('keeps public outputs unchanged for a leading %j marker', (marker) => {
  const source = '.card { & .icon, & .badge { color:red; } } ' +
    '@keyframes pulse { from { width:1px; } to { width:2px; } }';
  const compiler = createGssCompilerSession({ projectRoot: '/project' });
  const baseline = createGssCompilerSession({ projectRoot: '/project' });
  const id = '/project/card.gss';
  const expected = baseline.replaceStylesheet({ id, source });
  expect(expected.committed).toBe(true);
  expect(compiler.replaceStylesheet({ id, source: marker + source })).toEqual(expected);
  expect(compiler.finalize()).toEqual(baseline.finalize());
});
