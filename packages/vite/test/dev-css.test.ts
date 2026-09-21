import { mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { build, createServer, normalizePath, type Plugin, type ViteDevServer } from 'vite';
import { react } from '@gss-l/react';
import { gss } from '../src/index.js';
import WebSocket from 'ws';

const servers: ViteDevServer[] = [];
const roots: string[] = [];
const sockets: WebSocket[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(base = '/', observers: Plugin[] = [], listen = false, linkedRoot = false) {
  const root = normalizePath(await realpath(await mkdtemp(join(tmpdir(), 'gss-dev-css-'))));
  roots.push(root);
  await writeFile(join(root, 'Card.gss'), '.card { color: red; }');
  const configRoot = linkedRoot ? `${root}-linked` : root;
  if (linkedRoot) {
    await symlink(root, configRoot);
    roots.push(configRoot);
  }
  const server = await createServer({
    root: configRoot, base, configFile: false, plugins: [...observers, gss({ adapter: react() })],
    server: {
      middlewareMode: !listen, host: '127.0.0.1', port: 0, watch: null, preTransformRequests: false,
      // Vite's own FS allowlist must permit the canonical target of an explicit symlink root.
      ...(linkedRoot ? { fs: { allow: [root] } } : {})
    },
    appType: 'mpa', logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] }
  });
  servers.push(server);
  if (listen) await server.listen();
  const container = server.environments.client.pluginContainer;
  return { root, server, container };
}

it('serves the entire committed snapshot as a Vite virtual CSS module', async () => {
  const { root, server, container } = await fixture();
  const id = (await container.resolveId('./Card.gss', `${root}/entry.ts`))!.id;
  await container.load(id);
  await writeFile(join(root, 'Other.gss'), '.other { display: flex; }');
  const otherId = (await container.resolveId('./Other.gss', `${root}/entry.ts`))!.id;
  await container.load(otherId);
  const result = await server.transformRequest('/@gss-l/central.css?direct');
  expect(result?.code).toContain('color: red;');
  expect(result?.code).toContain('display: flex;');
  expect(result?.code).not.toContain('__vite__updateStyle');
});

it('invalidates an early empty CSS response when a stylesheet is discovered later', async () => {
  const { root, server, container } = await fixture();
  expect((await server.transformRequest('/@gss-l/central.css?direct'))?.code).toBe('');
  const send = vi.spyOn(server.environments.client.hot, 'send');
  const id = (await container.resolveId('./Card.gss', `${root}/entry.ts`))!.id;
  await container.load(id);
  expect((await server.transformRequest('/@gss-l/central.css?direct'))?.code).toContain('color: red;');
  expect(send).toHaveBeenCalledWith(expect.objectContaining({
    type: 'update', updates: [expect.objectContaining({ type: 'css-update', path: '/@gss-l/central.css' })]
  }));
  const count = send.mock.calls.length;
  await container.load(id);
  expect(send.mock.calls).toHaveLength(count);
});

it('replaces the full CSS snapshot and revalidates source importers after a file update', async () => {
  const { root, server } = await fixture();
  await writeFile(join(root, 'Card.tsx'),
    `import styles from './Card.gss'; export const Card = () => <div className={styles.card} />;`);
  await server.transformRequest('/Card.tsx');
  await server.transformRequest('/@gss-l/central.css?direct');
  const send = vi.spyOn(server.environments.client.hot, 'send');
  await writeFile(join(root, 'Card.gss'), '.panel { color: blue; }');
  server.watcher.emit('change', `${root}/Card.gss`);
  await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({
    type: 'update', updates: [expect.objectContaining({ type: 'css-update' })]
  })));
  const css = (await server.transformRequest('/@gss-l/central.css?direct'))?.code;
  expect(css).toContain('color: blue;');
  expect(css).not.toContain('color: red;');
  await expect(server.transformRequest('/Card.tsx')).rejects.toThrow(/GSS2102.*styles.card/);
});

