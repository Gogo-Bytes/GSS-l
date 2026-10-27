import { mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { build, createServer, normalizePath, type Rollup } from 'vite';
import { react } from '@gss-l/react';
import { gss } from '../src/index.js';

const roots: string[] = [];
const watchers: Rollup.RollupWatcher[] = [];
afterEach(async () => {
  await Promise.all(watchers.splice(0).map((watcher) => watcher.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture() {
  const root = normalizePath(await realpath(await mkdtemp(join(tmpdir(), 'gss-stylesheet-url-'))));
  roots.push(root);
  for (const [name, source] of Object.entries({
    'main.ts': `export { default as href } from 'virtual:gss.css?url'; export { default as styles } from './Main.gss'; export const lazy = () => import('./lazy');`,
    'lazy.ts': `export { default } from './Lazy.gss';`,
    'Main.gss': '.main { color: red; background-image: url(./image.svg); }',
    'Lazy.gss': '.lazy { color: green; }',
    'image.svg': '<svg xmlns="http://www.w3.org/2000/svg" width="3" height="2"/>',
    'index.html': '<html><head></head><body><script type="module" src="/main.ts"></script></body></html>'
  })) await writeFile(join(root, name), source);
  return root;
}
function snapshot(output: Rollup.RollupOutput) {
  const text = (name: string) => {
    const item = output.output.find((item) => item.fileName === name);
    if (item?.type !== 'asset') throw Error(`Missing asset ${name}`);
    return typeof item.source === 'string' ? item.source : new TextDecoder().decode(item.source);
  };
  const manifest = JSON.parse(text('gss-manifest.json'));
  return { manifest, css: text(manifest.cssAsset), text,
    js: output.output.filter((item) => item.type === 'chunk').map((item) => item.code).join('\n') };
}
it.each([false, true])('exports the final aggregate asset href without an HTML host (ssr=%s)', async (ssr) => {
  const root = await fixture();
  const result = await build({ root, base: '/app/', configFile: false, logLevel: 'silent', plugins: [gss({ adapter: react() })],
    build: { write: false, minify: false, ...(ssr ? { ssr: 'main.ts', ssrEmitAssets: true } : { rollupOptions: { input: join(root, 'main.ts'), preserveEntrySignatures: 'strict' } }) } });
  if (Array.isArray(result) || !('output' in result)) throw Error('Expected bundle');
  const { manifest, css, js } = snapshot(result);
  expect(manifest.compiler.modules).toEqual(['Lazy.gss', 'Main.gss']);
  expect(css).toContain('color: red');
  expect(css).toContain('color: green');
  expect(css).toMatch(/url\("\/app\/assets\/image-[^";]+\.svg"\)/);
  expect(js).toContain(`/app/${manifest.cssAsset}`);
  expect(result.output.filter((item) => item.fileName.endsWith('.css'))).toHaveLength(1);
});
it('keeps automatic SPA HTML injection and explicit href on the same asset', async () => {
  const root = await fixture();
  await writeFile(join(root, 'main.ts'), `import href from 'virtual:gss.css?url'; import './Main.gss'; window.href = href;`);
  const result = await build({ root, configFile: false, logLevel: 'silent', plugins: [gss({ adapter: react() })], build: { write: false } });
  if (Array.isArray(result) || !('output' in result)) throw Error('Expected bundle');
  const { manifest, text, js } = snapshot(result);
  expect(text('index.html').match(/rel="stylesheet"/g)).toHaveLength(1);
  expect(text('index.html')).toContain(`href="/${manifest.cssAsset}"`);
  expect(js).toContain(`/${manifest.cssAsset}`);
});
it('serves the explicit dev href through the existing CSS owner and preserves native updates', async () => {
  const root = await fixture();
  const server = await createServer({ root, base: '/app/', configFile: false, logLevel: 'silent', plugins: [gss({ adapter: react() })],
    server: { middlewareMode: true, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } });
  try {
    const entry = await server.ssrLoadModule('/main.ts');
    expect(entry.href).toBe('/app/@gss-l/stylesheet.css');
    // Vite prefixes authored HTML URLs before the post hook; runtime hrefs already include base.
    const html = await server.transformIndexHtml('/index.html', '<html><head><link rel="stylesheet" href="/@gss-l/stylesheet.css"></head></html>');
    expect(html.match(/rel="stylesheet"/g), html).toHaveLength(1);
    expect(html).not.toContain('data-gss-dev');
    const before = (await server.transformRequest('/@gss-l/stylesheet.css?direct'))?.code;
    expect(before).toContain('color: red;');
    const send = vi.spyOn(server.environments.client.hot, 'send');
    await writeFile(join(root, 'Main.gss'), '.main { color: blue; }');
    server.watcher.emit('change', join(root, 'Main.gss'));
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'update' })));
    const css = (await server.transformRequest('/@gss-l/stylesheet.css?direct'))?.code;
    expect(css).toContain('color: blue;');
    expect(css).not.toContain('color: red;');
  } finally { await server.close(); }
});
it('refreshes explicit href CSS across watch removal/restoration and agrees with a clean build', async () => {
  const root = await fixture();
  const options = { root, base: '/app/', configFile: false as const, logLevel: 'silent' as const,
    plugins: [gss({ adapter: react() })], build: { minify: false as const, rollupOptions: { input: join(root, 'main.ts') } } };
  const watcher = await build({ ...options, build: { ...options.build, watch: {} } });
  if (!('on' in watcher)) throw Error('Expected watcher');
  watchers.push(watcher);
  let builds = 0;
  const failures: unknown[] = [];
  watcher.on('event', (event) => { if (event.code === 'END') builds++; if (event.code === 'ERROR') failures.push(event.error); });
  await vi.waitFor(() => expect(builds).toBe(1));
  const manifest = async () => JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
  const initial = await manifest();
  await writeFile(join(root, 'main.ts'), `export { default as href } from 'virtual:gss.css?url'; export { default as styles } from './Main.gss';`);
  await vi.waitFor(() => expect(builds).toBe(2));
  const removed = await manifest();
  expect(removed.compiler.modules).toEqual(['Main.gss']);
  expect(removed.cssAsset).not.toBe(initial.cssAsset);
  await writeFile(join(root, 'main.ts'), `export { default as href } from 'virtual:gss.css?url'; export { default as styles } from './Main.gss'; export const lazy = () => import('./lazy');`);
  await vi.waitFor(() => expect(builds).toBe(3));
  expect((await manifest()).cssAsset).toBe(initial.cssAsset);
  const clean = await build({ ...options, build: { ...options.build, write: false } });
  if (Array.isArray(clean) || !('output' in clean)) throw Error('Expected bundle');
  expect(snapshot(clean).manifest).toEqual(await manifest());
  expect(failures).toEqual([]);
}, 15000);

it('keeps framework-owned hrefs stable at initial/reconnected sockets, then publishes real edits', async () => {
  const { default: WebSocket } = await import('ws');
  const root = await fixture();
  const server = await createServer({ root, configFile: false, logLevel: 'silent', plugins: [gss({ adapter: react() })],
    server: { host: '127.0.0.1', port: 0, watch: null }, optimizeDeps: { noDiscovery: true, include: [] } });
  const sockets: InstanceType<typeof WebSocket>[] = [];
  try {
    await server.listen();
    const entry = await server.ssrLoadModule('/main.ts');
    const origin = server.resolvedUrls!.local[0]!;
    const url = new URL(entry.href, origin);
    const css = async () => (await fetch(url, { headers: { accept: 'text/css' } })).text();
    expect(await css()).toContain('color: red;');
    const send = vi.spyOn(server.environments.client.hot, 'send');
    async function connect() {
      const wsUrl = new URL(origin); wsUrl.protocol = 'ws:';
      wsUrl.searchParams.set('token', server.config.webSocketToken);
      const socket = new WebSocket(wsUrl, 'vite-hmr'); sockets.push(socket);
      const messages: { type: string }[] = [];
      socket.on('message', (bytes) => messages.push(JSON.parse(bytes.toString())));
      await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
      await vi.waitFor(() => expect(messages.some((message) => message.type === 'connected')).toBe(true));
      expect(messages.filter((message) => message.type === 'update')).toEqual([]);
      return socket;
    }
    const first = await connect();
    first.terminate();
    await writeFile(join(root, 'Main.gss'), '.main { color: blue; }');
    server.watcher.emit('change', join(root, 'Main.gss'));
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'update', updates: [expect.objectContaining({ type: 'css-update', path: entry.href })]
    })));
    expect(await css()).toContain('color: blue;');
    await connect();
    expect(await css()).toContain('color: blue;');
    send.mockClear();
    await writeFile(join(root, 'Main.gss'), '.main { color: red; color: blue; }');
    server.watcher.emit('change', join(root, 'Main.gss'));
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
    expect(await css()).toContain('color: blue;');
    send.mockClear();
    await writeFile(join(root, 'Main.gss'), '.main { color: blue; }');
    server.watcher.emit('change', join(root, 'Main.gss'));
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'update', updates: [expect.objectContaining({ type: 'css-update', path: entry.href })]
    })));
    expect(await css()).toContain('color: blue;');
  } finally { for (const socket of sockets) socket.terminate(); await server.close(); }
});

