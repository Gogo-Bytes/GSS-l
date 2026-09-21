import { mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
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
  const root = normalizePath(await realpath(await mkdtemp(join(tmpdir(), 'gss-assets-'))));
  roots.push(root);
  for (const [name, source] of Object.entries({
    'index.html': '<html><head></head><body><script type="module" src="/main.ts"></script></body></html>',
    'main.ts': `import styles from './Card.gss'; document.body.className = styles.card.self;`,
    'Card.gss': '.card { background-image: url(./icon.svg); }',
    'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    ...files
  })) {
    await mkdir(dirname(join(root, name)), { recursive: true });
    await writeFile(join(root, name), source);
  }
  return root;
}

async function bundle(root: string, config: InlineConfig = {}): Promise<Rollup.RollupOutput> {
  const result = await build({ root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
    ...config, build: { write: false, minify: false, ...config.build } });
  if (Array.isArray(result) || !('output' in result)) throw new Error('Expected one bundle.');
  return result;
}

function asset(output: Rollup.RollupOutput, name: string): string {
  const entry = output.output.find((item) => item.fileName === name);
  if (entry?.type !== 'asset') throw new Error(`Missing asset ${name}.`);
  return typeof entry.source === 'string' ? entry.source : new TextDecoder().decode(entry.source);
}

it('emits distinct local resources for same-spelling URLs in different source directories without inlining', async () => {
  const root = await fixture({
    'main.ts': `import a from './a/Card.gss'; import b from './b/Card.gss'; document.body.className = a.card.self + b.card.self;`,
    'a/Card.gss': '.card { background-image: url(./icon.svg); }',
    'b/Card.gss': '.card { background-image: url(./icon.svg); }',
    'a/icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="red"/></svg>',
    'b/icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="blue"/></svg>'
  });
  const output = await bundle(root, { build: { assetsInlineLimit: 1000000 } });
  const images = output.output.filter((entry) => entry.fileName.endsWith('.svg'));
  expect(images).toHaveLength(2);
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  expect(manifest.compiler.rules).toHaveLength(2);
  const css = asset(output, manifest.cssAsset);
  for (const image of images) expect(css).toContain(`url("/${image.fileName}")`);
  expect(css).not.toContain('data:');
});

it('rebases publicDir and escaped local URLs while preserving query, fragment and external URLs', async () => {
  const root = await fixture({
    'Card.gss': `.card { background-image: url("./a\\20 b.svg?x=1#shape"), url(/logo.svg?v=2#logo), url(https://example.test/remote.svg), url(#mask), url("data:image/png;base64,AAAA"); }`,
    'a b.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    'static/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>'
  });
  const output = await bundle(root, { base: '/app/', publicDir: 'static' });
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  const css = asset(output, manifest.cssAsset);
  const image = output.output.find((entry) => entry.fileName.endsWith('.svg'))!;
  expect(css).toContain(`url("/app/${image.fileName.replaceAll(' ', '%20')}?x=1#shape")`);
  expect(css).toContain('url("/app/logo.svg?v=2#logo")');
  expect(css).toContain('url(https://example.test/remote.svg)');
  expect(css).toContain('url(#mask)');
  expect(css).toContain('url("data:image/png;base64,AAAA")');
  expect(output.output.filter((entry) => entry.fileName.endsWith('.svg'))).toHaveLength(1);
});

it.each([
  { base: './', prefix: '../../' },
  { base: '', prefix: '../../' },
  { base: '/app/', prefix: '/app/' },
  { base: 'https://cdn.example/app/', prefix: 'https://cdn.example/app/' }
])('resolves asset URLs from the emitted CSS directory with base "$base"', async ({ base, prefix }) => {
  const root = await fixture({
    'Card.gss': '.card { background-image: url(./icon.svg?v=1#icon), url(/logo.svg); }',
    'public/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>'
  });
  const output = await bundle(root, { base, build: { rollupOptions: { output: {
    assetFileNames: (info) => info.names.some((name) => name.endsWith('.css'))
      ? 'styles/deep/[name]-[hash][extname]' : 'images/[name]-[hash][extname]'
  } } } });
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  const css = asset(output, manifest.cssAsset);
  const image = output.output.find((entry) => entry.fileName.endsWith('.svg'))!;
  expect(css).toContain(`url("${prefix}${image.fileName}?v=1#icon")`);
  expect(css).toContain(`url("${prefix}logo.svg")`);
  expect(output.output.filter((entry) => entry.fileName.endsWith('.css'))).toHaveLength(1);
});

