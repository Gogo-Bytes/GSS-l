import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { get } from 'node:http';
import { basename, dirname, join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { createServer, normalizePath, type InlineConfig, type ViteDevServer } from 'vite';
import { react } from '@gss-l/react';
import { gss } from '../src/index.js';

const roots: string[] = [];
const servers: ViteDevServer[] = [];
afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});
async function fixture(files: Record<string, string> = {}, config: InlineConfig = {}) {
  const root = normalizePath(await realpath(await mkdtemp(join(tmpdir(), 'gss-dev-assets-'))));
  roots.push(root);
  for (const [name, value] of Object.entries({
    'Card.gss': '.card { background-image: url(./icon.svg); }',
    'Card.tsx': `import s from './Card.gss'; export const Card = () => <div className={s.card}/>;`,
    'icon.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>', ...files
  })) {
    await mkdir(dirname(join(root, name)), { recursive: true });
    await writeFile(join(root, name), value);
  }
  const server = await createServer({ root, configFile: false, plugins: [gss({ adapter: react() })],
    appType: 'mpa', logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] },
    ...config, server: { host: '127.0.0.1', port: 0, watch: null, preTransformRequests: false, ...config.server } });
  servers.push(server);
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Expected server address.');
  return { root, server, origin: `http://127.0.0.1:${address.port}` };
}
async function css(server: ViteDevServer) {
  return (await server.transformRequest('/@gss-l/central.css?direct'))!.code;
}
function imageUrl(source: string) {
  return source.match(/url\("([^"]+)"\)/)![1]!;
}

it('refreshes only CSS for asset byte changes and retains its last good snapshot on deletion', async () => {
  const { root, server, origin } = await fixture();
  const beforeJs = (await server.transformRequest('/Card.tsx'))!.code;
  const before = await css(server);
  const send = vi.spyOn(server.environments.client.hot, 'send');
  await writeFile(join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>');
  server.watcher.emit('change', `${root}/icon.svg`);
  await vi.waitFor(async () => expect(await css(server)).not.toBe(before));
  const changed = await css(server);
  expect(await (await fetch(new URL(imageUrl(changed), origin))).text()).toContain('<circle');
  expect((await server.transformRequest('/Card.tsx'))!.code).toBe(beforeJs);
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'update', updates: [expect.objectContaining({ type: 'css-update' })] }));
  expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'full-reload' }));
  send.mockClear();
  await rm(join(root, 'icon.svg'));
  server.watcher.emit('unlink', `${root}/icon.svg`);
  await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
  expect(await css(server)).toBe(changed);
  expect(await (await fetch(new URL(imageUrl(changed), origin))).text()).toContain('<circle');
  send.mockClear();
  await writeFile(join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  server.watcher.emit('add', `${root}/icon.svg`);
  await vi.waitFor(async () => expect(await css(server)).toBe(before));
});

it('sends a native CSS recovery update even when restored bytes equal the last good snapshot', async () => {
  const { root, server } = await fixture();
  await server.transformRequest('/Card.tsx');
  const before = await css(server);
  const send = vi.spyOn(server.environments.client.hot, 'send');
  await rm(join(root, 'icon.svg'));
  server.watcher.emit('unlink', `${root}/icon.svg`);
  await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
  send.mockClear();
  await writeFile(join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  server.watcher.emit('add', `${root}/icon.svg`);
  await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'update', updates: [expect.objectContaining({ type: 'css-update' })] })));
  expect(await css(server)).toBe(before);
  expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'full-reload' }));
});

it('encodes local filenames separately from their query and fragment', async () => {
  const { server, origin } = await fixture({
    'Card.gss': '.card { background-image: url("./a%20b%23c.svg?v=1#icon"); }',
    'a b#c.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>'
  });
  await server.transformRequest('/Card.tsx');
  const url = imageUrl(await css(server));
  const response = await fetch(new URL(url, origin));
  expect(response.status, url).toBe(200);
  expect(await response.text()).toContain('<svg');
});

