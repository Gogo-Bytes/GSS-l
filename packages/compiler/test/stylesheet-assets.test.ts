import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { createGssCompilerSession, discoverStylesheetAssets } from '../src/index.js';

describe('stylesheet Asset references', () => {
  it('separates equal authored URLs by identity and resolves deployment URLs only at rendering', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const a = session.replaceStylesheet({ id: '/project/a/Card.gss',
      source: '.card { background-image: url("./icon.svg"); }',
      assetReferences: [{ url: './icon.svg', identity: 'a/icon.svg' }]
    });
    const b = session.replaceStylesheet({ id: '/project/b/Card.gss',
      source: '.card { background-image: url("./icon.svg"); }',
      assetReferences: [{ url: './icon.svg', identity: 'b/icon.svg' }]
    });
    expect(a.committed && b.committed).toBe(true);
    expect(a.module?.moduleCode).not.toBe(b.module?.moduleCode);
    const first = session.finalize({ resolveAssetUrl: (id) => `/one/${id}` });
    const second = session.finalize({ resolveAssetUrl: (id) => `/two/${id}` });
    expect(first.report.rules).toBe(2);
    expect(first.css).toContain('url("/one/a/icon.svg")');
    expect(first.css).toContain('url("/one/b/icon.svg")');
    expect(second.css).toContain('url("/two/a/icon.svg")');
    expect(second.manifest.rules.map((rule) => rule.className)).toEqual(first.manifest.rules.map((rule) => rule.className));
    expect(session.getScopeSchema('/project/a/Card.gss')).toEqual(a.module?.scopeSchema);
  });
  it('updates shared Asset ownership when one Module changes identity', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const source = (url: string) => `.card { background-image: url(${url}); }`;
    const asset = (url: string, identity: string) => [{ url, identity }] as const;
    expect(session.replaceStylesheet({ id: '/project/a.gss', source: source('icon.svg'),
      assetReferences: asset('icon.svg', 'icons/one.svg') }).committed).toBe(true);
    expect(session.replaceStylesheet({ id: '/project/b.gss', source: source('icon.svg'),
      assetReferences: asset('icon.svg', 'icons/one.svg') }).committed).toBe(true);
    expect(session.replaceStylesheet({ id: '/project/a.gss', source: source('other.svg'),
      assetReferences: asset('other.svg', 'icons/two.svg') }).committed).toBe(true);

    let snapshot = session.finalize({ resolveAssetUrl: (identity) => `/out/${identity}` });
    expect(snapshot.manifest.rules.find((rule) => rule.value.includes('icons/one.svg'))?.sources).toEqual(['b.gss']);
    expect(snapshot.manifest.rules.find((rule) => rule.value.includes('icons/two.svg'))?.sources).toEqual(['a.gss']);
    expect(snapshot.css).toContain('url("/out/icons/one.svg")');
    expect(snapshot.css).toContain('url("/out/icons/two.svg")');

    session.invalidate('/project/b.gss');
    snapshot = session.finalize({ resolveAssetUrl: (identity) => `/out/${identity}` });
    expect(snapshot.css).toContain('url("/out/icons/two.svg")');
    expect(snapshot.css).not.toContain('url("/out/icons/one.svg")');
  });

  it('detects global font conflicts by resolved identity rather than equal authored src', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const source = '@font-face { font-family: "Demo"; src: url(./font.woff2); }';
    expect(session.replaceStylesheet({ id: '/project/a.gss', source,
      assetReferences: [{ url: './font.woff2', identity: 'a/font.woff2' }]
    }).committed).toBe(true);
    const conflict = session.replaceStylesheet({ id: '/project/b.gss', source,
      assetReferences: [{ url: './font.woff2', identity: 'b/font.woff2' }]
    });
    expect(conflict.committed).toBe(false);
    expect(conflict.diagnostics[0]?.code).toBe('GSS1301');
    const snapshot = session.finalize({ resolveAssetUrl: () => '/assets/font-hash.woff2' });
    expect(snapshot.manifest.modules).toEqual(['a.gss']);
    expect(snapshot.css).toContain('src: url("/assets/font-hash.woff2")');
  });

  it('renders bound URLs in preserved declarations and keyframes without changing markers', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id: '/project/Card.gss', source: `
      .card { future-paint: url(./sprite.svg#card); animation: spin 1s; }
      @keyframes spin { to { background-image: url(./sprite.svg#card); } }
    `, assetReferences: [{ url: './sprite.svg#card', identity: 'sprite.svg#card' }] });
    expect(result.module?.compilationMode).toBe('preserved');
    const css = session.finalize({ resolveAssetUrl: () => '/assets/sprite-hash.svg#card' }).css;
    expect(css.match(/url\("\/assets\/sprite-hash.svg#card"\)/g)).toHaveLength(2);
    expect(css).not.toContain('url(./sprite.svg');
    expect(session.getScopeSchema('/project/Card.gss')).toEqual(result.module?.scopeSchema);
  });

  it('does not confuse authored token text with a structured asset value', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const literal = session.replaceStylesheet({ id: '/project/a.gss',
      source: '.card { --paint: ["",{"asset":"icon.svg"},""]; }' });
    const bound = session.replaceStylesheet({ id: '/project/b.gss',
      source: '.card { --paint: url(icon.svg); }',
      assetReferences: [{ url: 'icon.svg', identity: 'icon.svg' }] });
    expect(literal.committed && bound.committed).toBe(true);
    const snapshot = session.finalize({ resolveAssetUrl: () => '/out/icon.svg' });
    expect(snapshot.report.rules).toBe(2);
    expect(snapshot.css).toContain('--paint: ["",{"asset":"icon.svg"},""];');
    expect(snapshot.css).toContain('--paint: url("/out/icon.svg");');
  });

  it('does not collapse distinct opaque Unicode asset identities during readable naming', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const first = session.replaceStylesheet({ id: '/project/a.gss',
      source: '.card { background-image: url(icon.svg); }',
      assetReferences: [{ url: 'icon.svg', identity: 'caf\u00e9/icon.svg' }] });
    const second = session.replaceStylesheet({ id: '/project/b.gss',
      source: '.card { background-image: url(icon.svg); }',
      assetReferences: [{ url: 'icon.svg', identity: 'cafe\u0301/icon.svg' }] });
    expect(first.module?.moduleCode).not.toBe(second.module?.moduleCode);
  });

  it('allocates bound identities before accumulating classes within a Module', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id: '/project/a.gss',
      source: '.a { background-image: url(caf\u00e9.svg); } .b { background-image: url(cafe\u0301.svg); }',
      assetReferences: [
        { url: 'caf\u00e9.svg', identity: 'one.svg' },
        { url: 'cafe\u0301.svg', identity: 'two.svg' }
      ] });
    expect(result.committed).toBe(true);
    const scopes = result.module!.scopeSchema.exports;
    expect(scopes.a!.selfClassName).not.toBe(scopes.b!.selfClassName);
    const snapshot = session.finalize({ resolveAssetUrl: (id) => `/out/${id}` });
    expect(snapshot.manifest.rules.find((rule) => rule.className === scopes.a!.selfClassName)?.value).toBe('url("/out/one.svg")');
  });

  it('deduplicates aliases of the same identity and keeps fragment identities distinct', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const a = session.replaceStylesheet({ id: '/project/a.gss', source: '.card { background-image: url(./icon.svg#a); }',
      assetReferences: [{ url: './icon.svg#a', identity: 'icons.svg?v=1#a' }] });
    const b = session.replaceStylesheet({ id: '/project/b.gss', source: '.card { background-image: URL("../icons.svg#a"); }',
      assetReferences: [{ url: '../icons.svg#a', identity: 'icons.svg?v=1#a' }] });
    session.replaceStylesheet({ id: '/project/c.gss', source: '.card { background-image: url(icon.svg#b); }',
      assetReferences: [{ url: 'icon.svg#b', identity: 'icons.svg?v=1#b' }] });
    expect(a.module?.moduleCode).toBe(b.module?.moduleCode);
    const snapshot = session.finalize({ resolveAssetUrl: (id) => `/out/${id}` });
    expect(snapshot.report.rules).toBe(2);
    expect(snapshot.manifest.rules.find((rule) => rule.value.includes('#a'))?.sources).toEqual(['a.gss', 'b.gss']);
    expect(snapshot.css).toContain('url("/out/icons.svg?v=1#b")');
  });

  it('deduplicates font aliases by identity with deterministic source mappings', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    for (const [id, url] of [['b.gss', '../fonts/demo.woff2'], ['a.gss', './demo.woff2']] as const) {
      expect(session.replaceStylesheet({ id: `/project/${id}`,
        source: `@font-face { font-family: "Demo"; src: url('${url}') format('woff2'); }`,
        assetReferences: [{ url, identity: 'fonts/demo.woff2' }] }).committed).toBe(true);
    }
    const snapshot = session.finalize({ resolveAssetUrl: () => '/out/demo.woff2' });
    expect(snapshot.report.resources).toBe(1);
    expect(snapshot.manifest.resources[0]?.sources).toEqual(['a.gss', 'b.gss']);
    expect(snapshot.css).toContain(`src: url("/out/demo.woff2") format('woff2');`);
  });

  it('moves one shared font owner to a new identity without stale resource ownership', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const source = (family: string, url: string) => `@font-face { font-family: "${family}"; src: url('${url}') format('woff2'); }`;
    expect(session.replaceStylesheet({ id: '/project/a.gss', source: source('DemoA', './a.woff2'),
      assetReferences: [{ url: './a.woff2', identity: 'fonts/a.woff2' }] }).committed).toBe(true);
    expect(session.replaceStylesheet({ id: '/project/b.gss', source: source('DemoA', './a.woff2'),
      assetReferences: [{ url: './a.woff2', identity: 'fonts/a.woff2' }] }).committed).toBe(true);

    expect(session.replaceStylesheet({ id: '/project/a.gss', source: source('DemoB', './b.woff2'),
      assetReferences: [{ url: './b.woff2', identity: 'fonts/b.woff2' }] }).committed).toBe(true);
    let snapshot = session.finalize({ resolveAssetUrl: (identity) => `/out/${identity}` });
    expect(snapshot.manifest.resources).toMatchObject([
      { kind: 'font-face', name: '"DemoA"|normal|normal|normal|all', sources: ['b.gss'] },
      { kind: 'font-face', name: '"DemoB"|normal|normal|normal|all', sources: ['a.gss'] }
    ]);
    expect(snapshot.css).toContain('url("/out/fonts/a.woff2")');
    expect(snapshot.css).toContain('url("/out/fonts/b.woff2")');

    expect(session.invalidate('/project/b.gss')).toMatchObject({ changed: true });
    snapshot = session.finalize({ resolveAssetUrl: (identity) => `/out/${identity}` });
    expect(snapshot.manifest.resources).toMatchObject([
      { kind: 'font-face', name: '"DemoB"|normal|normal|normal|all', sources: ['a.gss'] }
    ]);
    expect(snapshot.css).toContain('url("/out/fonts/b.woff2")');
    expect(snapshot.css).not.toContain('url("/out/fonts/a.woff2")');
  });

  it('keeps a shared registered-property Asset until its last owner is removed', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const property = (name: string, url: string) =>
      `@property ${name} { syntax: "<image>"; inherits: false; initial-value: url(${url}); }`;
    const shared = { source: property('--image', 'icon.svg'),
      assetReferences: [{ url: 'icon.svg', identity: 'icons/one.svg' }] };
    for (const id of ['a.gss', 'b.gss']) {
      expect(session.replaceStylesheet({ id: `/project/${id}`, ...shared }).committed).toBe(true);
    }
    const render = () => session.finalize({ resolveAssetUrl: (identity) => `/out/${identity}` });
    expect(render().manifest.resources).toMatchObject([
      { kind: 'property', name: '--image', sources: ['a.gss', 'b.gss'] }
    ]);

    expect(session.replaceStylesheet({ id: '/project/a.gss', source: property('--other', 'other.svg'),
      assetReferences: [{ url: 'other.svg', identity: 'icons/two.svg' }] }).committed).toBe(true);
    let snapshot = render();
    expect(snapshot.manifest.resources).toMatchObject([
      { kind: 'property', name: '--image', sources: ['b.gss'] },
      { kind: 'property', name: '--other', sources: ['a.gss'] }
    ]);
    expect(snapshot.css).toContain('url("/out/icons/one.svg")');
    expect(snapshot.css).toContain('url("/out/icons/two.svg")');

    expect(session.invalidate('/project/b.gss')).toMatchObject({ changed: true });
    snapshot = session.finalize({ resolveAssetUrl: (identity) => {
      if (identity === 'icons/one.svg') throw new Error('stale Asset requested');
      return `/out/${identity}`;
    } });
    expect(snapshot.manifest.resources).toMatchObject([{ kind: 'property', name: '--other', sources: ['a.gss'] }]);
    expect(snapshot.css).not.toContain('icons/one.svg');
    expect(snapshot.css).toContain('url("/out/icons/two.svg")');
    session.invalidate('/project/a.gss');
    expect(session.finalize().css).toBe('');
    expect(session.finalize().manifest.resources).toEqual([]);
  });

  it('retains shared resource ownership after a failed replacement', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const source = '@font-face { font-family: "Demo"; src: url("./demo.woff2"); }';
    const assetReferences = [{ url: './demo.woff2', identity: 'fonts/demo.woff2' }] as const;
    expect(session.replaceStylesheet({ id: '/project/a.gss', source, assetReferences }).committed).toBe(true);
    expect(session.replaceStylesheet({ id: '/project/b.gss', source, assetReferences }).committed).toBe(true);
    const previous = session.finalize({ resolveAssetUrl: (identity) => `/out/${identity}` });

    const failed = session.replaceStylesheet({ id: '/project/a.gss',
      source: '.card { color: red; color: blue; }' });
    expect(failed).toMatchObject({ committed: false, diagnostics: [{ code: 'GSS1204' }] });
    expect(session.finalize({ resolveAssetUrl: (identity) => `/out/${identity}` })).toEqual(previous);
    expect(session.finalize({ resolveAssetUrl: (identity) => `/out/${identity}` }).manifest.resources[0]?.sources)
      .toEqual(['a.gss', 'b.gss']);
  });

  it.each([
    '.card { background-image: url(icon.svg); }',
    '.card { future-paint: url(icon.svg); }',
    '@font-face { font-family: "Demo"; src: url(icon.svg); }',
    '@keyframes spin { to { background-image: url(icon.svg); } }',
    '@property --image { syntax: "<image>"; inherits: false; initial-value: url(icon.svg); }'
  ])('fails unresolved rendering without mutating committed state: %s', (source) => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id: '/project/a.gss', source,
      assetReferences: [{ url: 'icon.svg', identity: 'icon.svg' }] });
    expect(result.committed).toBe(true);
    expect(() => session.finalize()).toThrow(/Missing output URL/);
    expect(() => session.finalize({ resolveAssetUrl: () => '' })).toThrow(/Missing output URL/);
    const valid = session.finalize({ resolveAssetUrl: () => '/out/icon.svg' });
    expect(valid.generation).toBe(result.generation);
    expect(valid.css).toContain('url("/out/icon.svg")');
    session.invalidate('/project/a.gss');
    expect(session.finalize().css).toBe('');
  });

  it('renders current-state, relation and observed declarations through the same asset protocol', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id: '/project/a.gss', source: `
      .card:hover { background-image: url(icon.svg); }
      .card > .icon { mask-image: url(icon.svg); }
      .card:has(.badge:hover) { background-image: url(icon.svg); }
    `, assetReferences: [{ url: 'icon.svg', identity: 'icon.svg' }] });
    expect(result.committed).toBe(true);
    const snapshot = session.finalize({ resolveAssetUrl: () => '/out/icon.svg' });
    expect(snapshot.report.rules).toBe(3);
    expect(snapshot.css.match(/url\("\/out\/icon.svg"\)/g)).toHaveLength(3);
    expect(snapshot.css).toContain(':hover');
    expect(snapshot.css).toContain(':has(');
  });

  it('quotes rendered URLs without allowing CSS injection and resolves each identity once per snapshot', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    session.replaceStylesheet({ id: '/project/a.gss', source: '.card { background-image: url(icon.svg); }',
      assetReferences: [{ url: 'icon.svg', identity: 'icon.svg' }] });
    const url = '/assets/a"); color: red; } /*\\\n.svg';
    let calls = 0;
    const snapshot = session.finalize({ resolveAssetUrl: () => { calls += 1; return url; } });
    expect(calls).toBe(1);
    const declarations: string[] = [];
    postcss.parse(snapshot.css).walkDecls((declaration) => { declarations.push(declaration.prop); });
    expect(declarations).toEqual(['background-image']);
    const decoded = discoverStylesheetAssets({ id: '/project/output.gss',
      source: `.card { background-image: ${snapshot.manifest.rules[0]!.value}; }` });
    expect(decoded.urls).toEqual([url]);
    expect(decoded.diagnostics).toEqual([]);
  });

  it('preserves unbound data, remote and fragment URLs and ignores URL-like text', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const source = `.card { background-image: url("data:image/png;base64,AAAA"), url(https://example.test/a.svg?q=1#x), url(#mask); content: "url(fake.svg)"; }`;
    const result = session.replaceStylesheet({ id: '/project/a.gss', source });
    expect(result.module?.dependencies).toEqual(['data:image/png;base64,AAAA', 'https://example.test/a.svg?q=1#x', '#mask']);
    const snapshot = session.finalize({ resolveAssetUrl: () => { throw new Error('Must not resolve unbound URLs.'); } });
    expect(snapshot.css).toContain('url(#mask)');
    expect(snapshot.css).toContain('"url(fake.svg)"');
  });

  it('uses decoded binding keys and does not retain mutable caller references', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const reference = { url: './a b.svg', identity: 'assets/a b.svg' };
    const result = session.replaceStylesheet({ id: '/project/a.gss',
      source: '.card { future-paint: url("./a\\20 b.svg"); }', assetReferences: [reference] });
    expect(result.committed).toBe(true);
    expect(result.module?.dependencies).toEqual(['./a b.svg']);
    reference.identity = 'changed.svg';
    const snapshot = session.finalize({ resolveAssetUrl: (id) => `/out/${id}` });
    expect(snapshot.css).toContain('url("/out/assets/a b.svg")');
  });

  it('returns parse diagnostics during discovery without a session or IO', () => {
    const result = discoverStylesheetAssets({ id: '/project/broken.gss', source: '.card {' });
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ id: '/project/broken.gss', severity: 'error' })]));
  });

  it.each([
    [{ url: '', identity: 'icon.svg' }],
    [{ url: './icon.svg', identity: '' }],
    [{ url: './icon.svg', identity: 'one.svg' }, { url: './icon.svg', identity: 'two.svg' }],
    [{ url: './typo.svg', identity: 'icon.svg' }]
  ])('rejects invalid bindings transactionally: %j', (...assetReferences) => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const id = '/project/Card.gss';
    const prior = session.replaceStylesheet({ id, source: '.card { color: red; }' });
    const snapshot = session.finalize();
    const result = session.replaceStylesheet({ id, source: '.card { background-image: url(./icon.svg); }', assetReferences });
    expect(result.committed).toBe(false);
    expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'GSS1501', severity: 'error' })]));
    expect(session.finalize()).toEqual(snapshot);
    expect(session.getScopeSchema(id)).toEqual(prior.module?.scopeSchema);
  });

  it('discovers decoded URLs in declarations, keyframes and font faces without reading files', () => {
    const result = discoverStylesheetAssets({ id: '/project/Card.gss', source: `
      .card { background-image: url("./icons/a\\20 b.svg?theme=dark#icon"); content: "url(fake.png)"; }
      @keyframes spin { to { background-image: URL(./frame.png); } }
      @font-face { font-family: "Demo"; src: url('./font.woff2') format('woff2'); }
    ` });
    expect(result.diagnostics).toEqual([]);
    expect(result.urls).toEqual(['./icons/a b.svg?theme=dark#icon', './frame.png', './font.woff2']);
  });
});