it.each(['styles/gss.css', '[hash]/gss.css'])('stabilizes CSS-relative URLs with naming pattern %s', async (pattern) => {
  const output = await bundle(await fixture(), { base: './', build: { rollupOptions: { output: {
    assetFileNames: (info) => info.names.some((name) => name.endsWith('.css')) ? pattern : 'images/[name]-[hash][extname]'
  } } } });
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  const image = output.output.find((entry) => entry.fileName.endsWith('.svg'))!;
  expect(asset(output, manifest.cssAsset)).toContain(`url("../${image.fileName}")`);
  expect(output.output.filter((entry) => entry.fileName.endsWith('.css'))).toHaveLength(1);
});

it.each(['./missing.svg', '/missing.svg'])('fails a build for missing local resource %s', async (url) => {
  const root = await fixture({ 'Card.gss': `.card { background-image: url(${url}); }` });
  await expect(bundle(root)).rejects.toThrow(/Cannot read GSS asset/);
});

it('rejects root URLs when publicDir is disabled', async () => {
  const root = await fixture({ 'Card.gss': '.card { background-image: url(/icon.svg); }' });
  await expect(bundle(root, { publicDir: false })).rejects.toThrow(/publicDir is disabled/);
});

it('emits lazy font resources but excludes assets belonging only to speculative Modules', async () => {
  const root = await fixture({
    'main.ts': `import a from './Card.gss'; document.body.className = a.card.self; document.body.onclick = () => import('./lazy');`,
    'lazy.ts': `import a from './Font.gss'; export const font = a.text.self;`,
    'Font.gss': '@font-face { font-family: "Demo"; src: url(./demo.woff2) format("woff2"); } .text { font-family: "Demo"; }',
    'demo.woff2': 'font-fixture-bytes',
    'Ghost.gss': '.ghost { background-image: url(./ghost.svg); }',
    'ghost.svg': 'unreachable-asset'
  });
  const output = await bundle(root, { plugins: [gss({ adapter: react() }), {
    name: 'speculative-loader', async buildStart() {
      const resolved = await this.resolve('./Ghost.gss', `${root}/main.ts`);
      if (!resolved) throw new Error('Expected dependency.');
      await this.load({ id: resolved.id });
    }
  }] });
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  expect(manifest.compiler.modules).toEqual(['Card.gss', 'Font.gss']);
  const font = output.output.find((entry) => entry.fileName.endsWith('.woff2'))!;
  expect(asset(output, font.fileName)).toBe('font-fixture-bytes');
  expect(asset(output, manifest.cssAsset)).toContain(`url("/${font.fileName}") format("woff2")`);
  expect(output.output.some((entry) => entry.fileName.includes('ghost'))).toBe(false);
});

it('emits the asset bytes captured during Module loading, not later filesystem changes', async () => {
  const root = await fixture();
  const output = await bundle(root, { plugins: [gss({ adapter: react() }), {
    name: 'mutate-after-census', async buildEnd() { await writeFile(join(root, 'icon.svg'), 'changed-after-loading'); }
  }] });
  const image = output.output.find((entry) => entry.fileName.endsWith('.svg'))!;
  expect(asset(output, image.fileName)).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
});

it('fails instead of choosing between inconsistent snapshots of one physical asset', async () => {
  const root = await fixture({
    'main.ts': `import a from './a.gss'; import b from './b.gss'; document.body.className = a.card.self + b.card.self;`,
    'a.gss': '.card { background-image: url(./icon.svg); }',
    'b.gss': '.card { background-image: url(./icon.svg); }'
  });
  await expect(bundle(root, { plugins: [gss({ adapter: react() }), {
    name: 'split-asset-snapshots', async buildStart() {
      for (const name of ['a.gss', 'b.gss']) {
        const resolved = await this.resolve(`./${name}`, `${root}/main.ts`);
        if (!resolved) throw new Error('Expected dependency.');
        await this.load({ id: resolved.id });
        if (name === 'a.gss') await writeFile(join(root, 'icon.svg'), 'changed-between-modules');
      }
    }
  }] })).rejects.toThrow(/Inconsistent GSS asset snapshot/);
});

