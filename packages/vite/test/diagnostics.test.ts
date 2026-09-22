import type { GssDiagnostic } from '@gss-l/compiler';
import type { Rollup } from 'vite';
import { expect, it } from 'vitest';
import { reportDiagnostics } from '../src/diagnostics.js';

// Defensive-only synthetic inputs: real host behavior is tested in diagnostic-location.test.ts.
const id = '/project/Card.gss';
function present(source: string, range?: GssDiagnostic['range'], owner = id, snapshot = true) {
  const logs: Rollup.RollupLog[] = [];
  const diagnostic: GssDiagnostic = { id, code: 'GSS1001', phase: 'parse', severity: 'warning', message: 'Invalid CSS', ...(range ? { range } : {}) };
  const context = { warn(log: Rollup.RollupLog) { logs.push(log); } } as Rollup.MinimalPluginContext;
  reportDiagnostics(context, [diagnostic], snapshot ? { id: owner, source } : undefined);
  return logs[0]!;
}

it.each([
  ['', 0, 1, 0, '1 | \n  | ^'],
  ['.card {}', 8, 1, 8, '1 | .card {}\n  |         ^'],
  ['\uFEFF/*😀*/\r\n', 9, 2, 0, '1 | \uFEFF/*😀*/\n2 | \n  | ^'],
  ['\t/*😀*/', 7, 1, 7, '1 | \t/*😀*/\n  | \t      ^']
] as const)('renders a zero-width point without widening range (%j)', (source, offset, line, column, frame) => {
  const log = present(source, { start: offset, end: offset });
  expect(log).toMatchObject({ loc: { file: id, line, column }, frame, range: { start: offset, end: offset } });
});

it('keeps UTF16 BOM/astral columns and tabs on the original line', () => {
  expect(present('\uFEFF\t/*😀*/ broken', { start: 9, end: 15 })).toMatchObject({
    loc: { file: id, line: 1, column: 9 }, frame: '1 | \uFEFF\t/*😀*/ broken\n  |  \t       ^^^^^^'
  });
});

it('underlines multiline selections with an exclusive next-line end', () => {
  expect(present('before\r\n\t.card {\r\n color:red;\r\n}\r\nafter', { start: 9, end: 34 })).toMatchObject({
    loc: { file: id, line: 2, column: 1 },
    frame: '1 | before\n2 | \t.card {\n  | \t^^^^^^^\n3 |  color:red;\n  | ^^^^^^^^^^^\n4 | }\n  | ^\n5 | after'
  });
  expect(present('one\ntwo\nthree', { start: 0, end: 4 }).frame).toBe('1 | one\n  | ^^^\n2 | two\n3 | three');
});

it.each([
  undefined, { start: -1, end: 1 }, { start: 1.5, end: 2 }, { start: 2, end: 1 },
  { start: 0, end: 99 }, { start: NaN, end: 1 }, { start: 1, end: Infinity },
  { start: 2, end: 3 }, { start: 0, end: 2 }
])('omits unreliable ranges %j', (range) => {
  const log = present('a😀z', range);
  expect(log).not.toHaveProperty('loc');
  expect(log).not.toHaveProperty('frame');
  expect(log).not.toHaveProperty('pluginCode');
});

it('omits unmatched or unavailable snapshots', () => {
  for (const log of [present('bad', { start: 0, end: 3 }, '/other.gss'), present('bad', { start: 0, end: 3 }, id, false)]) {
    expect(log).not.toHaveProperty('loc');
    expect(log).not.toHaveProperty('frame');
  }
});

it('preserves severity, order and codes with one emission per diagnostic', () => {
  const calls: [string, Rollup.RollupLog][] = [];
  const context = Object.fromEntries(['info', 'warn', 'error'].map((method) => [method, (log: Rollup.RollupLog) => {
    calls.push([method, log]);
  }])) as unknown as Rollup.MinimalPluginContext;
  const diagnostics = (['info', 'warning', 'error'] as const).map((severity, index) => ({
    id, code: `GSS${index}`, message: String(index), phase: 'parse', severity, range: { start: 0, end: 0 }
  }));
  reportDiagnostics(context, diagnostics, { id, source: '' });
  expect(calls.map(([method, log]) => [method, log.code, log.message])).toEqual([
    ['info', 'GSS0', '[GSS0] 0'], ['warn', 'GSS1', '[GSS1] 1'], ['error', 'GSS2', '[GSS2] 2']
  ]);
});

it('bounds large frames without moving the original location', () => {
  const source = `${' '.repeat(500)}bad\n${'body\n'.repeat(1000)}end`;
  const log = present(source, { start: 500, end: source.length });
  expect(log.loc).toEqual({ file: id, line: 1, column: 500 });
  expect(log.frame).toContain('…');
  expect(log.frame).toContain('1002 | end');
  expect(log.frame!.length).toBeLessThan(2000);
});
