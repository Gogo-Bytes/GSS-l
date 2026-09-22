import postcss, { CssSyntaxError } from 'postcss';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  createGssCompilerSession, discoverStylesheetAssets,
  type GssDiagnostic, type GssSourceRange
} from '../src/index.js';

const id = '/private/project/card.gss';
const session = () => createGssCompilerSession({ projectRoot: '/private/project' });

it('exports an optional, backward-compatible source range', () => {
  expectTypeOf<GssSourceRange>().toEqualTypeOf<{ start: number; end: number }>();
  expectTypeOf<GssDiagnostic['range']>().toEqualTypeOf<GssSourceRange | undefined>();
  const legacy: GssDiagnostic = {
    code: 'custom', severity: 'error', phase: 'parse', message: 'Invalid', id
  };
  expect(legacy).not.toHaveProperty('range');
});

describe('public diagnostic source ranges', () => {
  it.each(['\n', '\r\n'].flatMap((newline) => ['', '\uFEFF', '\uFFFE'].map((bom) => [newline, bom]))) (
    'locates real CSS syntax in original UTF-16 input (%j, %j)', (newline, bom) => {
      const prefix = `${bom}.valid { content: "😀"; }${newline}`;
      const source = `${prefix}.bad { broken }`;
      const start = prefix.length + 7;
      const compiler = session();
      const result = compiler.replaceStylesheet({ id, source });
      expect(result.committed).toBe(false);
      expect(result.diagnostics).toMatchObject([{
        code: 'GSS1001', id, range: { start, end: start + 6 }
      }]);
      const range = result.diagnostics[0]!.range!;
      expect(source.slice(range.start, range.end)).toBe('broken');
      expect(discoverStylesheetAssets({ id, source })).toEqual({ urls: [], diagnostics: result.diagnostics });
    }
  );
});

it.each(['.good, .bad)', '.good, .bad[=x]', '.good, .bad:', '.good, div']) (
  'attributes selector diagnostics to the enclosing authored nested rule: %s', (selector) => {
    const nested = `& ${selector.replaceAll(', ', ', & ')} { color: blue; }`;
    const prefix = '\uFEFF.outer { content: "😀";\r\n  ';
    const source = `${prefix}${nested}\r\n}`;
    const result = session().replaceStylesheet({ id, source });
    expect(result.committed).toBe(false);
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.range).toEqual({ start: prefix.length, end: prefix.length + nested.length });
    const range = result.diagnostics[0]!.range!;
    expect(source.slice(range.start, range.end)).toBe(nested);
    expect(discoverStylesheetAssets({ id, source }).diagnostics).toEqual(result.diagnostics);
  }
);

it.each(['\n', '\r\n'].flatMap((newline) => ['', '\uFEFF', '\uFFFE'].map((bom) => [newline, bom]))) (
  'locates each repeated declaration, preserving branch order and LKG (%j, %j)', (newline, bom) => {
    const compiler = session();
    expect(compiler.replaceStylesheet({ id, source: '.old { color: red; }' }).committed).toBe(true);
    const previous = compiler.finalize();
    const schema = compiler.getScopeSchema(id);
    const repeated = 'color: /*😀*/ blue !important;';
    const width = 'width: 2px;';
    const source = `${bom}.outer { content: "😀";${newline}& .one, & .two {${newline}` +
      `color: red !important; ${repeated} width: 1px; ${width}${newline}}}`;
    const result = compiler.replaceStylesheet({ id, source });
    expect(result).toMatchObject({ id, committed: false, generation: 1 });
    expect(result.module).toBeUndefined();
    expect(result.diagnostics.map(({ code, range }) => ({ code, range }))).toEqual(
      [repeated, width, repeated, width].map((text) => ({
        code: 'GSS1204', range: { start: source.indexOf(text), end: source.indexOf(text) + text.length }
      }))
    );
    expect(result.diagnostics.map(({ range }) => source.slice(range!.start, range!.end)))
      .toEqual([repeated, width, repeated, width]);
    expect(result.diagnostics.map(({ message }) => message)).toEqual([
      'Duplicate declaration for color in .outer .one.', 'Duplicate declaration for width in .outer .one.',
      'Duplicate declaration for color in .outer .two.', 'Duplicate declaration for width in .outer .two.'
    ]);
    expect(compiler.getScopeSchema(id)).toEqual(schema);
    expect(compiler.finalize()).toEqual(previous);
  }
);

it('uses caller coordinates even when a valid inline map redirects the syntax error upstream', () => {
  const map = encodeURIComponent(JSON.stringify({
    version: 3, sources: ['other.gss'], sourcesContent: ['unrelated upstream text'],
    names: [], mappings: 'AAAA;AAAA;AAAA'
  }));
  const prefix = '\uFEFF.valid { content: "😀"; }\r\n.bad { ';
  const source = `${prefix}broken }\r\n/*# sourceMappingURL=data:application/json,${map} */`;
  const result = session().replaceStylesheet({ id, source });
  expect(result.diagnostics).toMatchObject([{
    code: 'GSS1001', id, range: { start: prefix.length, end: prefix.length + 6 }
  }]);
  const range = result.diagnostics[0]!.range!;
  expect(source.slice(range.start, range.end)).toBe('broken');
  expect(discoverStylesheetAssets({ id, source }).diagnostics).toEqual(result.diagnostics);
});