it('invalidates deleted stylesheets, reclaims resources and recovers on recreation', async () => {
  const { root, server, container } = await fixture();
  await writeFile(join(root, 'Card.gss'),
    '.card { color: red; animation-name: spin; } @keyframes spin { to { opacity: 0; } }');
  await writeFile(join(root, 'Other.gss'), '.other { color: red; }');
  for (const name of ['Card', 'Other']) {
    await container.load((await container.resolveId(`./${name}.gss`, `${root}/entry.ts`))!.id);
  }
  expect((await server.transformRequest('/@gss-l/central.css?direct'))?.code).toContain('@keyframes');
  const send = vi.spyOn(server.environments.client.hot, 'send');
  await rm(join(root, 'Card.gss'));
  server.watcher.emit('unlink', `${root}/Card.gss`);
  await vi.waitFor(() => expect(send).toHaveBeenCalled());
  const css = (await server.transformRequest('/@gss-l/central.css?direct'))?.code;
  expect(css).toContain('color: red;');
  expect(css).not.toMatch(/@keyframes|animation-name/);
  send.mockClear();
  await writeFile(join(root, 'Card.gss'), '.card { color: blue; }');
  server.watcher.emit('add', `${root}/Card.gss`);
  await vi.waitFor(() => expect(send).toHaveBeenCalled());
  expect((await server.transformRequest('/@gss-l/central.css?direct'))?.code).toContain('color: blue;');
});

it.each(['replace', 'delete'])('does not let a slow old file read undo a newer %s', async (action) => {
  let release: (() => void) | undefined;
  let intercepted = false;
  let completed = 0;
  const { root, server, container } = await fixture('/', [{
    name: 'delayed-filesystem-read',
    hotUpdate: { order: 'pre', async handler(context) {
      if (this.environment.name !== 'client' || intercepted) return;
      intercepted = true;
      const source = await context.read();
      context.read = () => new Promise<string>((resolve) => { release = () => resolve(source); });
    } }
  }, {
    name: 'observe-completion',
    hotUpdate: { order: 'post', handler() {
      if (this.environment.name === 'client') completed += 1;
    } }
  }]);
  await container.load((await container.resolveId('./Card.gss', `${root}/entry.ts`))!.id);
  await server.transformRequest('/@gss-l/central.css?direct');
  await writeFile(join(root, 'Card.gss'), '.card { color: blue; }');
  server.watcher.emit('change', `${root}/Card.gss`);
  await vi.waitFor(() => expect(release).toBeDefined());
  if (action === 'delete') {
    await rm(join(root, 'Card.gss'));
    server.watcher.emit('unlink', `${root}/Card.gss`);
  } else {
    await writeFile(join(root, 'Card.gss'), '.card { color: green; }');
    server.watcher.emit('change', `${root}/Card.gss`);
  }
  await vi.waitFor(() => expect(completed).toBe(1));
  const current = (await server.transformRequest('/@gss-l/central.css?direct'))?.code;
  if (action === 'delete') expect(current).toBe('');
  else expect(current).toContain('color: green;');
  release!();
  await vi.waitFor(() => expect(completed).toBe(2));
  const css = (await server.transformRequest('/@gss-l/central.css?direct'))?.code;
  expect(css).toBe(current);
  expect(css).not.toContain('color: blue;');
});

it('resynchronizes a late HMR connection after CSS was initially served empty', async () => {
  const { root, server, container } = await fixture('/app/', [], true);
  const origin = server.resolvedUrls!.local[0]!;
  const cssUrl = new URL('@gss-l/central.css', origin);
  const initial = await fetch(cssUrl, { headers: { accept: 'text/css' } });
  expect(initial.headers.get('content-type')).toContain('text/css');
  expect(await initial.text()).toBe('');
  await container.load((await container.resolveId('./Card.gss', `${root}/entry.ts`))!.id);
  const wsUrl = new URL(origin);
  wsUrl.protocol = 'ws:';
  wsUrl.searchParams.set('token', server.config.webSocketToken);
  const socket = new WebSocket(wsUrl, 'vite-hmr');
  sockets.push(socket);
  const messages: unknown[] = [];
  socket.on('message', (data) => messages.push(JSON.parse(data.toString())));
  await new Promise<void>((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  await vi.waitFor(() => expect(messages).toContainEqual(expect.objectContaining({
    type: 'update', updates: [expect.objectContaining({ type: 'css-update', path: '/@gss-l/central.css' })]
  })));
  expect(await (await fetch(cssUrl, { headers: { accept: 'text/css' } })).text()).toContain('color: red;');
});

it('retains last-known-good CSS on hard diagnostics and recovers with preserved warnings', async () => {
  const { root, server, container } = await fixture();
  const id = (await container.resolveId('./Card.gss', `${root}/entry.ts`))!.id;
  await container.load(id);
  const previous = (await server.transformRequest('/@gss-l/central.css?direct'))?.code;
  const send = vi.spyOn(server.environments.client.hot, 'send');
  await writeFile(join(root, 'Card.gss'), '.card {');
  server.watcher.emit('change', `${root}/Card.gss`);
  await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
  expect((await server.transformRequest('/@gss-l/central.css?direct'))?.code).toBe(previous);
  expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'update' }));
  await expect(container.load(id)).rejects.toThrow();
  send.mockClear();
  const warn = vi.spyOn(server.config.logger, 'warn');
  await writeFile(join(root, 'Card.gss'), '.card { future-paint: red; color: blue; }');
  server.watcher.emit('change', `${root}/Card.gss`);
  await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'update' })));
  expect(warn).toHaveBeenCalled();
  const current = (await server.transformRequest('/@gss-l/central.css?direct'))?.code;
  expect(current).toContain('future-paint: red;');
  expect(current).toContain('color: blue;');
  expect(current).not.toContain('color: red;');
});