it('preserves conditional wrappers and native manifest references for explicit output', async () => {
  const root = await fixture();
  await writeFile(join(root, 'Main.gss'), '.main { color: red; } @media (min-width: 1px) { .main { color: blue; } }');
  const result = await build({ root, configFile: false, logLevel: 'silent', plugins: [gss({ adapter: react() })],
    build: { write: false, manifest: true } });
  if (Array.isArray(result) || !('output' in result)) throw Error('Expected bundle');
  const state = snapshot(result);
  expect(state.css).toContain('@media (min-width: 1px)');
  const native = JSON.parse(state.text('.vite/manifest.json'));
  expect(Object.values(native).some((item: unknown) => (item as { file: string }).file === state.manifest.cssAsset)).toBe(true);
  for (const item of Object.values(native) as { file: string }[]) expect(result.output.some((output) => output.fileName === item.file)).toBe(true);
  expect(result.output.some((output) => output.fileName.includes('placeholder'))).toBe(false);
});
it.each(['gss.css.map', 'gss-manifest.json'])('rejects an explicit-output collision at %s', async (fileName) => {
  const root = await fixture();
  await expect(build({ root, configFile: false, logLevel: 'silent', plugins: [gss({ adapter: react() }), {
    name: 'collision', generateBundle() { this.emitFile({ type: 'asset', fileName, source: 'not ours' }); }
  }], build: { write: false } })).rejects.toThrow(/GSS output.*already exists/);
});

