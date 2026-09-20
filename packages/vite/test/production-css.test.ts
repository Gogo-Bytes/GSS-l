import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { build, normalizePath, type InlineConfig, type Rollup } from 'vite';
import { react } from '@gss-l/react';
import { gss } from '../src/index.js';

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
    version: 1, cssAsset,
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
  const rejected = expect(next).rejects.toThrow(/GSS2102.*styles.card/);
  await writeFile(join(root, 'Card.gss'), '.panel { color: blue; }');
  await rejected;
}, 15000);