it('does not confuse comments or script text with an existing stylesheet owner', async () => {
  const { server } = await fixture();
  const fakeLink = '<link rel="stylesheet" href="/@gss-l/central.css">';
  const html = `<!doctype html><html><head><!-- ${fakeLink} --><script>const fake = '${fakeLink}';</script></head></html>`;
  const result = await server.transformIndexHtml('/index.html', html);
  expect(result.match(/data-gss-dev/g)).toHaveLength(1);
  const existing = await server.transformIndexHtml('/index.html',
    `<html><head><link rel='stylesheet' href='/@gss-l/central.css?t=1'></head></html>`);
  expect(existing).not.toContain('data-gss-dev');
});

it('keeps HMR source responses transformed and their virtual dependency URLs cache-busted', async () => {
  const { root, server } = await fixture('/app/', [{
    name: 'default-pre-transform', config: () => ({ server: { preTransformRequests: true } })
  }], true, true);
  await writeFile(join(root, 'entry.ts'),
    `import styles from './Card.gss'; document.body.className = styles.card.self; if (import.meta.hot) import.meta.hot.accept();`);
  const origin = server.resolvedUrls!.local[0]!;
  const initial = await (await fetch(new URL('entry.ts', origin))).text();
  expect(initial).toContain('__vite__createHotContext');
  const dependencyUrl = initial.match(/from ["']([^"']*\/@id\/[^"']+)["']/)?.[1];
  expect(dependencyUrl).toBeDefined();
  await fetch(new URL(dependencyUrl!, origin));
  const send = vi.spyOn(server.environments.client.hot, 'send');
  await writeFile(join(root, 'Card.gss'), '.card { color: blue; }');
  server.watcher.emit('change', `${root}/Card.gss`);
  await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({
    type: 'update', updates: expect.arrayContaining([expect.objectContaining({ type: 'js-update' })])
  })));
  const updated = await (await fetch(new URL(`entry.ts?t=${Date.now()}`, origin))).text();
  expect(updated).toContain('__vite__createHotContext');
  expect(updated).toContain('/@id/__x00__gss-l:');
  expect(updated).toMatch(/Card\.gss\?[^"']*t=/);
});

it('does not bypass Vite filesystem denial through a virtual stylesheet id', async () => {
  const { root, container } = await fixture('/', [{
    name: 'deny-card', config: () => ({ server: { fs: { deny: ['**/Card.gss'] } } })
  }]);
  const id = (await container.resolveId('./Card.gss', `${root}/entry.ts`))!.id;
  await expect(container.load(id)).rejects.toThrow(/Vite.*file access/);
});

it('never injects the dev stylesheet URL into production HTML', async () => {
  const { root } = await fixture();
  await writeFile(join(root, 'index.html'),
    '<!doctype html><html><head></head><body><script type="module" src="/entry.ts"></script></body></html>');
  await writeFile(join(root, 'entry.ts'),
    `import styles from './Card.gss'; document.body.className = styles.card.self;`);
  const result = await build({
    root, configFile: false, plugins: [gss({ adapter: react() })],
    logLevel: 'silent', build: { write: false }
  });
  if (Array.isArray(result) || !('output' in result)) throw new Error('Expected one bundle.');
  const html = result.output.find((entry) => entry.fileName === 'index.html');
  if (html?.type !== 'asset') throw new Error('Expected HTML asset.');
  expect(String(html.source)).not.toMatch(/@gss-l\/central.css|data-gss-dev/);
});

it('injects one shared, base-aware stylesheet link into every dev HTML entry', async () => {
  const { server } = await fixture('/app/');
  const html = '<!doctype html><html><head></head><body></body></html>';
  for (const path of ['/index.html', '/nested/other.html']) {
    const transformed = await server.transformIndexHtml(path, html);
    expect(transformed).toContain('href="/app/@gss-l/central.css"');
    const repeated = await server.transformIndexHtml(path, transformed);
    expect(repeated.match(/href="\/app\/@gss-l\/central.css"/g)).toHaveLength(1);
  }
});
