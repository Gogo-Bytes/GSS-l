import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { build, createServer, normalizePath, type Plugin, type Rollup, type ViteDevServer } from 'vite';
import { react } from '@gss-l/react';
import WebSocket from 'ws';
import { gss } from '../src/index.js';

const roots: string[] = [];
const servers: ViteDevServer[] = [];
const sockets: WebSocket[] = [];
const watchers: Rollup.RollupWatcher[] = [];
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.terminate();
  await Promise.all(watchers.splice(0).map((watcher) => watcher.close()));
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(source: string, plugins: Plugin[] = [], listen = false) {
  const root = normalizePath(await realpath(await mkdtemp(join(tmpdir(), 'gss-diagnostic-'))));
  roots.push(root);
  const id = `${root}/Card.gss`;
  await writeFile(id, source);
  await writeFile(join(root, 'Card.tsx'), `import styles from './Card.gss'; export const Card = () => <div className={styles.card} />;`);
  const server = await createServer({
    root, configFile: false, plugins: [...plugins, gss({ adapter: react() })],
    server: { middlewareMode: !listen, host: '127.0.0.1', port: 0, ...(listen ? {} : { watch: null }), preTransformRequests: false }, logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] }
  });
  servers.push(server);
  if (listen) await server.listen();
  return { root, id, server, container: server.environments.client.pluginContainer };
}

it('locates a cold JSX precompilation error in physical CSS, not the active JSX sourcemap', async () => {
  const { server, id } = await fixture('.card {\n  color: red;\n  color: blue;\n}', [{
    name: 'upstream-jsx-map', enforce: 'pre', transform(source, id) {
      if (!id.endsWith('.tsx')) return;
      return { code: source, map: { version: 3, sources: ['upstream.jsx'], sourcesContent: [source], names: [], mappings: 'AAAA;AACA;AACA;AACA' } };
    }
  }]);
  await expect(server.transformRequest('/Card.tsx')).rejects.toMatchObject({
    id, plugin: 'gss-l', message: expect.stringContaining('[GSS1204]'),
    loc: { file: id, line: 3, column: 2 },
    frame: '1 | .card {\n2 |   color: red;\n3 |   color: blue;\n  |   ^^^^^^^^^^^^\n4 | }'
  });
});

it.each(['\n', '\r\n'].flatMap((newline) => ['', '\uFEFF', '\uFFFE'].map((bom) => [newline, bom]))) (
  'locates cold load syntax in original CSS (%j, %j)', async (newline, bom) => {
    const { id, container } = await fixture(`${bom}.valid { content: "😀"; }${newline}.bad { broken }`);
    const virtual = (await container.resolveId('./Card.gss', id))!.id;
    await expect(container.load(virtual)).rejects.toMatchObject({
      id, loc: { file: id, line: 2, column: 7 },
      frame: `1 | ${bom}.valid { content: "😀"; }\n2 | .bad { broken }\n  |        ^^^^^^`
    });
  }
);

it('reports a real production error with physical file, location and source frame', async () => {
  const { root, id } = await fixture('.card {\n  color: red;\n  color: blue;\n}');
  await expect(build({
    root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
    build: { write: false, rollupOptions: { input: `${root}/Card.tsx` } }
  })).rejects.toMatchObject({
    plugin: 'gss-l', pluginCode: 'GSS1204', loc: { file: id, line: 3, column: 2 },
    frame: expect.stringContaining('3 |   color: blue;\n  |   ^^^^^^^^^^^^')
  });
});

it.each([
  ['Compiler', '.card { margin-inline-start: 1px; } .outer .card { margin-left: 2px; }', 'GSS'],
  ['React', '.other { color: red; }', 'GSS2102'],
  ['resource IO', '.card { background: url(missing.svg); }', 'Cannot read GSS asset']
])('does not invent CSS locations for %s errors', async (_kind, source, message) => {
  const { server } = await fixture(source!);
  const error = await server.transformRequest('/Card.tsx').catch((error: unknown) => error);
  expect(error).toMatchObject({ message: expect.stringContaining(message!) });
  expect(error).not.toHaveProperty('loc');
  expect(error).not.toHaveProperty('frame');
});

