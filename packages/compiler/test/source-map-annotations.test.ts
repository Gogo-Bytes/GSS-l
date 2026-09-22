import postcss from 'postcss';
import Parser from 'postcss/lib/parser';
import { describe, expect, it, vi } from 'vitest';
import { createGssCompilerSession, discoverStylesheetAssets } from '../src/index.js';
import { parseStylesheet } from '../src/infrastructure/postcss-stylesheet-parser.js';

const id = '/private/project/card.gss';
const validMap = '{"version":3,"sources":[],"names":[],"mappings":""}';
const dataUri = (json: string) => `data:application/json,${encodeURIComponent(json)}`;
const annotation = (url: string) => `/*# sourceMappingURL=${url} */`;
const mappedAnnotation = (mappings: string) => annotation(dataUri(JSON.stringify({
  version: 3, sources: ['original.gss'], names: [], mappings
})));

const invalidMaps = [
  ['invalid URI', 'data:application/json,%'],
  ['invalid base64 JSON', 'data:application/json;base64,eA=='],
  ['unsupported encoding', 'data:application/json;bad,x'],
  ['missing fields', dataUri('{}')],
  ['null JSON', dataUri('null')],
  ['array JSON', dataUri('[]')]
] as const;

describe('authored inline source-map annotation failures', () => {
  it.each(invalidMaps)('returns diagnostics and retains last-known-good state for %s', (_name, url) => {
    const compiler = createGssCompilerSession({ projectRoot: '/private/project' });
    expect(compiler.replaceStylesheet({ id, source: '.card { color:red }' }).committed).toBe(true);
    const previous = compiler.finalize();
    const schema = compiler.getScopeSchema(id);
    const source = `.card { color:blue } ${annotation(url)}`;
    const diagnostics = [{ code: 'GSS1001', phase: 'parse', severity: 'error', id, message: 'Invalid CSS syntax.' }];
    expect(compiler.replaceStylesheet({ id, source })).toEqual({
      id, committed: false, generation: 1, diagnostics
    });
    expect(compiler.finalize()).toEqual(previous);
    expect(compiler.getScopeSchema(id)).toEqual(schema);
    expect(discoverStylesheetAssets({ id, source })).toEqual({ urls: [], diagnostics });
  });

  it('uses the last annotation, including an invalid one following valid data', () => {
    const source = `.card { color:${annotation(dataUri(validMap))} ${annotation('data:application/json,%')} blue }`;
    const compiler = createGssCompilerSession({ projectRoot: '/private/project' });
    expect(compiler.replaceStylesheet({ id, source })).toMatchObject({
      committed: false, generation: 0, diagnostics: [{ code: 'GSS1001', phase: 'parse', id }]
    });
    expect(discoverStylesheetAssets({ id, source }).diagnostics).toMatchObject([{ code: 'GSS1001' }]);
  });
});

describe('lazy inline source-map lookup failures', () => {
  it.each(['?', 'AA', 'A'].flatMap((mappings) => [
    ['unclosed CSS', mappings, `.card { color:blue ${mappedAnnotation(mappings)}`] as const,
    ['malformed selector', mappings, `.card) { color:${mappedAnnotation(mappings)} blue }`] as const
  ]))('diagnoses %s with mappings %s without changing the last contribution', (_kind, _mappings, source) => {
    const compiler = createGssCompilerSession({ projectRoot: '/private/project' });
    expect(compiler.replaceStylesheet({ id, source: '.card{color:red}' }).committed).toBe(true);
    const previous = compiler.finalize();
    const schema = compiler.getScopeSchema(id);
    const diagnostics = [{ code: 'GSS1001', phase: 'parse', severity: 'error', id, message: 'Invalid CSS syntax.' }];
    expect(compiler.replaceStylesheet({ id, source })).toEqual({
      id, committed: false, generation: 1, diagnostics
    });
    expect(compiler.finalize()).toEqual(previous);
    expect(compiler.getScopeSchema(id)).toEqual(schema);
    expect(discoverStylesheetAssets({ id, source })).toEqual({ urls: [], diagnostics });
  });
});

