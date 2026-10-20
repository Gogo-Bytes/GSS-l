import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { build, createServer, normalizePath, resolveConfig, type InlineConfig, type Rollup } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { react } from '@gss-l/react';
import { gss } from '../src/index.js';
import { resolveViteCssTargets } from '../src/css-targets.js';

const roots: string[] = [];
const watchers: Rollup.RollupWatcher[] = [];
afterEach(async () => {
  await Promise.all(watchers.splice(0).map((watcher) => watcher.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(files: Record<string, string> = {}) {
  const root = normalizePath(await realpath(await mkdtemp(join(tmpdir(), 'gss-production-'))));
  roots.push(root);
  for (const [name, source] of Object.entries({
    'index.html': '<!doctype html><html><head><meta name="preserve-me" content="yes"></head><body><script type="module" src="/main.ts"></script></body></html>',
    'main.ts': `import styles from './Card.gss'; document.body.className = styles.card.self;`,
    'Card.gss': '.card { color: red; }',
    ...files
  })) {
    await mkdir(dirname(join(root, name)), { recursive: true });
    await writeFile(join(root, name), source);
  }
  return root;
}

async function bundle(root: string, config: InlineConfig = {}): Promise<Rollup.RollupOutput> {
  const result = await build({
    root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
    ...config,
    build: { write: false, minify: false, ...config.build }
  });
  if (Array.isArray(result) || !('output' in result)) throw new Error('Expected one bundle.');
  return result;
}

function asset(output: Rollup.RollupOutput, name: string): string {
  const entry = output.output.find((item) => item.fileName === name);
  if (entry?.type !== 'asset') throw new Error(`Missing asset ${name}.`);
  return typeof entry.source === 'string' ? entry.source : new TextDecoder().decode(entry.source);
}

it('emits one central CSS asset and injects its final name into built HTML', async () => {
  const output = await bundle(await fixture());
  const stylesheets = output.output.filter((entry) => entry.fileName.endsWith('.css'));
  expect(stylesheets).toHaveLength(1);
  const cssName = stylesheets[0]!.fileName;
  expect(cssName).toMatch(/^assets\/gss-[\w-]+\.css$/);
  expect(asset(output, cssName)).toContain('color: red;');
  const html = asset(output, 'index.html');
  expect(html).toContain(`href="/${cssName}"`);
  expect(html).toContain('<meta name="preserve-me" content="yes">');
  expect(html).not.toContain('/@gss-l/central.css');
});

it('links a Vite-managed SSG React render to the same production CSS and class names', async () => {
  const root = await fixture({
    'index.html': '<!doctype html><html><head></head><body><div id="app"><!--ssg--></div><script type="module" src="/main.tsx"></script></body></html>',
    'App.tsx': `import React from 'react'; import styles from './Card.gss';
      export function App() { return <div className={styles.card.self + ' external'}>Hello</div>; }`,
    'entry-server.tsx': `export { App } from './App';`,
    'main.tsx': `import React from 'react'; import { hydrateRoot } from 'react-dom/client';
      import { App } from './App'; hydrateRoot(document.getElementById('app')!, <App />);`
  });
  await symlink(join(process.cwd(), 'node_modules'), join(root, 'node_modules'), 'dir');
  const server = await createServer({ root, configFile: false, plugins: [gss({ adapter: react() })],
    logLevel: 'silent', server: { middlewareMode: true } });
  let rendered: string;
  try {
    const { App } = await server.ssrLoadModule('/entry-server.tsx');
    rendered = renderToString(createElement(App));
  } finally {
    await server.close();
  }
  const output = await bundle(root);
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  const html = asset(output, 'index.html').replace('<!--ssg-->', rendered);
  expect(html).toContain(`href="/${manifest.cssAsset}"`);
  const className = /class="([^"]+)"/.exec(rendered)?.[1];
  expect(className).toBeTruthy();
  expect(className).toContain(' external');
  const ownedClass = className!.split(' ')[0]!;
  expect(asset(output, manifest.cssAsset)).toContain(`.${ownedClass} {`);
  expect(output.output.filter((entry) => entry.type === 'chunk').map((entry) => entry.code).join('\n'))
    .toContain(ownedClass);
  expect(html).toContain(rendered);
});

it('repeats target-aware production CSS, manifest and emitted Asset bytes across clean builds', async () => {
  const root = await fixture({
    'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"/>',
    'Card.gss': '@property --tone { syntax: "<color>"; inherits: false; initial-value: red; } .card { background-image: url(./icon.svg); display: flex; }',
    'Fallback.gss': '.other { flex-direction: column; color: blue; }',
    'main.ts': `import card from './Card.gss'; import fallback from './Fallback.gss';
      document.body.className = card.card.self + ' ' + fallback.other.self;`
  });
  const config: InlineConfig = { build: { minify: true, cssTarget: 'safari6' } };
  const first = await bundle(root, config);
  const second = await bundle(root, config);
  const artifacts = (output: Rollup.RollupOutput) => output.output
    .filter((entry) => entry.type === 'asset')
    .map((entry) => [entry.fileName, asset(output, entry.fileName)]);
  expect(artifacts(second)).toEqual(artifacts(first));
  const manifest = JSON.parse(asset(first, 'gss-manifest.json'));
  expect(asset(first, manifest.cssAsset)).toContain('display: -webkit-box;');
  expect(manifest.compiler.moduleDetails).toEqual([
    expect.objectContaining({ compilationMode: 'atomic' }),
    expect.objectContaining({ compilationMode: 'preserved' })
  ]);
  expect(first.output.some((entry) => entry.type === 'asset' && entry.fileName.endsWith('.svg'))).toBe(true);
});

it.each([
  ['ease', 'ease 2s'],
  ['auto', 'auto 2s'],
  ['--spin', '--spin 2s']
])('rejects keyword-colliding local keyframe %s shorthand in a real Vite build', async (name, shorthand) => {
  const root = await fixture({
    'Card.gss': `@keyframes ${name} { to { opacity: 1; } } .card { animation: ${shorthand}; }`
  });
  await expect(bundle(root)).rejects.toThrow(/GSS1101[^\n]*animation shorthand/);
  const accepted = await bundle(await fixture({
    'Card.gss': '@keyframes ease { to { opacity: 1; } } .card { animation-name: ease; animation-duration: 2s; }'
  }));
  const css = asset(accepted, JSON.parse(asset(accepted, 'gss-manifest.json')).cssAsset);
  expect(css).toContain('animation-name: gss-k--module_Card_2e_gss--name_ease;');
});

it('links the emitted CSS to a map with original GSS contents and logical source ids', async () => {
  const source = '.card { color: red; }';
  const output = await bundle(await fixture({ 'Card.gss': source }));
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  const css = asset(output, manifest.cssAsset);
  const map = JSON.parse(asset(output, 'gss.css.map'));
  expect(map).toMatchObject({ version: 3, file: manifest.cssAsset,
    sources: ['Card.gss'], sourcesContent: [source] });
  expect(css).toContain('/*# sourceMappingURL=../gss.css.map */');
  expect(JSON.stringify(map)).not.toContain('/gss-production-');
});

it('links a nested CSS filename to the root map without changing the map source ids', async () => {
  const output = await bundle(await fixture(), {
    build: { rollupOptions: { output: { assetFileNames: 'static/deep/gss.css' } } }
  });
  expect(asset(output, 'static/deep/gss.css')).toContain('sourceMappingURL=../../gss.css.map');
  expect(JSON.parse(asset(output, 'gss.css.map'))).toMatchObject({
    file: 'static/deep/gss.css', sources: ['Card.gss']
  });
});

it('takes compatibility targets from the resolved Vite CSS build settings', async () => {
  const root = await fixture({ 'Card.gss': '.card { display: flex; }' });
  const old = await bundle(root, { build: { minify: true, cssTarget: 'safari6' } });
  const modern = await bundle(root, { build: { minify: true, cssTarget: 'safari17' } });
  const oldCss = asset(old, JSON.parse(asset(old, 'gss-manifest.json')).cssAsset);
  const modernCss = asset(modern, JSON.parse(asset(modern, 'gss-manifest.json')).cssAsset);
  expect(oldCss).toContain('display: -webkit-box;\n  display: -webkit-flex;\n  display: flex;');
  expect(modernCss).toContain('display: flex;');
  expect(modernCss).not.toContain('display: -webkit-box;');
  expect(JSON.parse(asset(old, 'gss-manifest.json')).compiler.rules[0].className)
    .toBe(JSON.parse(asset(modern, 'gss-manifest.json')).compiler.rules[0].className);
});

it('retains both ordered Vite Lightning CSS transformation and CSS minification targets', async () => {
  const root = await fixture({ 'Card.gss': '.card { display: flex; }' });
  const output = await bundle(root, {
    css: { transformer: 'lightningcss', lightningcss: { targets: { safari: 17 << 16 } } },
    build: { minify: true, cssMinify: 'lightningcss', cssTarget: 'safari6' }
  });
  const css = asset(output, JSON.parse(asset(output, 'gss-manifest.json')).cssAsset);
  expect(css).toContain('display: -webkit-box;\n  display: -webkit-flex;\n  display: flex;');
});

it('uses Vite’s oldest supported version when one CSS browser target is repeated', async () => {
  const root = await fixture({ 'Card.gss': '.card { display: flex; }' });
  const output = await bundle(root, {
    build: { minify: true, cssMinify: 'lightningcss', cssTarget: ['safari17', 'safari6'] }
  });
  const css = asset(output, JSON.parse(asset(output, 'gss-manifest.json')).cssAsset);
  expect(css).toContain('display: -webkit-box;');
});

it('ignores esnext alongside concrete CSS browser targets as Vite does', async () => {
  const root = await fixture({ 'Card.gss': '.card { display: flex; }' });
  const output = await bundle(root, { build: { minify: true, cssMinify: 'lightningcss',
    cssTarget: ['esnext', 'safari6'] } });
  const css = asset(output, JSON.parse(asset(output, 'gss-manifest.json')).cssAsset);
  expect(css).toContain('display: -webkit-box;');
});

it('ignores non-browser Vite CSS targets without weakening a concrete browser target', async () => {
  const root = await fixture({ 'Card.gss': '.card { display: flex; }' });
  const output = await bundle(root, { build: { minify: true, cssMinify: 'lightningcss',
    cssTarget: ['node20', 'safari6'] } });
  const css = asset(output, JSON.parse(asset(output, 'gss-manifest.json')).cssAsset);
  expect(css).toContain('display: -webkit-box;');
});

it('normalizes Lightning CSS minifier patch targets exactly as Vite resolves them', async () => {
  const root = await fixture({ 'Card.gss': '.card { display: flex; }' });
  const config = await resolveConfig({ root, configFile: false,
    build: { minify: true, cssMinify: 'lightningcss', cssTarget: 'safari6.0.1' }
  }, 'build');
  expect(resolveViteCssTargets(config)).toEqual({ stages: [{ safari: '6.0.0' }] });
  const output = await bundle(root, { build: { minify: true, cssMinify: 'lightningcss', cssTarget: 'safari6.0.1' } });
  expect(asset(output, JSON.parse(asset(output, 'gss-manifest.json')).cssAsset)).toContain('display: -webkit-box;');
});

it('maps the supported Vite browser target families into one effective stage', async () => {
  const root = await fixture();
  const config = await resolveConfig({ root, configFile: false,
    build: { minify: true, cssMinify: 'lightningcss', cssTarget: ['chrome40', 'firefox30', 'ios9'] }
  }, 'build');
  expect(resolveViteCssTargets(config)).toEqual({ stages: [{
    chrome: '40.0.0', firefox: '30.0.0', ios_saf: '9.0.0'
  }] });
});

it('fails closed for a CSS target that has no browser-version mapping', async () => {
  const root = await fixture({ 'Card.gss': '.card { display: flex; }' });
  await expect(bundle(root, { build: { minify: true, cssTarget: 'es2015' } }))
    .rejects.toThrow(/GSS cannot follow Vite CSS targets: Cannot map Vite CSS target es2015/);
});

it('keeps transformed resources and bound Assets in the Vite target-aware final census', async () => {
  const root = await fixture({
    'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"/>',
    'Card.gss': `
      @keyframes move { to { opacity: 1; } }
      @property --tone { syntax: "<color>"; inherits: false; initial-value: red; }
      .card { animation-name: move; background-image: url("./icon.svg"); color: var(--tone); display: flex; }
    `
  });
  const output = await bundle(root, { build: { minify: true, cssTarget: 'safari6' } });
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  const css = asset(output, manifest.cssAsset);
  expect(manifest.compiler.moduleDetails).toMatchObject([{ compilationMode: 'preserved',
    fallbackReasons: [{ property: 'animation-name', reason: 'compatibility-sequence-unatomizable' }] }]);
  expect(css).toContain('@-webkit-keyframes');
  expect(css).toContain('@keyframes');
  expect(css).toContain('@property --tone');
  expect(css).toContain('-webkit-animation-name:');
  expect(css).toMatch(/background-image: url\("\/assets\/icon-[^";]+\.svg"\)/);
  expect(css).toContain('display: -webkit-box;');
});

it('keeps compatibility fallback isolated while a second Module remains atomic with an Asset', async () => {
  const root = await fixture({
    'main.ts': `import card from './Card.gss'; import other from './Other.gss'; document.body.className = card.card.self + ' ' + other.other.self;`,
    'Card.gss': '.card { flex-direction: column; color: red; }',
    'Other.gss': '.other { display: flex; background-image: url("./icon.svg"); }',
    'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"/>'
  });
  const output = await bundle(root, { build: { minify: true, cssTarget: 'safari6' } });
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  const css = asset(output, manifest.cssAsset);
  expect(manifest.compiler.moduleDetails).toEqual([
    { id: 'Card.gss', compilationMode: 'preserved',
      fallbackReasons: [{ property: 'flex-direction', reason: 'compatibility-sequence-unatomizable' }] },
    { id: 'Other.gss', compilationMode: 'atomic', fallbackReasons: [] }
  ]);
  expect(css).toContain('-webkit-flex-direction: column;');
  expect(css).toContain('flex-direction: column;');
  expect(css).toContain('display: -webkit-box;');
  expect(css).toMatch(/background-image: url\("\/assets\/icon-[^";]+\.svg"\)/);
  expect(manifest.compiler.rules).toHaveLength(2);
  expect(manifest.compiler.rules.map((rule: { property: string }) => rule.property).sort())
    .toEqual(['background-image', 'display']);
});

it('includes lazy Modules in one asset and exports matching manifest/report snapshots', async () => {
  const root = await fixture({
    'main.ts': `import styles from './Card.gss'; document.body.className = styles.card.self; document.body.onclick = () => import('./lazy');`,
    'lazy.ts': `import styles from './Lazy.gss'; export const lazyClass = styles.lazy.self;`,
    'Lazy.gss': '.lazy { future-paint: blue; }'
  });
  const output = await bundle(root);
  const css = output.output.filter((entry) => entry.fileName.endsWith('.css'));
  expect(css).toHaveLength(1);
  const cssAsset = css[0]!.fileName;
  expect(asset(output, cssAsset)).toContain('future-paint: blue;');
  for (const entry of output.output) {
    if (entry.type === 'chunk') {
      expect(entry.code).not.toContain(cssAsset);
      expect(entry.code).not.toMatch(/@gss-l\/central|Proxy/);
    }
  }
  expect(JSON.parse(asset(output, 'gss-manifest.json'))).toMatchObject({
    version: 2, cssAsset,
    compiler: {
      modules: ['Card.gss', 'Lazy.gss'],
      moduleDetails: [
        { id: 'Card.gss', compilationMode: 'atomic', fallbackReasons: [] },
        { id: 'Lazy.gss', compilationMode: 'preserved', fallbackReasons: [
          { property: 'future-paint', reason: 'property-effect-not-registered' }
        ] }
      ]
    }
  });
  expect(JSON.parse(asset(output, 'gss-manifest.json')).compiler).toMatchObject({
    rules: [{ origins: [{ moduleId: 'Card.gss', range: { start: 8, end: 19 } }] }],
    preservedRules: [{ moduleId: 'Lazy.gss', range: { start: 0, end: '.lazy { future-paint: blue; }'.length } }]
  });
  expect(JSON.parse(asset(output, 'gss-report.json'))).toEqual({
    version: 1, cssAsset,
    compiler: { modules: 2, rules: 1, resources: 0, atomicModules: 1, preservedModules: 1, atomicCoverage: 0.5 }
  });
});

it.each([
  { base: '/', rootPrefix: '/', nestedPrefix: '/' },
  { base: '/app/', rootPrefix: '/app/', nestedPrefix: '/app/' },
  { base: './', rootPrefix: './', nestedPrefix: '../' },
  { base: '', rootPrefix: './', nestedPrefix: '../' },
  { base: 'https://cdn.example/app/', rootPrefix: 'https://cdn.example/app/', nestedPrefix: 'https://cdn.example/app/' }
])('shares one asset across MPA entries with base "$base" and custom asset names', async ({ base, rootPrefix, nestedPrefix }) => {
  const root = await fixture({
    'nested/page.html': '<!doctype html><html><head></head><body><script type="module" src="../secondary.ts"></script></body></html>',
    'secondary.ts': `import styles from './Other.gss'; document.body.className = styles.other.self;`,
    'Other.gss': '.other { display: flex; }'
  });
  const output = await bundle(root, { base, build: { rollupOptions: {
    input: { main: `${root}/index.html`, other: `${root}/nested/page.html` },
    output: { assetFileNames: 'static files/[name]-[hash][extname]' }
  } } });
  const stylesheets = output.output.filter((entry) => entry.fileName.endsWith('.css'));
  expect(stylesheets).toHaveLength(1);
  const cssAsset = stylesheets[0]!.fileName;
  expect(cssAsset).toMatch(/^static files\/gss-/);
  const urlPath = cssAsset.replace('static files/', 'static%20files/');
  for (const [htmlName, prefix] of [['index.html', rootPrefix], ['nested/page.html', nestedPrefix]]) {
    const html = asset(output, htmlName!);
    expect(html).toContain(`href="${prefix}${urlPath}"`);
    expect(html.match(/<link rel="stylesheet"/g)).toHaveLength(1);
  }
  expect(asset(output, cssAsset)).toContain('color: red;');
  expect(asset(output, cssAsset)).toContain('display: flex;');
  expect(JSON.parse(asset(output, 'gss-manifest.json'))).toMatchObject({ cssAsset });
});

it('excludes precompiled type-only imports that are absent from the Rollup census', async () => {
  const output = await bundle(await fixture({
    'main.ts': `import type ghost from './Ghost.gss'; import styles from './Card.gss'; const card: typeof ghost.ghost = styles.card; document.body.className = card.self;`,
    'Ghost.gss': '.ghost { color: blue; }'
  }));
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  expect(manifest.compiler.modules).toEqual(['Card.gss']);
  expect(asset(output, manifest.cssAsset)).not.toContain('color: blue;');
});

it('excludes speculative Rollup loads that have no path from an entry', async () => {
  const root = await fixture({ 'Ghost.gss': '.ghost { color: blue; }' });
  const output = await bundle(root, { plugins: [gss({ adapter: react() }), {
    name: 'speculative-loader',
    async buildStart() {
      const resolved = await this.resolve('./Ghost.gss', `${root}/main.ts`);
      if (!resolved) throw new Error('Expected speculative dependency resolution.');
      await this.load({ id: resolved.id });
    }
  }] });
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  expect(manifest.compiler.modules).toEqual(['Card.gss']);
  expect(asset(output, manifest.cssAsset)).not.toContain('color: blue;');
});

it.each([
  `document.body.textContent = 'No GSS';`,
  `import type ghost from './Card.gss'; const empty: typeof ghost.card | undefined = undefined; document.body.textContent = String(empty);`
])('emits no GSS assets or links for an empty reachable census', async (main) => {
  const output = await bundle(await fixture({ 'main.ts': main }));
  expect(output.output.some((entry) => /\.css$|gss-manifest|gss-report/.test(entry.fileName))).toBe(false);
  expect(asset(output, 'index.html')).not.toContain('rel="stylesheet"');
});

it('uses the compiled source snapshot rather than rereading files at generateBundle', async () => {
  const root = await fixture();
  const output = await bundle(root, { plugins: [gss({ adapter: react() }), {
    name: 'change-after-module-loading',
    async buildEnd() { await writeFile(join(root, 'Card.gss'), '.card { color: blue; }'); }
  }] });
  expect(await readFile(join(root, 'Card.gss'), 'utf8')).toContain('blue');
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  expect(asset(output, manifest.cssAsset)).toContain('color: red;');
  expect(asset(output, manifest.cssAsset)).not.toContain('color: blue;');
  expect(output.output.some((entry) => entry.type === 'chunk' && entry.code.includes('value_red'))).toBe(true);
});

it('keeps CSS and both JSON artifacts byte-stable across workspace relocation', async () => {
  const outputs: Record<string, string>[] = [];
  for (let index = 0; index < 2; index += 1) {
    const workspace = await fixture({
      'app/index.html': '<html><head></head><body><script type="module" src="/main.ts"></script></body></html>',
      'app/main.ts': `import styles from '../shared/Card.gss'; document.body.className = styles.card.self;`,
      'shared/Card.gss': '.card { future-paint: blue; }'
    });
    const output = await bundle(`${workspace}/app`);
    const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
    expect(manifest.compiler.modules).toEqual(['../shared/Card.gss']);
    outputs.push(Object.fromEntries([manifest.cssAsset, 'gss-manifest.json', 'gss-report.json']
      .map((name) => [name, asset(output, name)])));
  }
  expect(outputs[0]).toEqual(outputs[1]);
});

it('emits an empty CSS asset when reachable style Modules contribute no rules', async () => {
  const output = await bundle(await fixture({ 'Card.gss': '.card {}' }));
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  expect(manifest.compiler.modules).toEqual(['Card.gss']);
  expect(asset(output, manifest.cssAsset)).toBe('');
  expect(output.output.some((entry) => entry.fileName === 'gss.css.map')).toBe(false);
  expect(JSON.parse(asset(output, 'gss-report.json')).compiler).toMatchObject({ modules: 1, rules: 0 });
});

it('injects into an HTML fragment without replacing existing markup', async () => {
  const html = '<!doctype html><!-- keep --><div id="app">Hello &amp; goodbye</div><script type="module" src="/main.ts"></script>';
  const output = await bundle(await fixture({ 'index.html': html }));
  const result = asset(output, 'index.html');
  expect(result).toContain('<head><link rel="stylesheet"');
  expect(result).toContain('<!-- keep -->');
  expect(result).toContain('<div id="app">Hello &amp; goodbye</div>');
});

it('does not duplicate an existing central link inserted by the Vite HTML pipeline', async () => {
  const output = await bundle(await fixture(), {
    plugins: [gss({ adapter: react() }), {
      name: 'html-link',
      transformIndexHtml: { order: 'post', handler: () => [{
        tag: 'link', attrs: { rel: 'stylesheet', href: '/static/gss.css' }, injectTo: 'head'
      }] }
    }],
    build: { rollupOptions: { output: { assetFileNames: 'static/gss.css' } } }
  });
  expect(asset(output, 'index.html').match(/href="\/static\/gss.css"/g)).toHaveLength(1);
});

it('rejects a collision with its fixed CSS map output instead of overwriting another asset', async () => {
  const root = await fixture();
  await expect(bundle(root, { plugins: [gss({ adapter: react() }), {
    name: 'conflicting-map', generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'gss.css.map', source: 'not ours' });
    }
  }] })).rejects.toThrow(/GSS output.*gss\.css\.map.*already exists/);
});

it('rejects a collision with its fixed manifest output instead of overwriting another asset', async () => {
  const root = await fixture();
  await expect(bundle(root, { plugins: [gss({ adapter: react() }), {
    name: 'conflicting-output', generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'gss-manifest.json', source: 'another plugin owns this' });
    }
  }] })).rejects.toThrow(/GSS output.*gss-manifest.json.*already exists/);
});

