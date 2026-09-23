import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { compileGssReference } from '../src/index.js';

const config = { projectRoot: '/project' };

describe('compileGssReference Asset bindings', () => {
  it('binds equal authored URLs per Module without using delivery URLs in mappings', () => {
    const modules = [
      { id: 'A.gss', source: '.card { background-image: url("./icon.svg"); }', assetReferences: [{ url: './icon.svg', identity: 'a/icon' }] },
      { id: 'B.gss', source: '.card { background-image: url("./icon.svg"); }', assetReferences: [{ url: './icon.svg', identity: 'b/icon' }] }
    ];
    const first = compileGssReference({ config, modules }, { resolveAssetUrl: (id) => `/one/${id}.svg` });
    const second = compileGssReference({ config, modules: [...modules].reverse() }, { resolveAssetUrl: (id) => `/two/${id}.svg` });
    expect(first.success && second.success).toBe(true);
    if (!first.success || !second.success) throw new Error('Expected bound images');
    expect(first.css).toContain('url("/one/a/icon.svg")');
    expect(first.css).toContain('url("/one/b/icon.svg")');
    expect(second.css).toContain('url("/two/a/icon.svg")');
    expect(second.scopeSchemas).toEqual(first.scopeSchemas);
    expect(first.scopeSchemas['A.gss']!.exports.card!.selfClassName).not.toBe(first.scopeSchemas['B.gss']!.exports.card!.selfClassName);
    expect(JSON.stringify(first.scopeSchemas)).not.toContain('/one/');
    expect(postcss.parse(first.css).nodes).toHaveLength(2);
  });
  it.each([
    ['url(./icon.svg?q=%23#part)', './icon.svg?q=%23#part'],
    ['URL( "./a\\20 b.svg?x=%20#part" )', './a b.svg?x=%20#part'],
    ["uRl('./a\\000020b.svg')", './a b.svg'],
    ['url(./a\\ b.svg)', './a b.svg'],
    ['url("./a\\23\r\nb.svg")', './a#b.svg'],
    ['url("./a\\"b.svg")', './a"b.svg'],
    ['url("./café.svg")', './café.svg'],
    ['url("data:image/svg+xml,a(b)")', 'data:image/svg+xml,a(b)'],
    ['url(https://example.test/icon.svg?q=1#x)', 'https://example.test/icon.svg?q=1#x'],
    ['url(#part)', '#part'],
    ['url(a\\ )', 'a '],
    ['url(a\\20 )', 'a '],
    ['url(a\\)b)', 'a)b']
  ])('uses CSS-decoded, not URI-decoded binding key for %s', (value, url) => {
    const requested: string[] = [];
    const result = compileGssReference({ config, modules: [{ id: 'A.gss',
      source: `.card { background-image: ${value}; }`, assetReferences: [{ url, identity: 'opaque' }] }] },
    { resolveAssetUrl(identity) { requested.push(identity); return '/out.svg?q=%20#part'; } });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(JSON.stringify(result.diagnostics));
    expect(requested).toEqual(['opaque']);
    expect(result.css).toContain('background-image: url("/out.svg?q=%20#part");');
  });

  it.each([
    'url()', 'url("")', 'url( )', 'url(a b)', 'url(a"b)', 'url(a(b))',
    'url(a), url(b)', 'none, url(a)', 'linear-gradient(red, blue)', 'var(--image)',
    'image-set(url(a) 1x)', 'url("a" type("image/svg+xml"))', 'url/**/(a)',
    'url(/*comment*/a)', 'url(a/*comment*/)', 'url("a")/**/', 'u\\72l(a)',
    'url("a\\\nb")', 'url("a\\\r\nb")', 'url("a\nb")', 'url("a\0b")',
    'url("a\\0 b")', 'url("a\\d800 b")', 'url("a\\110000 b")',
    'url("a\\a b")', 'url("a\\d b")', 'url("a\\c b")', 'url(a\\)',
    'url("a\ud800b")', 'url("a\u007fb")', 'url(a)\u00a0', 'none\u00a0'
  ])('rejects image values outside the bounded grammar without callback or partial result: %s', (value) => {
    let calls = 0;
    const result = compileGssReference({ config, modules: [{ id: 'A.gss', source: `.card { background-image: ${value}; }` }] },
      { resolveAssetUrl() { calls++; return '/out.svg'; } });
    expect(result).toMatchObject({ success: false, diagnostics: [{ severity: 'error' }] });
    expect(result).not.toHaveProperty('css');
    expect(result).not.toHaveProperty('scopeSchemas');
    expect(calls).toBe(0);
  });

  it.each([
    '/*outside*/url(a)', ' /*outside*/ url(a)', '\t/*outside*/\nurl(a)',
    '/*outside*/none', '/*one*//*two*/url(a)', '/*outside*/url("a") !important'
  ])('rejects leading value comments before any Module resolves: %s', (value) => {
    const requested: string[] = [];
    const result = compileGssReference({ config, modules: [
      { id: 'A.gss', source: '.card { background-image: url(a); }', assetReferences: [{ url: 'a', identity: 'first' }] },
      { id: 'Z.gss', source: `.card { background-image: ${value}; }`,
        assetReferences: value.includes('url(') ? [{ url: 'a', identity: 'last' }] : [] }
    ] }, { resolveAssetUrl(identity) { requested.push(identity); return '/resolved.svg'; } });
    expect(result).toMatchObject({ success: false, diagnostics: [{ id: 'Z.gss', reason: 'unsupported-reference-syntax' }] });
    expect(result).not.toHaveProperty('css');
    expect(result).not.toHaveProperty('scopeSchemas');
    expect(requested).toEqual([]);
  });

  it.each([' ', '\t', '\n', '\r', '\f'].flatMap((whitespace) =>
    ['url(a)', 'none'].map((value) => ({ whitespace, value }))))('accepts outer CSS declaration whitespace: %j', ({ whitespace, value }) => {
    const source = `.card { background-image:${whitespace}${value}${whitespace}; }`;
    const unbound = compileGssReference({ config, modules: [{ id: 'A.gss', source }] });
    expect(unbound.success).toBe(true);
    if (!unbound.success) throw new Error('Expected authored whitespace');
    expect(unbound.css).toBe(source.replace('.card', `.${unbound.scopeSchemas['A.gss']!.exports.card!.selfClassName}`));
    const requested: string[] = [];
    const bound = compileGssReference({ config, modules: [{ id: 'A.gss', source,
      assetReferences: value === 'none' ? [] : [{ url: 'a', identity: 'image' }] }] },
    { resolveAssetUrl(identity) { requested.push(identity); return '/resolved.svg'; } });
    expect(bound.success).toBe(true);
    if (!bound.success) throw new Error('Expected whitespace around bound URL');
    expect(requested).toEqual(value === 'none' ? [] : ['image']);
    const values: string[] = [];
    postcss.parse(bound.css).walkDecls((declaration) => { values.push(declaration.value); });
    expect(values).toEqual([value === 'none' ? 'none' : 'url("/resolved.svg")']);
  });

  it('does not trim whitespace inside quoted URL contents', () => {
    const requested: string[] = [];
    const result = compileGssReference({ config, modules: [{ id: 'A.gss',
      source: '.card { background-image: url(" a ") \t; }', assetReferences: [{ url: ' a ', identity: 'image' }] }] },
    { resolveAssetUrl(identity) { requested.push(identity); return '/resolved.svg'; } });
    expect(result.success).toBe(true);
    expect(requested).toEqual(['image']);
    if (!result.success) throw new Error('Expected unmodified quoted key');
    expect(result.css).toContain('url("/resolved.svg")');
  });

  it('preserves standalone comments and quoted URL comment text', () => {
    const source = '/* url(fake) */ .card { /* outside declaration */ background-image: url("a/*literal*/b"); /* after declaration */ }';
    const unbound = compileGssReference({ config, modules: [{ id: 'A.gss', source }] });
    expect(unbound.success).toBe(true);
    if (!unbound.success) throw new Error('Expected literal comment text');
    expect(unbound.css).toBe(source.replace('.card', `.${unbound.scopeSchemas['A.gss']!.exports.card!.selfClassName}`));
    const requested: string[] = [];
    const bound = compileGssReference({ config, modules: [{ id: 'A.gss', source,
      assetReferences: [{ url: 'a/*literal*/b', identity: 'image' }] }] },
    { resolveAssetUrl(identity) { requested.push(identity); return '/resolved.svg'; } });
    expect(bound.success).toBe(true);
    if (!bound.success) throw new Error('Expected quoted URL binding');
    expect(requested).toEqual(['image']);
    expect(bound.css).toContain('/* outside declaration */ background-image: url("/resolved.svg"); /* after declaration */');
  });

  it('preserves unbound URLs, none, ordinary strings and comments without auto resolution', () => {
    const source = '.card { background-image: URL("./a\\20 b.svg?q=%20#part"); content: "url(fake.svg)"; /* url(fake.svg) */ } .empty { background-image: NoNe; }';
    for (const ports of [{}, { resolveAssetUrl() { throw new Error('Must not resolve unbound'); } }]) {
      const result = compileGssReference({ config, modules: [{ id: 'A.gss', source }] }, ports);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected unbound reference');
      const scopes = result.scopeSchemas['A.gss']!.exports;
      expect(result.css).toBe(source.replace('.card', `.${scopes.card!.selfClassName}`).replace('.empty', `.${scopes.empty!.selfClassName}`));
    }
  });

  it('caches repeated exact identities across Modules only within one invocation and accepts identical duplicate bindings', () => {
    const modules = [
      { id: 'A.gss', source: '.a { background-image: url(a); } .b { background-image: url(b); }',
        assetReferences: [{ url: 'a', identity: 'Shared' }, { url: 'a', identity: 'Shared' }, { url: 'b', identity: 'Shared' }] },
      { id: 'B.gss', source: '.a { background-image: url(c); }', assetReferences: [{ url: 'c', identity: 'Shared' }] }
    ];
    const requests: string[] = [];
    const ports = { resolveAssetUrl(id: string) { requests.push(id); return '/shared.svg'; } };
    for (let index = 0; index < 2; index++) {
      const result = compileGssReference({ config, modules }, ports);
      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected aliases');
      expect(result.css.match(/url\("\/shared.svg"\)/g)).toHaveLength(3);
    }
    expect(requests).toEqual(['Shared', 'Shared']);
  });

  it('keeps case, Unicode normalization and fragment differences in opaque identities', () => {
    const identities = ['Asset', 'asset', 'café', 'cafe\u0301', 'a?q=1#x', 'a?q=1#X'];
    const requests: string[] = [];
    const modules = identities.map((identity, index) => ({ id: `${index}.gss`, source: '.card { background-image: url(a); }', assetReferences: [{ url: 'a', identity }] }));
    const result = compileGssReference({ config, modules }, { resolveAssetUrl(id) { requests.push(id); return `/out/${requests.length}.svg`; } });
    expect(result.success).toBe(true);
    expect(requests).toEqual(identities);
    if (!result.success) throw new Error('Expected opaque identities');
    expect(result.css).toContain('url("/out/6.svg")');
  });

  it.each([
    [{ url: '', identity: 'id' }], [{ url: 'a', identity: '' }], [{ url: 'absent', identity: 'id' }],
    [{ url: 'a', identity: 'one' }, { url: 'a', identity: 'two' }],
    [{ url: 'a b', identity: 'id' }], [{ url: 'fake.svg', identity: 'id' }]
  ])('validates all bindings before any callback: %j', (...assetReferences) => {
    let calls = 0;
    const result = compileGssReference({ config, modules: [
      { id: 'A.gss', source: '.card { background-image: url(a); }', assetReferences: [{ url: 'a', identity: 'valid' }] },
      { id: 'Z.gss', source: '.card { background-image: url(a%20b); content: "url(fake.svg)"; /* url(fake.svg) */ } .other { background-image: url(a); }', assetReferences }
    ] }, { resolveAssetUrl() { calls++; return '/valid.svg'; } });
    expect(result).toMatchObject({ success: false, diagnostics: [{ id: 'Z.gss', reason: 'invalid-reference-asset-binding' }] });
    expect(result).not.toHaveProperty('css');
    expect(result).not.toHaveProperty('scopeSchemas');
    expect(calls).toBe(0);
  });

  it.each([
    '.card {', '.card:hover {}', '.card { background-image: url(a), url(b); }',
    '.card { background-image: url(a); background-image: none; }',
    '@font-face { src: url(a); }', '@keyframes spin { to { background-image: url(a); } }',
    '.card { --image: url(a); }', '.card { content: url(a); }', '.card { width: calc(1px); }', '.card { width: "(1)"; }',
    '.card { content: "a\\20 b"; }', '@media (min-width: 200px) { .card {} }'
  ])('validates a later source before resolving an earlier valid binding: %s', (source) => {
    let calls = 0;
    const result = compileGssReference({ config, modules: [
      { id: 'A.gss', source: '.card { background-image: url(a); }', assetReferences: [{ url: 'a', identity: 'id' }] },
      { id: 'Z.gss', source }
    ] }, { resolveAssetUrl() { calls++; return '/a.svg'; } });
    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty('css');
    expect(result).not.toHaveProperty('scopeSchemas');
    expect(calls).toBe(0);
  });

  it.each(['missing', 'empty', 'throw'] as const)('returns diagnostics only for %s resolver and permits a subsequent fresh invocation', (mode) => {
    const input = { config, modules: [{ id: 'A.gss', source: '.card { background-image: url(a); }', assetReferences: [{ url: 'a', identity: 'id' }] }] };
    const ports = mode === 'missing' ? {} : { resolveAssetUrl() { if (mode === 'throw') throw new Error('host failure'); return ''; } };
    expect(compileGssReference(input, ports)).toEqual({ success: false, diagnostics: [expect.objectContaining({ reason: 'reference-asset-resolution-failed', id: 'A.gss', severity: 'error' })] });
    expect(compileGssReference(input, { resolveAssetUrl: () => '/ok.svg' }).success).toBe(true);
  });

  it('returns no partial result after a later resolver fails, and does not retain earlier resolutions', () => {
    const input = { config, modules: [{ id: 'A.gss', source: '.a { background-image: url(a); } .b { background-image: url(b); }',
      assetReferences: [{ url: 'a', identity: 'one' }, { url: 'b', identity: 'two' }] }] };
    const calls: string[] = [];
    const result = compileGssReference(input, { resolveAssetUrl(id) { calls.push(id); if (id === 'two') throw new Error('bad'); return '/one.svg'; } });
    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty('css');
    expect(result).not.toHaveProperty('scopeSchemas');
    expect(calls).toEqual(['one', 'two']);
    expect(compileGssReference(input, { resolveAssetUrl(id) { calls.push(id); return '/ok.svg'; } }).success).toBe(true);
    expect(calls).toEqual(['one', 'two', 'one', 'two']);
  });

  it('escapes resolver output as one CSS string without authored-text placeholder collisions', () => {
    const source = '.card { background-image: url(a); content: "gss_asset_0 url(a)"; /* url(a) */ }';
    const input = Object.freeze({ config: Object.freeze(config), modules: Object.freeze([Object.freeze({ id: 'A.gss', source,
      assetReferences: Object.freeze([Object.freeze({ url: 'a', identity: 'gss_asset_0' })]) })]) });
    const output = '/a"); color: red; } /*\\\n\r\f\t.svg';
    const result = compileGssReference(input, { resolveAssetUrl: () => output });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected safe rendering');
    const declarations: { prop: string; value: string }[] = [];
    postcss.parse(result.css).walkDecls((decl) => { declarations.push({ prop: decl.prop, value: decl.value }); });
    expect(declarations).toEqual([
      { prop: 'background-image', value: 'url("/a\\"); color: red; } /*\\\\\\a \\d \\c \\9 .svg")' },
      { prop: 'content', value: '"gss_asset_0 url(a)"' }
    ]);
    expect(result.css).toContain('/* url(a) */');
    expect(input.modules[0]!.source).toBe(source);
  });

  it('retains assets in registered layers/conditions and current pseudo subjects without pruning declarations', () => {
    const result = compileGssReference({ config: { ...config, layers: ['base'], conditions: { media: ['(min-width: 200px)'] } }, modules: [{ id: 'A.gss',
      source: '@layer base { @media (min-width: 200px) { .outer .card:disabled::before { content: "url(fake.svg)"; background-image: url(a) !important; } } .outer .card { background-image: none; } }',
      assetReferences: [{ url: 'a', identity: 'image' }] }] }, { resolveAssetUrl: () => '/out.svg' });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected composition');
    expect(result.css).toContain('background-image: url("/out.svg") !important;');
    expect(result.css).toContain('background-image: none;');
    expect(result.css).toContain(':disabled::before');
    expect(result.scopeSchemas['A.gss']!.exports.outer!.targets.card!.selfClassName).toBeTruthy();
  });

  it('rejects unsupported configuration before calling the resolver', () => {
    let calls = 0;
    const result = compileGssReference({ config: { ...config, conditions: { media: ['screen'] } }, modules: [{ id: 'A.gss',
      source: '.card { background-image: url(a); }', assetReferences: [{ url: 'a', identity: 'id' }] }] },
    { resolveAssetUrl() { calls++; return '/a.svg'; } });
    expect(result).toMatchObject({ success: false, diagnostics: [{ reason: 'unsupported-reference-config' }] });
    expect(result).not.toHaveProperty('css');
    expect(result).not.toHaveProperty('scopeSchemas');
    expect(calls).toBe(0);
  });

});