describe('baseline-compatible inline source-map consumption', () => {
  it.each([
    // Baseline 6864013 accepts these lazy mappings when CSS needs no error lookup.
    ...['?', 'AA', 'A'].map((mappings) => [
      `lazy mappings ${mappings}`,
      dataUri(JSON.stringify({ version: 3, sources: ['original.gss'], names: [], mappings }))
    ] as const),
    ['minimal v3', dataUri(validMap)],
    ['XSSI prefix', dataUri(")]}'\n" + validMap)],
    ['charset UTF-8', `data:application/json;charset=utf-8,${encodeURIComponent(validMap)}`],
    ['charset UTF8', `data:application/json;charset=utf8,${encodeURIComponent(validMap)}`],
    ['base64', `data:application/json;base64,${Buffer.from(validMap).toString('base64')}`],
    ['charset base64', `data:application/json;charset=utf-8;base64,${Buffer.from(validMap).toString('base64')}`],
    ['empty URI payload', 'data:application/json,'],
    ['empty base64 payload', 'data:application/json;base64,'],
    ['external non-map annotation', 'ignored.txt']
  ] as const)('preserves outputs and Asset discovery for %s', (_name, url) => {
    const source = `.card { color:${annotation(url)} blue; background-image:url(image.svg); }`;
    const compiler = createGssCompilerSession({ projectRoot: '/private/project' });
    const baseline = createGssCompilerSession({ projectRoot: '/private/project' });
    const plain = baseline.replaceStylesheet({ id, source: '.card { color:blue; background-image:url(image.svg); }' });
    expect(compiler.replaceStylesheet({ id, source })).toEqual(plain);
    expect(compiler.finalize()).toEqual(baseline.finalize());
    expect(discoverStylesheetAssets({ id, source })).toEqual({ urls: ['image.svg'], diagnostics: [] });
  });

  it('ignores an invalid earlier annotation when the last annotation is valid', () => {
    const source = `.card { color:${annotation('data:application/json,%')} ${annotation(dataUri(validMap))} blue }`;
    const compiler = createGssCompilerSession({ projectRoot: '/private/project' });
    expect(compiler.replaceStylesheet({ id, source })).toMatchObject({ committed: true, diagnostics: [] });
    expect(compiler.finalize().css).toContain('color: blue;');
    expect(discoverStylesheetAssets({ id, source })).toEqual({ urls: [], diagnostics: [] });
  });

  it('keeps ranges in caller CSS rather than upstream sourcesContent', () => {
    const upstream = '{"version":3,"sources":["original.gss"],"sourcesContent":["unrelated"],"names":[],"mappings":"AAAA"}';
    const source = `.card { color:${annotation(dataUri(upstream))} blue }`;
    const parsed = parseStylesheet(id, source);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.rules[0]!.source).toEqual({ sourceId: id, start: 0, end: source.length });
    const span = parsed.rules[0]!.declarations[0]!.source;
    expect(source.slice(span.start, span.end)).toBe(`color:${annotation(dataUri(upstream))} blue`);
  });

  it.each(['?', 'AA'])('isolates lookup containment to the current mapped input (%s)', (mappings) => {
    const invalid = `.card { color:blue ${mappedAnnotation(mappings)}`;
    const valid = `.card { color:${mappedAnnotation(mappings)} blue }`;
    const compiler = createGssCompilerSession({ projectRoot: '/private/project' });
    expect(compiler.replaceStylesheet({ id, source: invalid })).toMatchObject({
      committed: false, generation: 0, diagnostics: [{ code: 'GSS1001', phase: 'parse' }]
    });
    // Another Input outside the adapter must retain PostCSS's native behavior.
    expect(() => postcss.parse(invalid, { from: id })).toThrowError(expect.objectContaining({ name: 'Error' }));
    expect(compiler.replaceStylesheet({ id, source: valid })).toMatchObject({
      committed: true, generation: 1, diagnostics: []
    });
    const another = createGssCompilerSession({ projectRoot: '/private/project' });
    expect(another.replaceStylesheet({ id, source: valid })).toMatchObject({ committed: true, diagnostics: [] });
    expect(another.finalize()).toEqual(compiler.finalize());
    expect(discoverStylesheetAssets({ id, source: valid })).toEqual({ urls: [], diagnostics: [] });
  });

  it.each([new Error('bug'), new TypeError('bug'), new SyntaxError('bug'), new URIError('bug')]
    .flatMap((error) => [
      [error.name, 'no map', error, '.card { color:red }'] as const,
      [error.name, 'empty map', error, `.card { color:${annotation('data:application/json,')} red }`] as const
    ]))('does not convert unexpected postcss.parse %s with %s', (_name, _kind, failure, source) => {
    const parser = vi.spyOn(postcss, 'parse').mockImplementation(() => { throw failure; });
    try {
      expect(() => parseStylesheet(id, source)).toThrow(failure);
    } finally {
      parser.mockRestore();
    }
  });

  it.each([new Error('bug'), new TypeError('bug'), new SyntaxError('bug'), new URIError('bug')]
    .map((error) => [error.name, error] as const))(
    'does not convert unexpected parser %s with a nonempty inline map', (_name, failure) => {
      const parser = vi.spyOn(Parser.prototype, 'parse').mockImplementation(() => { throw failure; });
      try {
        expect(() => parseStylesheet(id, `.card { color:${annotation(dataUri(validMap))} red }`)).toThrow(failure);
      } finally {
        parser.mockRestore();
      }
    }
  );
});
