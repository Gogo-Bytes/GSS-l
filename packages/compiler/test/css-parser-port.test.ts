import { describe, expect, it } from 'vitest';
import { createCompilerSession } from '../src/application/compiler-session.js';
import type { CssParserPort, ParsedStylesheet } from '../src/application/css-parser-port.js';

const redClass = 'gss-a--layer_unlayered--condition_base--state_self--property_color--value_red--importance_normal';

describe('internal CssParserPort session seam', () => {
  it('uses a range-bearing parser contribution for replace/finalize, retaining it on port diagnostics', () => {
    const id = '/project/card.gss';
    const source = '.card { color: red; }';
    const parsed: ParsedStylesheet = {
      rules: [{ selector: '.card', path: ['card'], relations: [], states: [[]], attributes: [[]],
        observations: [[]], pseudoElements: [null], conditions: [], layer: 'unlayered', sourceOrdinal: 0,
        source: { sourceId: id, start: 0, end: 21 },
        declarations: [{ property: 'color', value: 'red', important: false,
          source: { sourceId: id, start: 8, end: 19 } }] }], resources: [], diagnostics: []
    };
    const diagnostic = { code: 'GSS1001', phase: 'parse' as const, severity: 'error' as const, id,
      message: 'Invalid CSS syntax.' };
    const calls: unknown[] = [];
    const cssParser: CssParserPort = { parseStylesheet(receivedId, receivedSource) {
      calls.push([receivedId, receivedSource]);
      return receivedSource === source ? parsed : { rules: [], resources: [], diagnostics: [diagnostic] };
    } };
    const compiler = createCompilerSession({ projectRoot: '/project' }, cssParser);
    expect(compiler.replaceStylesheet({ id, source })).toMatchObject({ committed: true, diagnostics: [],
      module: { scopeSchema: { exports: { card: { selfClassName: redClass, targets: {} } } } } });
    const previous = compiler.finalize();
    expect(previous.css).toBe(`.${redClass} {\n  color: red;\n}`);
    expect(compiler.replaceStylesheet({ id, source: 'invalid' })).toEqual({
      id, generation: 1, committed: false, diagnostics: [diagnostic]
    });
    expect(compiler.finalize()).toEqual(previous);
    expect(calls).toEqual([[id, source], [id, 'invalid']]);
    expect(JSON.stringify(previous)).not.toContain('/project');
  });
});

it('does not swallow a broken custom parser or mutate the last committed contribution', () => {
  const failure = new TypeError('broken custom parser');
  let broken = false;
  const cssParser: CssParserPort = { parseStylesheet() {
    if (broken) throw failure;
    return { rules: [], resources: [], diagnostics: [] };
  } };
  const compiler = createCompilerSession({ projectRoot: '/project' }, cssParser);
  expect(compiler.replaceStylesheet({ id: '/project/empty.gss', source: '' }).committed).toBe(true);
  const previous = compiler.finalize();
  broken = true;
  expect(() => compiler.replaceStylesheet({ id: '/project/empty.gss', source: 'broken' })).toThrow(failure);
  expect(compiler.finalize()).toEqual(previous);
});