it('retains another plugin’s deduplicated empty asset and both chunk references', async () => {
  const root = await fixture();
  await writeFile(join(root, 'main.ts'), `import href from 'virtual:gss.css?url'; import shared from 'shared-url'; import './Main.gss'; window.stylesheet = href; window.shared = shared;`);
  const result = await build({ root, configFile: false, logLevel: 'silent', plugins: [gss({ adapter: react() }), {
    name: 'shared-empty-asset',
    resolveId(id) { return id === 'shared-url' ? '\0shared-url' : null; },
    load(id) {
      if (id !== '\0shared-url') return;
      const ref = this.emitFile({ type: 'asset', name: 'shared-empty.txt', source: '' });
      return `export default import.meta.ROLLUP_FILE_URL_${ref};`;
    }
  }], build: { write: false, minify: false, manifest: true } });
  if (Array.isArray(result) || !('output' in result)) throw Error('Expected bundle');
  const { manifest } = snapshot(result);
  const shared = result.output.find((entry) => entry.type === 'asset' && entry.names.includes('shared-empty.txt'));
  expect(shared).toBeDefined();
  const chunk = result.output.find((entry) => entry.type === 'chunk' && entry.isEntry);
  if (chunk?.type !== 'chunk') throw Error('Expected entry chunk');
  expect(chunk.referencedFiles).toContain(shared!.fileName);
  expect(chunk.referencedFiles).toContain(manifest.cssAsset);
  expect(chunk.code).toContain(JSON.stringify(posix.relative(posix.dirname(chunk.fileName), shared!.fileName)));
});