it('checks both requested and canonical asset paths against Vite deny rules before commit', async () => {
  const { root, server } = await fixture({ 'secret.svg': 'private-data' }, { server: { fs: { deny: ['**/secret.svg'] } } });
  await server.transformRequest('/Card.tsx');
  const good = await css(server);
  await symlink(join(root, 'secret.svg'), join(root, 'alias.svg'));
  const send = vi.spyOn(server.environments.client.hot, 'send');
  await writeFile(join(root, 'Card.gss'), '.card { background-image: url(./alias.svg); }');
  server.watcher.emit('change', `${root}/Card.gss`);
  await vi.waitFor(() => expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' })));
  expect(await css(server)).toBe(good);
  expect(good).not.toContain('secret');
});

it('does not treat URI delimiters in physical directory names as permission-check suffixes', async () => {
  const { server } = await fixture({
    'Card.gss': '.card { background-image: url(./vault%23/secret.svg); }',
    'vault#/secret.svg': 'private-data'
  }, { server: { fs: { deny: ['**/secret.svg'] } } });
  await expect(server.transformRequest('/Card.tsx')).rejects.toThrow(/denied GSS asset access/);
  expect(await css(server)).toBe('');
});

it('recovers a missing asset from an initial failed import without a stylesheet edit', async () => {
  const { root, server } = await fixture({ 'Card.gss': '.card { background-image: url(./missing.svg); }' });
  await expect(server.transformRequest('/Card.tsx')).rejects.toThrow(/Cannot read GSS asset/);
  expect(await css(server)).toBe('');
  await writeFile(join(root, 'missing.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  server.watcher.emit('add', `${root}/missing.svg`);
  await vi.waitFor(async () => expect(await css(server)).toContain('missing.svg'));
  expect((await server.transformRequest('/Card.tsx'))?.code).toContain('s.card.self');
});

it('keeps native host/CORS checks and rechecks file permissions on snapshot requests', async () => {
  const { server, origin } = await fixture();
  await server.transformRequest('/Card.tsx');
  const url = new URL(imageUrl(await css(server)), origin);
  const first = await fetch(url);
  expect(first.status).toBe(200);
  expect(first.headers.get('content-type')).toContain('image/svg+xml');
  expect((await fetch(url, { method: 'HEAD' })).status).toBe(200);
  expect((await fetch(url, { headers: { 'if-none-match': first.headers.get('etag')! } })).status).toBe(304);
  const deniedHost = await new Promise<number | undefined>((resolve, reject) => {
    get(url, { headers: { host: 'untrusted.example' } }, (response) => {
      response.resume(); resolve(response.statusCode);
    }).on('error', reject);
  });
  expect(deniedHost).toBe(403);
  expect((await fetch(url, { headers: { origin: 'https://untrusted.example' } })).headers.get('access-control-allow-origin')).not.toBe('https://untrusted.example');
  server.config.server.fs.allow = [];
  expect((await fetch(url)).status).toBe(403);
});

it('refreshes public resources and font bytes without changing the source schema', async () => {
  const { root, server, origin } = await fixture({
    'Card.gss': '@font-face { font-family: "Demo"; src: url(./font.woff2); } .card { future-paint: red; background-image: url(/logo.svg); }',
    'font.woff2': 'font-one', 'public/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>'
  });
  const js = (await server.transformRequest('/Card.tsx'))!.code;
  const before = await css(server);
  const send = vi.spyOn(server.environments.client.hot, 'send');
  await writeFile(join(root, 'font.woff2'), 'font-two');
  server.watcher.emit('change', `${root}/font.woff2`);
  await vi.waitFor(async () => expect(await css(server)).not.toBe(before));
  const fontChanged = await css(server);
  expect(await (await fetch(new URL(imageUrl(fontChanged), origin))).text()).toBe('font-two');
  await writeFile(join(root, 'public/logo.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>');
  server.watcher.emit('change', `${root}/public/logo.svg`);
  await vi.waitFor(async () => expect(await css(server)).not.toBe(fontChanged));
  expect((await server.transformRequest('/Card.tsx'))!.code).toBe(js);
  expect(send).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'full-reload' }));
});

it('reclaims deleted Module contributions while retaining a shared asset for its remaining owner', async () => {
  const { root, server, origin } = await fixture({
    'Card.gss': '.card { background-image: url(./icon.svg); color: red; }',
    'Fresh.gss': '.fresh { background-image: url(./fresh.svg); }',
    'Fresh.tsx': `import s from './Fresh.gss'; export const Fresh = () => <div className={s.fresh}/>;`,
    'fresh.svg': '<svg/>',
    'Other.gss': '.other { background-image: url(./icon.svg); }',
    'Other.tsx': `import s from './Other.gss'; export const Other = () => <div className={s.other}/>;`
  });
  await server.transformRequest('/Card.tsx');
  await server.transformRequest('/Other.tsx');
  await css(server);
  await rm(join(root, 'Card.gss'));
  server.watcher.emit('unlink', `${root}/Card.gss`);
  await vi.waitFor(async () => expect(await css(server)).not.toContain('color: red;'));
  expect(await css(server)).toContain('background-image');
  await writeFile(join(root, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>');
  server.watcher.emit('change', `${root}/icon.svg`);
  await vi.waitFor(async () => expect(await (await fetch(new URL(imageUrl(await css(server)), origin))).text()).toContain('<circle'));
  const retiredUrl = new URL(imageUrl(await css(server)), origin);
  await rm(join(root, 'Other.gss'));
  server.watcher.emit('unlink', `${root}/Other.gss`);
  await vi.waitFor(async () => expect(await css(server)).toBe(''));
  await server.transformRequest('/Fresh.tsx');
  expect((await fetch(retiredUrl)).status).toBe(404);
});

it('denies root-external assets unless the owner explicitly allows their directory', async () => {
  const outside = normalizePath(await realpath(await mkdtemp(join(tmpdir(), 'gss-outside-'))));
  roots.push(outside);
  await writeFile(join(outside, 'icon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  const { server, origin } = await fixture({ 'Card.gss': `.card { background-image: url(../${basename(outside)}/icon.svg); }` });
  const allow = [...server.config.server.fs.allow];
  await expect(server.transformRequest('/Card.tsx')).rejects.toThrow(/denied GSS asset access/);
  expect(server.config.server.fs.allow).toEqual(allow);
  expect(await css(server)).toBe('');
  server.config.server.fs.allow.push(outside);
  await server.transformRequest('/Card.tsx');
  expect((await fetch(new URL(imageUrl(await css(server)), origin))).status).toBe(200);
});

it('invalidates virtual scope JS when an asset symlink changes logical identity', async () => {
  const { root, server, origin } = await fixture({
    'Card.gss': '.card { background-image: url(./alias.svg); }', 'two.svg': '<svg><circle/></svg>'
  });
  await symlink(join(root, 'icon.svg'), join(root, 'alias.svg'));
  const source = (await server.transformRequest('/Card.tsx'))!.code;
  const moduleUrl = source.match(/from\s+["']([^"']+)/)![1]!;
  const before = await (await fetch(new URL(moduleUrl, origin))).text();
  const beforeCss = await css(server);
  await rm(join(root, 'alias.svg'));
  await symlink(join(root, 'two.svg'), join(root, 'alias.svg'));
  server.watcher.emit('change', `${root}/alias.svg`);
  await vi.waitFor(async () => expect(await css(server)).not.toBe(beforeCss));
  expect(await (await fetch(new URL(moduleUrl, origin))).text()).not.toBe(before);
});

it('does not let a delayed stylesheet read overwrite a newer asset-triggered contribution', async () => {
  let release!: (source: string) => void;
  let entered!: () => void;
  let done!: () => void;
  const gate = new Promise<string>((resolve) => { release = resolve; });
  const waiting = new Promise<void>((resolve) => { entered = resolve; });
  const finished = new Promise<void>((resolve) => { done = resolve; });
  const { root, server } = await fixture({}, { plugins: [{
    name: 'delay-source-read', enforce: 'pre', hotUpdate(context) {
      if (context.file.endsWith('/Card.gss')) { context.read = () => gate; entered(); }
    }
  }, gss({ adapter: react() }), {
    name: 'observe-completion', enforce: 'post', hotUpdate(context) {
      if (context.file.endsWith('/Card.gss')) done();
    }
  }] });
  await server.transformRequest('/Card.tsx');
  await css(server);
  await writeFile(join(root, 'Card.gss'), '.card { background-image: url(./icon.svg); color: blue; }');
  server.watcher.emit('change', `${root}/Card.gss`);
  await waiting;
  await writeFile(join(root, 'icon.svg'), '<svg><circle/></svg>');
  server.watcher.emit('change', `${root}/icon.svg`);
  await vi.waitFor(async () => expect(await css(server)).toContain('color: blue;'));
  release('.card { background-image: url(./icon.svg); color: red; }');
  await finished;
  expect(await css(server)).toContain('color: blue;');
  expect(await css(server)).not.toContain('color: red;');
});

it('preserves authored remote, data and fragment URLs without filesystem resolution', async () => {
  const { server } = await fixture({ 'Card.gss': '.card { background-image: url("https://example.invalid/a.svg?q=1#shape"), url("#mask"), url("data:image/svg+xml,%3Csvg/%3E"); }' });
  await server.transformRequest('/Card.tsx');
  const source = await css(server);
  expect(source).toContain('https://example.invalid/a.svg?q=1#shape');
  expect(source).toContain('url("#mask")');
  expect(source).toContain('data:image/svg+xml,');
  expect(source).not.toContain('/@gss-l/assets/');
});

it.each(['raw', 'url', 'import'])('delivers bytes without interpreting the authored ?%s query as a JS request', async (query) => {
  const { server, origin } = await fixture({ 'Card.gss': `.card { background-image: url(./icon.svg?${query}#shape); }` });
  await server.transformRequest('/Card.tsx');
  const url = imageUrl(await css(server));
  expect(url).toContain(`?${query}&`);
  const response = await fetch(new URL(url, origin));
  expect(response.status).toBe(200);
  expect(await response.text()).toBe('<svg xmlns="http://www.w3.org/2000/svg"/>');
});

it('serves rebased, versioned local and public resources through Vite', async () => {
  const { server, origin } = await fixture({
    'Card.gss': '.card { background-image: url(./icon.svg?v=1#shape), url(/logo.svg); }',
    'public/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg"><circle/></svg>'
  }, { base: '/app/' });
  await server.transformRequest('/Card.tsx');
  const source = await css(server);
  const urls = [...source.matchAll(/url\("([^"]+)"\)/g)].map((match) => match[1]!);
  expect(urls).toHaveLength(2);
  expect(urls[0]).toContain('v=1');
  expect(urls[0]).toContain('#shape');
  for (const url of urls) {
    expect(url).toMatch(/^\/app\//);
    expect(url).toContain('gss-v=');
    const response = await fetch(new URL(url, origin));
    expect(response.status, url).toBe(200);
    expect(await response.text()).toContain('<svg');
  }
});