it.each([
  ['GSS1204', '.card {\n color: red;\n color: blue;\n}', 3, 1, '3 |  color: blue;'],
  ['GSS1001', '.card {\n broken\n}', 2, 1, '2 |  broken']
] as const)('sends native watcher %s location/frame, retains LKG and recovers with a CSS update', async (code, bad, line, column, frameLine) => {
  const { root, id, server, container } = await fixture('.card { color: red; }', [], true);
  await container.load((await container.resolveId('./Card.gss', `${root}/entry.ts`))!.id);
  const previous = (await server.transformRequest('/@gss-l/central.css?direct'))!.code;
  const url = new URL(server.resolvedUrls!.local[0]!);
  url.protocol = 'ws:';
  url.searchParams.set('token', server.config.webSocketToken);
  const socket = new WebSocket(url, 'vite-hmr');
  sockets.push(socket);
  const messages: unknown[] = [];
  socket.on('message', (data) => messages.push(JSON.parse(data.toString())));
  await new Promise<void>((resolve, reject) => { socket.once('open', resolve); socket.once('error', reject); });
  await vi.waitFor(() => expect(server.watcher.getWatched()[root]).toContain('Card.gss'));
  await vi.waitFor(() => expect(messages).toContainEqual(expect.objectContaining({ type: 'update' })));
  messages.length = 0;
  await writeFile(id, bad);
  await vi.waitFor(() => expect(messages).toContainEqual({ type: 'error', err: expect.objectContaining({
    id, message: expect.stringContaining(code), loc: { file: id, line, column },
    frame: expect.stringContaining(frameLine)
  }) }));
  expect(messages.filter((message) => (message as { type: string }).type === 'error')).toHaveLength(1);
  expect(messages).not.toContainEqual(expect.objectContaining({ type: 'update' }));
  expect((await server.transformRequest('/@gss-l/central.css?direct'))!.code).toBe(previous);
  messages.length = 0;
  await writeFile(id, '.card { color: red; }'); // identical-byte recovery must clear overlay too
  await vi.waitFor(() => expect(messages).toContainEqual(expect.objectContaining({
    type: 'update', updates: [expect.objectContaining({ type: 'css-update' })]
  })));
  expect(messages).not.toContainEqual(expect.objectContaining({ type: 'full-reload' }));
  expect((await server.transformRequest('/@gss-l/central.css?direct'))!.code).toBe(previous);
});

it('formats the failed read snapshot even if the file has already changed', async () => {
  let replaced = false;
  const { root, id, server, container } = await fixture('.card { color:red; }', [{
    name: 'replace-after-owned-read', hotUpdate: { order: 'pre', async handler(context) {
      if (this.environment.name !== 'client' || replaced) return;
      replaced = true;
      const source = await context.read();
      await writeFile(context.file, '.card { color: green; }');
      context.read = () => Promise.resolve(source);
    } }
  }]);
  await container.load((await container.resolveId('./Card.gss', `${root}/entry.ts`))!.id);
  const send = vi.spyOn(server.environments.client.hot, 'send');
  await writeFile(id, '.card {\n color:red;\n color:blue;\n}');
  server.watcher.emit('change', id);
  await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'error', err: expect.objectContaining({
    loc: { file: id, line: 3, column: 1 }, frame: expect.stringContaining('3 |  color:blue;')
  }) })));
  expect(JSON.stringify(send.mock.calls)).not.toContain('green');
});

it('never emits a superseded asynchronous failure or its old frame', async () => {
  let release: (() => void) | undefined;
  let intercepted = false;
  let completed = 0;
  const { root, id, server, container } = await fixture('.card { color:red; }', [{
    name: 'delay-failed-read', hotUpdate: { order: 'pre', async handler(context) {
      if (this.environment.name !== 'client' || intercepted) return;
      intercepted = true;
      const source = await context.read();
      context.read = () => new Promise<string>((resolve) => { release = () => resolve(source); });
    } }
  }, { name: 'observe-completion', hotUpdate: { order: 'post', handler() {
    if (this.environment.name === 'client') completed += 1;
  } } }]);
  await container.load((await container.resolveId('./Card.gss', `${root}/entry.ts`))!.id);
  await server.transformRequest('/Card.tsx');
  await server.transformRequest('/@gss-l/central.css?direct');
  const send = vi.spyOn(server.environments.client.hot, 'send');
  await writeFile(id, '.card { color:red; color:blue; }');
  server.watcher.emit('change', id);
  await vi.waitFor(() => expect(release).toBeDefined());
  await writeFile(id, '.card { color:green; }');
  server.watcher.emit('change', id);
  await vi.waitFor(() => expect(completed).toBe(1));
  release!();
  await vi.waitFor(() => expect(completed).toBe(2));
  expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  expect(send.mock.calls.filter(([payload]) => (payload as unknown as { type: string }).type === 'full-reload')).toHaveLength(1);
  expect((await server.transformRequest('/@gss-l/central.css?direct'))!.code).toContain('color: green;');
});

