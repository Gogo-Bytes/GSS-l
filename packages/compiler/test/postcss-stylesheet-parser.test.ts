import { describe, expect, it } from 'vitest';
import { parseStylesheet } from '../src/infrastructure/postcss-stylesheet-parser.js';
import type { ParsedStylesheet } from '../src/application/css-parser-port.js';

const id = '/project/card.gss';
const source = '.card {\r\n color: /*😀*/ red;\r\n & .icon, & .badge { width: 1px; }\r\n height: 2px;\r\n}';

function withoutSourceIds(parsed: ParsedStylesheet): string {
  return JSON.stringify(parsed, (key, value: unknown) => key === 'sourceId' ? undefined : value);
}

describe('PostCSS adapter original-source provenance', () => {
  it('retains UTF-16 half-open spans through nesting splits, list expansion, CRLF and Unicode comments', () => {
    const parsed = parseStylesheet(id, source);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.rules.map(({ selector, source, sourceOrdinal, declarations }) => ({
      selector, source, sourceOrdinal, declarations
    }))).toEqual([
      { selector: '.card', source: { sourceId: id, start: 0, end: 82 }, sourceOrdinal: 0,
        declarations: [{ property: 'color', value: 'red', important: false,
          source: { sourceId: id, start: 10, end: 28 } }] },
      { selector: '.card .icon', source: { sourceId: id, start: 31, end: 64 }, sourceOrdinal: 1,
        declarations: [{ property: 'width', value: '1px', important: false,
          source: { sourceId: id, start: 51, end: 62 } }] },
      { selector: '.card .badge', source: { sourceId: id, start: 31, end: 64 }, sourceOrdinal: 1,
        declarations: [{ property: 'width', value: '1px', important: false,
          source: { sourceId: id, start: 51, end: 62 } }] },
      { selector: '.card', source: { sourceId: id, start: 0, end: 82 }, sourceOrdinal: 2,
        declarations: [{ property: 'height', value: '2px', important: false,
          source: { sourceId: id, start: 67, end: 79 } }] }
    ]);
    const nested = parsed.rules[1]!;
    expect(source.slice(nested.source.start, nested.source.end)).toBe('& .icon, & .badge { width: 1px; }');
    expect(source.slice(10, 28)).toBe('color: /*😀*/ red;');
    expect(JSON.stringify(parseStylesheet(id, source))).toBe(JSON.stringify(parsed));
    expect(withoutSourceIds(parseStylesheet('/relocated/card.gss', source))).toBe(withoutSourceIds(parsed));
  });

  it('attributes every plain list branch to its enclosing authored rule, not the selector substring', () => {
    const source = '.a,\r\n.b { color:red }';
    const parsed = parseStylesheet('relative.gss', source);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.rules.map(({ source }) => source)).toEqual([
      { sourceId: 'relative.gss', start: 0, end: 21 }, { sourceId: 'relative.gss', start: 0, end: 21 }
    ]);
    expect(parsed.rules[0]!.declarations[0]!.source).toEqual({ sourceId: 'relative.gss', start: 10, end: 19 });
  });

  it('retains exact resource, frame and declaration node spans including final declarations without semicolons', () => {
    const source = '@keyframes pulse { from, 50% { width: 1px; } to { width: 2px; } }\r\n' +
      '@property --size { syntax: "<length>"; inherits: false; initial-value: 1px }\r\n' +
      '@font-face { font-family: "😀"; src: url(font.woff2) }';
    const parsed = parseStylesheet(id, source);
    expect(parsed.diagnostics).toEqual([]);
    expect(parsed.resources.map((resource) => source.slice(resource.source.start, resource.source.end))).toEqual([
      '@keyframes pulse { from, 50% { width: 1px; } to { width: 2px; } }',
      '@property --size { syntax: "<length>"; inherits: false; initial-value: 1px }',
      '@font-face { font-family: "😀"; src: url(font.woff2) }'
    ]);
    const frames = parsed.resources[0]!;
    if (frames.kind !== 'keyframes') throw new Error('Expected keyframes');
    expect(frames.frames.map(({ source: span }) => source.slice(span.start, span.end))).toEqual([
      'from, 50% { width: 1px; }', 'to { width: 2px; }'
    ]);
    const declarations = parsed.resources.flatMap((r) => r.kind === 'keyframes'
      ? r.frames.flatMap(({ declarations }) => declarations) : r.declarations);
    expect(declarations.map(({ source: span }) => source.slice(span.start, span.end))).toEqual([
      'width: 1px;', 'width: 2px;', 'syntax: "<length>";', 'inherits: false;', 'initial-value: 1px',
      'font-family: "😀";', 'src: url(font.woff2)'
    ]);
    expect(declarations.every(({ source }) => source.sourceId === id)).toBe(true);
  });

  it('returns no normalized partial result for malformed nested list branches', () => {
    expect(parseStylesheet(id, '.good { color: red; } .outer { & .ok, & .bad) { width: 1px; } }')).toEqual({
      rules: [], resources: [], diagnostics: [{ code: 'GSS1001', phase: 'parse', severity: 'error', id,
        message: 'Invalid CSS syntax.' }]
    });
  });
});

it.each(['\uFEFF', '\uFFFE'])('keeps offsets in unchanged caller input after a leading %j marker', (marker) => {
  const source = marker + '.a { color:red }';
  const parsed = parseStylesheet(id, source);
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.rules[0]!.source).toEqual({ sourceId: id, start: 1, end: 17 });
  expect(parsed.rules[0]!.declarations[0]!.source).toEqual({ sourceId: id, start: 6, end: 15 });
  const { start, end } = parsed.rules[0]!.source;
  expect(source.slice(start, end)).toBe('.a { color:red }');
});

it.each(['\uFEFF', '\uFFFE'])('preserves %j-prefixed descendant/list clones and resource node spans', (marker) => {
  const source = marker + '.a { & .b, & .c { color: /*😀*/ red; } }\r\n' +
    '@keyframes pulse { from { width:1px } }\r\n' +
    '@property --size { syntax:"<length>"; inherits:false; initial-value:1px }\r\n' +
    '@font-face { font-family:Demo; src:url(font.woff2) }';
  const parsed = parseStylesheet(id, source);
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.rules.map(({ selector, source: span }) => [selector, source.slice(span.start, span.end)])).toEqual([
    ['.a .b', '& .b, & .c { color: /*😀*/ red; }'],
    ['.a .c', '& .b, & .c { color: /*😀*/ red; }']
  ]);
  expect(parsed.rules.map(({ declarations }) => {
    const span = declarations[0]!.source;
    return source.slice(span.start, span.end);
  })).toEqual(['color: /*😀*/ red;', 'color: /*😀*/ red;']);
  expect(parsed.resources.map(({ source: span }) => source.slice(span.start, span.end))).toEqual([
    '@keyframes pulse { from { width:1px } }',
    '@property --size { syntax:"<length>"; inherits:false; initial-value:1px }',
    '@font-face { font-family:Demo; src:url(font.woff2) }'
  ]);
  const resource = parsed.resources[0]!;
  if (resource.kind !== 'keyframes') throw new Error('Expected keyframes');
  const frame = resource.frames[0]!;
  expect(source.slice(frame.source.start, frame.source.end)).toBe('from { width:1px }');
  const declaration = frame.declarations[0]!;
  expect(source.slice(declaration.source.start, declaration.source.end)).toBe('width:1px');
});