function nextWatchBuild(watcher: Rollup.RollupWatcher): Promise<void> {
  return new Promise((resolve, reject) => {
    function receive(event: Rollup.RollupWatcherEvent) {
      if (event.code === 'BUNDLE_END') {
        watcher.off('event', receive);
        resolve();
      } else if (event.code === 'ERROR') {
        watcher.off('event', receive);
        reject(event.error);
      }
    }
    watcher.on('event', receive);
  });
}

it('rebuilds target-derived compatibility CSS from the current watch census', async () => {
  const root = await fixture({ 'Card.gss': '.card { display: flex; }' });
  const watcher = await build({ root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
    build: { minify: true, cssTarget: 'safari6', watch: { buildDelay: 20 } } });
  if (!('on' in watcher)) throw new Error('Expected Rollup watcher.');
  watchers.push(watcher);
  await nextWatchBuild(watcher);
  const readCss = async () => {
    const manifest = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
    return readFile(join(root, 'dist', manifest.cssAsset), 'utf8');
  };
  const initial = await readCss();
  expect(initial).toContain('display: -webkit-box;');
  const changed = nextWatchBuild(watcher);
  await writeFile(join(root, 'Card.gss'), '.card { display: block; }');
  await changed;
  expect(await readCss()).toContain('display: block;');
  expect(await readCss()).not.toContain('display: -webkit-box;');
  const restored = nextWatchBuild(watcher);
  await writeFile(join(root, 'Card.gss'), '.card { display: flex; }');
  await restored;
  expect(await readCss()).toBe(initial);
}, 15000);