it('recovers an unchanged scope through CSS only without reloading its JS importer', async () => {
  const { root, id, server } = await fixture('.card { color:blue; }');
  await writeFile(`${root}/main.ts`, `import styles from './Card.gss'; document.body.className = styles.card.self;`);
  const entry = (await server.transformRequest('/main.ts'))!.code;
  const dependency = entry.match(/from ["']([^"']*\/@id\/[^"']+)["']/)![1]!;
  await server.transformRequest(dependency.replace('/@id/__x00__', '\0').replace('?import', ''));
  await server.transformRequest('/@gss-l/central.css?direct');
  const send = vi.spyOn(server.environments.client.hot, 'send');
  await writeFile(id, '.card { color:blue; color:red; }');
  server.watcher.emit('change', id);
  await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
  send.mockClear();
  await writeFile(id, '.card { color:blue; }');
  server.watcher.emit('change', id);
  await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'update' })));
  expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'full-reload' }));
});

it.each(['.card { color:green; }', '.panel { color:blue; }', null])(
  'still propagates changed scope or deletion to a JS importer (%j)', async (next) => {
    const { root, id, server } = await fixture('.card { color:blue; }');
    await writeFile(`${root}/main.ts`, `import styles from './Card.gss'; document.body.className = styles.card.self;`);
    await server.transformRequest('/main.ts');
    const send = vi.spyOn(server.environments.client.hot, 'send');
    if (next === null) await rm(id);
    else await writeFile(id, next);
    server.watcher.emit(next === null ? 'unlink' : 'change', id);
    await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'full-reload' })));
    if (next?.includes('.panel')) await expect(server.transformRequest('/Card.tsx')).rejects.toThrow(/GSS2102/);
  }
);

it('replays production census warnings from owned source, not the current disk file', async () => {
  const { root, id } = await fixture('.card { old-paint: red; }');
  const warnings: Rollup.RollupLog[] = [];
  await build({ root, configFile: false, logLevel: 'silent', plugins: [gss({ adapter: react() }), {
    name: 'replace-after-source-snapshot', async buildEnd() { await writeFile(id, '.card { new-paint: blue; }'); }
  }], build: { write: false, rollupOptions: { input: `${root}/Card.tsx`, onwarn(warning) { warnings.push(warning); } } } });
  const diagnostics = warnings.filter(({ message }) => message.includes('GSS1104'));
  expect(diagnostics).toHaveLength(1);
  expect(diagnostics[0]).toMatchObject({ id, message: expect.stringContaining('old-paint') });
  expect(diagnostics[0]).not.toHaveProperty('loc');
  expect(diagnostics[0]).not.toHaveProperty('frame');
});

it('locates a failed cached production refresh and recovers on a later watch build', async () => {
  const { root, id } = await fixture('.card { future-paint: red; }');
  const watcher = await build({ root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
    build: { write: false, watch: { buildDelay: 20 }, rollupOptions: { input: `${root}/Card.tsx` } }
  });
  if (!('on' in watcher)) throw new Error('Expected watcher.');
  watchers.push(watcher);
  const nextBuild = () => {
    return new Promise<void>((resolve, reject) => {
      const receive = (event: Rollup.RollupWatcherEvent) => {
        if (event.code !== 'BUNDLE_END' && event.code !== 'ERROR') return;
        watcher.off('event', receive);
        if (event.code === 'ERROR') reject(event.error);
        else resolve();
      };
      watcher.on('event', receive);
    });
  };
  await nextBuild();
  const failure = expect(nextBuild()).rejects.toMatchObject({
    pluginCode: 'GSS1204', loc: { file: id, line: 3, column: 1 },
    frame: expect.stringContaining('3 |  future-paint: blue;')
  });
  await writeFile(id, '.card {\n future-paint: red;\n future-paint: blue;\n}');
  await failure;
  const recovery = nextBuild();
  await writeFile(id, '.card { future-paint: green; }');
  await recovery;
}, 15000);