it('deduplicates canonical file aliases without putting asset bytes into JavaScript', async () => {
  const root = await fixture({
    'main.ts': `import a from './Card.gss'; import b from './Other.gss'; document.body.className = a.card.self + b.card.self;`,
    'Other.gss': '.card { background-image: url(./alias.svg); }'
  });
  await symlink(join(root, 'icon.svg'), join(root, 'alias.svg'));
  const output = await bundle(root);
  const manifest = JSON.parse(asset(output, 'gss-manifest.json'));
  expect(manifest.compiler.rules).toHaveLength(1);
  expect(manifest.compiler.rules[0].sources).toEqual(['Card.gss', 'Other.gss']);
  expect(output.output.filter((entry) => entry.fileName.endsWith('.svg'))).toHaveLength(1);
  for (const entry of output.output) if (entry.type === 'chunk') expect(entry.code).not.toContain('<svg');
});

it('keeps root-external asset names and outputs stable across workspace relocation', async () => {
  const outputs: Record<string, string>[] = [];
  for (let index = 0; index < 2; index += 1) {
    const root = await fixture({
      'app/index.html': '<html><head></head><body><script type="module" src="/main.ts"></script></body></html>',
      'app/main.ts': `import a from './Card.gss'; document.body.className = a.card.self;`,
      'app/Card.gss': '.card { background-image: url(../shared/icon.svg); }',
      'shared/icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>'
    });
    const output = await bundle(`${root}/app`, { base: './' });
    outputs.push(Object.fromEntries(output.output.map((entry) =>
      [entry.fileName, entry.type === 'chunk' ? entry.code : asset(output, entry.fileName)])));
  }
  expect(outputs[0]).toEqual(outputs[1]);
});

it('fails closed when custom naming and relative URLs cannot stabilize', async () => {
  const root = await fixture();
  await expect(bundle(root, { base: './', build: { rollupOptions: { output: {
    assetFileNames: (info) => info.names.some((name) => name.endsWith('.css'))
      ? (String(info.source).includes('../') ? 'gss.css' : 'styles/gss.css')
      : 'images/[name]-[hash][extname]'
  } } } })).rejects.toThrow(/Cannot stabilize GSS CSS asset URL paths/);
});

it.each(['gss-manifest.json', 'logo.svg'])('rejects generated output collisions with a referenced public file: %s', async (file) => {
  const root = await fixture({
    'Card.gss': `.card { background-image: url(/${file}); }`,
    [`public/${file}`]: 'public-resource'
  });
  await expect(bundle(root, { build: { rollupOptions: { output: { assetFileNames: 'logo.svg' } } } }))
    .rejects.toThrow(/collides with.*public/);
});

function nextBuild(watcher: Rollup.RollupWatcher): Promise<void> {
  return new Promise((resolve, reject) => {
    function receive(event: Rollup.RollupWatcherEvent) {
      if (event.code === 'BUNDLE_END' || event.code === 'ERROR') {
        watcher.off('event', receive);
        if (event.code === 'ERROR') reject(event.error);
        else resolve();
      }
    }
    watcher.on('event', receive);
  });
}

it.each(['background-image', 'future-paint'])('refreshes watched asset bytes despite unchanged scope JS and recovers after deletion: %s', async (property) => {
  const root = await fixture({ 'Card.gss': `.card { ${property}: url(./icon.svg); }` });
  const watcher = await build({ root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
    build: { minify: false, watch: { buildDelay: 20 }, rollupOptions: { output: { entryFileNames: 'entry.js' } } } });
  if (!('on' in watcher)) throw new Error('Expected watcher.');
  watchers.push(watcher);
  await nextBuild(watcher);
  const first = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
  const js = await readFile(join(root, 'dist/entry.js'), 'utf8');
  const changed = nextBuild(watcher);
  await writeFile(join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>');
  await changed;
  const second = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
  expect(second.cssAsset).not.toBe(first.cssAsset);
  expect(second.compiler.moduleDetails).toEqual(first.compiler.moduleDetails);
  expect(await readFile(join(root, 'dist/entry.js'), 'utf8')).toBe(js);
  const missing = expect(nextBuild(watcher)).rejects.toThrow(/Cannot read GSS asset/);
  await rm(join(root, 'icon.svg'));
  await missing;
  const recreated = nextBuild(watcher);
  await writeFile(join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  await recreated;
  const restored = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
  expect(restored.cssAsset).toBe(first.cssAsset);
}, 15000);