it('rebuilds compatibility fallback and bound Assets from the current watch census', async () => {
  const root = await fixture({
    'main.ts': `import a from './Card.gss'; import b from './Other.gss'; document.body.className = a.card.self + b.other.self;`,
    'Card.gss': '.card { flex-direction: column; background-image: url("./icon.svg"); }',
    'Other.gss': '.other { display: flex; }',
    'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>'
  });
  const watcher = await build({ root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
    build: { minify: true, cssTarget: 'safari6', watch: { buildDelay: 20 } } });
  if (!('on' in watcher)) throw new Error('Expected Rollup watcher.');
  watchers.push(watcher);
  await nextWatchBuild(watcher);
  const readSnapshot = async () => {
    const manifest = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
    const css = await readFile(join(root, 'dist', manifest.cssAsset), 'utf8');
    const report = JSON.parse(await readFile(join(root, 'dist/gss-report.json'), 'utf8'));
    const map = JSON.parse(await readFile(join(root, 'dist/gss.css.map'), 'utf8'));
    return { manifest, css, report, map };
  };
  const cleanSnapshot = async () => {
    const output = await bundle(root, { build: { minify: true, cssTarget: 'safari6' } });
    const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
    return { manifest, css: asset(output, manifest.cssAsset),
      report: JSON.parse(asset(output, 'gss-report.json')),
      map: JSON.parse(asset(output, 'gss.css.map')) };
  };
  const initial = await readSnapshot();
  expect(initial.manifest.compiler.moduleDetails).toMatchObject([
    { id: 'Card.gss', compilationMode: 'preserved' }, { id: 'Other.gss', compilationMode: 'atomic' }
  ]);
  expect(initial.css).toContain('-webkit-flex-direction: column;');
  expect(initial.css).toMatch(/background-image: url\("\/assets\/icon-[^";]+\.svg"\)/);
  expect(initial).toEqual(await cleanSnapshot());

  const changed = nextWatchBuild(watcher);
  await writeFile(join(root, 'main.ts'), `import b from './Other.gss'; document.body.className = b.other.self;`);
  await changed;
  const remaining = await readSnapshot();
  expect(remaining.manifest.compiler.modules).toEqual(['Other.gss']);
  expect(remaining.css).toContain('display: -webkit-box;');
  expect(remaining.css).not.toMatch(/flex-direction|icon\.svg/);
  expect(remaining.map.sources).toEqual(['Other.gss']);
  expect(remaining.map.sourcesContent).toEqual(['.other { display: flex; }']);
  expect(remaining).toEqual(await cleanSnapshot());

  const restored = nextWatchBuild(watcher);
  await writeFile(join(root, 'main.ts'), `import a from './Card.gss'; import b from './Other.gss'; document.body.className = a.card.self + b.other.self;`);
  await restored;
  expect(await readSnapshot()).toEqual(initial);
  expect(await readSnapshot()).toEqual(await cleanSnapshot());
}, 15000);

it('converges a shared lazy Module across direct and React HTML entries during watch removal and restoration', async () => {
  const directWithLazy = `import card from './Card.gss'; document.body.className = card.card.self;
    document.body.onclick = () => import('./lazy');`;
  const directWithoutLazy = `import card from './Card.gss'; document.body.className = card.card.self;`;
  const reactWithLazy = `import React from 'react'; import { createRoot } from 'react-dom/client';
    import shell from './Shell.gss'; const Lazy = React.lazy(() => import('./LazyPane'));
    createRoot(document.getElementById('app')!).render(<section className={shell.shell.self + ' external'}>
      <React.Suspense fallback={<span>Loading</span>}><Lazy /></React.Suspense></section>);`;
  const reactWithoutLazy = `import React from 'react'; import { createRoot } from 'react-dom/client';
    import shell from './Shell.gss';
    createRoot(document.getElementById('app')!).render(<section className={shell.shell.self + ' external'}>Ready</section>);`;
  const root = await fixture({
    'main.ts': directWithLazy,
    'other.html': '<!doctype html><html><head></head><body><div id="app"></div><script type="module" src="/react-entry.tsx"></script></body></html>',
    'react-entry.tsx': reactWithLazy,
    'lazy.ts': `import lazy from './Lazy.gss'; export const className = lazy.lazy.self;`,
    'LazyPane.tsx': `import React from 'react'; import lazy from './Lazy.gss';
      export default function LazyPane() { return <div className={lazy.lazy.self + ' external-lazy'}>Lazy</div>; }`,
    'Card.gss': '.card { color: red; }',
    'Shell.gss': '.shell { color: green; }',
    'Lazy.gss': '.lazy { color: blue; }'
  });
  await symlink(join(process.cwd(), 'node_modules'), join(root, 'node_modules'), 'dir');
  const input = { index: join(root, 'index.html'), other: join(root, 'other.html') };
  const expectOnlyCurrentStylesheet = (html: string, cssAsset: string) => {
    const hrefs = [...html.matchAll(/<link\b[^>]*>/g)]
      .map(([tag]) => tag)
      .filter((tag) => /\brel=(['"])stylesheet\1/.test(tag))
      .map((tag) => /\bhref=(['"])(.*?)\1/.exec(tag)?.[2]);
    expect(hrefs).toEqual([`/${cssAsset}`]);
  };
  const watcher = await build({ root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
    build: { minify: false, rollupOptions: { input }, watch: { buildDelay: 20 } } });
  if (!('on' in watcher)) throw new Error('Expected Rollup watcher.');
  watchers.push(watcher);
  const readSnapshot = async () => {
    const manifest = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
    const css = await readFile(join(root, 'dist', manifest.cssAsset), 'utf8');
    const report = JSON.parse(await readFile(join(root, 'dist/gss-report.json'), 'utf8'));
    const map = JSON.parse(await readFile(join(root, 'dist/gss.css.map'), 'utf8'));
    for (const html of ['index.html', 'other.html']) {
      expectOnlyCurrentStylesheet(await readFile(join(root, 'dist', html), 'utf8'), manifest.cssAsset);
    }
    return { manifest, css, report, map };
  };
  const cleanSnapshot = async () => {
    const output = await bundle(root, { build: { rollupOptions: { input } } });
    const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
    for (const html of ['index.html', 'other.html']) {
      expectOnlyCurrentStylesheet(asset(output, html), manifest.cssAsset);
    }
    return { manifest, css: asset(output, manifest.cssAsset),
      report: JSON.parse(asset(output, 'gss-report.json')),
      map: JSON.parse(asset(output, 'gss.css.map')) };
  };
  await nextWatchBuild(watcher);
  const initial = await readSnapshot();
  expect(initial.manifest.compiler.modules).toEqual(['Card.gss', 'Lazy.gss', 'Shell.gss']);
  expect(initial.css).toContain('color: blue;');
  expect(initial.map.sources).toContain('Lazy.gss');
  expect(initial).toEqual(await cleanSnapshot());

  const oneConsumer = nextWatchBuild(watcher);
  await writeFile(join(root, 'main.ts'), directWithoutLazy);
  await oneConsumer;
  const shared = await readSnapshot();
  expect(shared).toEqual(initial);
  expect(shared).toEqual(await cleanSnapshot());

  const noConsumers = nextWatchBuild(watcher);
  await writeFile(join(root, 'react-entry.tsx'), reactWithoutLazy);
  await noConsumers;
  const removed = await readSnapshot();
  expect(removed.manifest.compiler.modules).toEqual(['Card.gss', 'Shell.gss']);
  expect(removed.css).not.toContain('color: blue;');
  expect(removed.map.sources).not.toContain('Lazy.gss');
  expect(removed).toEqual(await cleanSnapshot());

  const restoredDirect = nextWatchBuild(watcher);
  await writeFile(join(root, 'main.ts'), directWithLazy);
  await restoredDirect;
  const directOnly = await readSnapshot();
  expect(directOnly).toEqual(initial);
  expect(directOnly).toEqual(await cleanSnapshot());

  const restoredReact = nextWatchBuild(watcher);
  await writeFile(join(root, 'react-entry.tsx'), reactWithLazy);
  await restoredReact;
  const fullyRestored = await readSnapshot();
  expect(fullyRestored).toEqual(initial);
  expect(fullyRestored).toEqual(await cleanSnapshot());
}, 30000);

it('rebuilds from the current census without retaining removed contributions', async () => {
  const root = await fixture({
    'main.ts': `import a from './Card.gss'; import b from './Other.gss'; document.body.className = a.card.self + b.other.self;`,
    'Card.gss': '.card { future-paint: red; }',
    'Other.gss': '.other { color: blue; }'
  });
  const watcher = await build({
    root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
    build: { minify: false, watch: { buildDelay: 20 } }
  });
  if (!('on' in watcher)) throw new Error('Expected Rollup watcher.');
  watchers.push(watcher);
  await nextWatchBuild(watcher);
  expect(JSON.parse(await readFile(join(root, 'dist/gss-report.json'), 'utf8')).compiler.modules).toBe(2);
  const next = nextWatchBuild(watcher);
  await writeFile(join(root, 'main.ts'), `import styles from './Card.gss'; document.body.className = styles.card.self;`);
  await next;
  const manifest = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
  expect(manifest.compiler.modules).toEqual(['Card.gss']);
  expect(await readFile(join(root, 'dist', manifest.cssAsset), 'utf8')).not.toContain('color: blue;');
  const changed = nextWatchBuild(watcher);
  // Preserved CSS can change while the emitted scope JavaScript stays byte-identical.
  await writeFile(join(root, 'Card.gss'), '.card { future-paint: green; }');
  await changed;
  const latest = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
  const css = await readFile(join(root, 'dist', latest.cssAsset), 'utf8');
  expect(css).toContain('future-paint: green;');
  expect(css).not.toContain('future-paint: red;');
}, 15000);

it('revalidates cached JSX against a changed stylesheet schema in watch builds', async () => {
  const root = await fixture({
    'index.html': '<html><head></head><body><script type="module" src="/main.tsx"></script></body></html>',
    'main.tsx': `import styles from './Card.gss'; document.body.append(<div className={styles.card} />);`
  });
  const watcher = await build({
    root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
    build: { minify: false, watch: { buildDelay: 20 } }
  });
  if (!('on' in watcher)) throw new Error('Expected Rollup watcher.');
  watchers.push(watcher);
  await nextWatchBuild(watcher);
  const next = nextWatchBuild(watcher);
  await writeFile(join(root, 'Card.gss'), '.panel { color: blue; }');
  await next;
}, 15000);