it.each(['?', 'AA'])('omits lazy map-helper ranges during nested selector validation (%s)', (mappings) => {
  const map = encodeURIComponent(JSON.stringify({ version: 3, sources: ['other.gss'], names: [], mappings }));
  const source = `.outer { & .bad[=x] { color:/*# sourceMappingURL=data:application/json,${map} */ blue; } }`;
  const result = session().replaceStylesheet({ id, source });
  expect(result.committed).toBe(false);
  expect(result.diagnostics).toMatchObject([{ code: 'GSS1001', id }]);
  expect(result.diagnostics[0]).not.toHaveProperty('range');
  expect(discoverStylesheetAssets({ id, source }).diagnostics).toEqual(result.diagnostics);
});

it('reports the parser point for an unclosed block without guessing a token length', () => {
  const source = '\uFEFF\r\n.card { content: "😀";';
  const result = session().replaceStylesheet({ id, source });
  expect(result.diagnostics[0]!.range).toEqual({ start: 3, end: 3 });
});

// These controlled adapter errors exercise public omission/point guarantees for
// parser coordinate shapes that real PostCSS does not reliably produce on demand.
it.each([
  ['unknown origin', undefined],
  ['upstream-only origin', { source: 'upstream', line: 1, column: 1 }],
  ['zero line', { line: 0, column: 1 }],
  ['fractional column', { line: 1, column: 1.5 }],
  ['missing column', { line: 1 }],
  ['beyond line', { line: 1, column: 1000 }],
  ['beyond source', { line: 9, column: 1 }],
  ['partial end', { line: 1, column: 1, endLine: 1 }],
  ['reversed end', { line: 1, column: 4, endLine: 1, endColumn: 1 }],
  ['split start surrogate', { line: 1, column: 20 }],
  ['split end surrogate', { line: 1, column: 1, endLine: 1, endColumn: 20 }]
] as const)('omits unreliable CSS syntax ranges: %s', (_label, coordinates) => {
  const source = '.card { content: "😀"; }';
  const error = new CssSyntaxError('controlled', 1, 1, source);
  if (coordinates) Object.assign(error, { input: { source, ...coordinates } });
  const parser = vi.spyOn(postcss, 'parse').mockImplementation(() => { throw error; });
  try {
    const result = session().replaceStylesheet({ id, source });
    expect(result.diagnostics).toMatchObject([{ code: 'GSS1001', id }]);
    expect(result.diagnostics[0]).not.toHaveProperty('range');
    expect(discoverStylesheetAssets({ id, source }).diagnostics).toEqual(result.diagnostics);
  } finally {
    parser.mockRestore();
  }
});

it('retains a genuinely reported EOF point, with no fabricated final character', () => {
  const source = '\uFEFF.card { content: "😀"; }\r\n';
  const error = new CssSyntaxError('controlled');
  Object.assign(error, { input: { source: source.slice(1), line: 2, column: 1 } });
  const parser = vi.spyOn(postcss, 'parse').mockImplementation(() => { throw error; });
  try {
    const result = session().replaceStylesheet({ id, source });
    expect(result.diagnostics[0]!.range).toEqual({ start: source.length, end: source.length });
    expect(discoverStylesheetAssets({ id, source }).diagnostics).toEqual(result.diagnostics);
  } finally {
    parser.mockRestore();
  }
});

it('does not attribute resource/registry or cross-candidate errors to an unrelated first rule', () => {
  const compiler = session();
  const registration = '@property --size { syntax: "<length>"; inherits: false; initial-value: 1px; }';
  expect(compiler.replaceStylesheet({ id: '/private/project/other.gss', source: registration }).committed).toBe(true);
  const previous = compiler.finalize();
  for (const source of [
    '.unrelated { color: red; } @font-face { font-family: Missing; }',
    `.unrelated { color: red; } ${registration.replace('1px', '2px')}`,
    '.unrelated { color: red; } .inner { margin-inline-start: 1px; } .outer .inner { margin-left: 2px; }'
  ]) {
    const result = compiler.replaceStylesheet({ id, source });
    expect(result.committed).toBe(false);
    expect(result.diagnostics.length).toBeGreaterThan(0);
    for (const diagnostic of result.diagnostics) expect(diagnostic).not.toHaveProperty('range');
    expect(compiler.finalize()).toEqual(previous);
  }
});

it('retains successful output, names, manifest and resource identity when original positions shift', () => {
  const source = '.card { & .icon, & .badge { color:red; } } ' +
    '@keyframes pulse { from { width:1px; } to { width:2px; } } ' +
    '@font-face { font-family: Demo; src:url(demo.woff2); }';
  const baseline = session();
  const expected = baseline.replaceStylesheet({ id, source });
  expect(expected.committed).toBe(true);
  for (const shifted of ['\n', '\r\n', '\uFEFF', '\uFFFE']) {
    const compiler = session();
    const relocated = shifted + source.replace('color:red;', 'color:/*😀*/ red;');
    expect(compiler.replaceStylesheet({ id, source: relocated })).toEqual(expected);
    expect(compiler.finalize()).toEqual(baseline.finalize());
  }
});

it('selects the repeated occurrence even when declaration text is identical', () => {
  const source = '.one { color:red; color:red; } .two { color:red; color:red; }';
  const result = session().replaceStylesheet({ id, source });
  expect(result.diagnostics.map(({ range }) => range)).toEqual([
    { start: 18, end: 28 }, { start: 49, end: 59 }
  ]);
});

it('keeps Asset binding diagnostics unranged rather than borrowing a candidate location', () => {
  const source = '.unrelated { color:red; } .card { background-image:url(image.svg); }';
  const result = session().replaceStylesheet({ id, source, assetReferences: [{ url: 'image.svg', identity: '' }] });
  expect(result.committed).toBe(false);
  expect(result.diagnostics).toMatchObject([{ code: 'GSS1501' }]);
  expect(result.diagnostics[0]).not.toHaveProperty('range');
});
