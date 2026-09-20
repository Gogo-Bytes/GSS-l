import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { build, createLogger, createServer, normalizePath, type ViteDevServer } from 'vite';
import { react } from '@gss-l/react';
import { createGssCompilerSession, type GssSourceAdapter } from '@gss-l/compiler';
import { gss } from '../src/index.js';

const servers: ViteDevServer[] = [];
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function fixture(source = '.card { color: red; }', adapter: GssSourceAdapter = react()) {
  const root = normalizePath(await realpath(await mkdtemp(join(tmpdir(), 'gss-vite-'))));
  roots.push(root);
  await writeFile(join(root, 'Card.gss'), source);
  const warnings: string[] = [];
  const server = await createServer({
    root,
    customLogger: { ...createLogger('silent'), warn: (message) => { warnings.push(message); } },
    configFile: false,
    resolve: { alias: { '@': root } },
    plugins: [gss({ adapter })],
    server: { middlewareMode: true, watch: null, preTransformRequests: false },
    appType: 'custom',
    logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] }
  });
  servers.push(server);
  return { root, server, warnings, container: server.environments.client.pluginContainer };
}

it('resolves physical GSS to a stable virtual JS id without compiling source', async () => {
  const { root, container } = await fixture('.card {');
  const resolved = await container.resolveId('./Card.gss', `${root}/Card.tsx`);
  expect(resolved?.id).toBe(`\0gss-l:${root}/Card.gss`);
  expect((await container.resolveId(`${root}/Card.gss`))?.id).toBe(resolved?.id);
  expect((await container.resolveId(resolved!.id))?.id).toBe(resolved?.id);
});

it('loads generated static JavaScript from the physical stylesheet through Compiler', async () => {
  const source = '.card { color: red; }';
  const { root, container } = await fixture(source);
  const virtualId = (await container.resolveId('./Card.gss', `${root}/Card.tsx`))!.id;
  const expected = createGssCompilerSession({ projectRoot: root }).replaceStylesheet({
    id: `${root}/Card.gss`, source
  });
  expect(await container.load(virtualId)).toBe(expected.module!.moduleCode);
  expect(expected.module!.moduleCode).not.toContain('import ');
});

it('returns preserved fallback JavaScript and reports the Compiler warning', async () => {
  const { root, container, warnings } = await fixture('.card { future-paint: red; }');
  const id = (await container.resolveId('./Card.gss', `${root}/Card.tsx`))!.id;
  expect(await container.load(id)).toContain('export default { card }');
  expect(warnings.join('\n')).toContain('future-paint');
});

it('compiles on demand before dependency load and lowers TSX before Vite esbuild', async () => {
  const { root, server } = await fixture();
  await writeFile(join(root, 'Card.tsx'),
    `import styles from './Card.gss'; export const Card = () => <div className={styles.card} />;`);
  const result = await server.transformRequest('/Card.tsx');
  expect(result?.code).toContain('className: styles.card.self');
  expect(result?.code).not.toContain('<div');
  expect(result?.map).toBeDefined();
});

it('fails a hard replacement without losing the committed schema or masking the next transform', async () => {
  const framework = react();
  let resolveSchema: Parameters<GssSourceAdapter['transform']>[0]['resolveScopeSchema'];
  const { root, container, server } = await fixture(undefined, {
    ...framework,
    transform(input) {
      resolveSchema = input.resolveScopeSchema;
      return framework.transform(input);
    }
  });
  const source = `import styles from './Card.gss'; export const Card = () => <div className={styles.card} />;`;
  await writeFile(join(root, 'Card.tsx'), source);
  await server.transformRequest('/Card.tsx');
  const committedSchema = resolveSchema!('./Card.gss');
  expect(committedSchema?.exports.card).toBeDefined();
  const virtualId = (await container.resolveId('./Card.gss', `${root}/Card.tsx`))!.id;
  await writeFile(join(root, 'Card.gss'), '.card {');
  await expect(container.load(virtualId)).rejects.toMatchObject({ id: `${root}/Card.gss` });
  expect(resolveSchema!('./Card.gss')).toEqual(committedSchema);
  await expect(container.transform(source, `${root}/Card.tsx`)).rejects.toThrow();
  expect(resolveSchema!('./Card.gss')).toEqual(committedSchema);
  await writeFile(join(root, 'Card.gss'), '.card { color: blue; }');
  expect(await container.load(virtualId)).toContain('value_blue');
  expect(resolveSchema!('./Card.gss')?.exports.card?.selfClassName).toContain('value_blue');
});

it('fails source transformation on unknown scope paths', async () => {
  const { root, server } = await fixture();
  await writeFile(join(root, 'Card.tsx'),
    `import styles from './Card.gss'; export const Card = () => <div className={styles.missing} />;`);
  await expect(server.transformRequest('/Card.tsx')).rejects.toThrow(/GSS2102.*styles.missing/);
});

it('requires an explicit Adapter and can compose a non-React Adapter', async () => {
  // @ts-expect-error An Adapter is required for both TypeScript and JavaScript callers.
  expect(() => gss({})).toThrow(/explicit framework Adapter/);
  const { root, server } = await fixture(undefined, {
    supports: (id) => id.endsWith('.view'),
    discoverImports: () => ['./Card.gss'],
    transform({ resolveScopeSchema }) {
      return {
        code: `export default ${JSON.stringify(resolveScopeSchema('./Card.gss')?.exports.card?.selfClassName)};`,
        diagnostics: []
      };
    }
  });
  await writeFile(join(root, 'Card.view'), 'view source');
  expect((await server.transformRequest('/Card.view'))?.code).toContain('value_red');
});

it('canonicalizes aliases and symlinks and round-trips spaces, Unicode and percent signs', async () => {
  const { root, container } = await fixture();
  const filename = '卡片 % space.gss';
  await writeFile(join(root, filename), '.card { color: blue; }');
  await symlink(join(root, filename), join(root, 'linked.gss'));
  const importer = `${root}/Card.tsx`;
  const direct = await container.resolveId(`./${filename}`, importer);
  expect(direct?.id).toBe(`\0gss-l:${root}/${filename}`);
  expect((await container.resolveId(`@/${filename}`, importer))?.id).toBe(direct?.id);
  expect((await container.resolveId('./linked.gss', importer))?.id).toBe(direct?.id);
  expect(await container.load(direct!.id)).toContain('value_blue');
});

it('builds static GSS JavaScript without adding a GSS runtime or per-file declaration', async () => {
  const { root } = await fixture();
  await writeFile(join(root, 'entry.ts'),
    `import styles from './Card.gss'; globalThis.className = styles.card.self;`);
  const result = await build({
    root, configFile: false, plugins: [gss({ adapter: react() })], logLevel: 'silent',
    build: { write: false, minify: false, rollupOptions: { input: `${root}/entry.ts` } }
  });
  if (Array.isArray(result) || !('output' in result)) throw new Error('Expected one bundle.');
  const chunks = result.output.filter((entry) => entry.type === 'chunk');
  expect(chunks).toHaveLength(1);
  expect(result.output.some((entry) => entry.fileName.endsWith('.d.ts'))).toBe(false);
  const chunk = chunks[0];
  if (chunk?.type !== 'chunk') throw new Error('Expected a JavaScript chunk.');
  expect(chunk.code).toContain('value_red');
  expect(chunk.code).not.toMatch(/gss-l:|\.gss|Proxy|import /);
});

it('keeps module-owned names project-relative when the Vite root is a symlink', async () => {
  const { root, container } = await fixture('.card { future-paint: red; }');
  const virtualId = (await container.resolveId('./Card.gss', `${root}/Card.tsx`))!.id;
  const expected = await container.load(virtualId);
  const linkedRoot = `${root}-linked`;
  await symlink(root, linkedRoot);
  roots.push(linkedRoot);
  const server = await createServer({
    root: linkedRoot, configFile: false, plugins: [gss({ adapter: react() })],
    server: { middlewareMode: true, watch: null, fs: { allow: [root] } }, logLevel: 'silent',
    optimizeDeps: { noDiscovery: true, include: [] }
  });
  servers.push(server);
  expect(await server.environments.client.pluginContainer.load(virtualId)).toBe(expected);
});

it('compiles root-external imports, aliases and symlinks with one relative logical identity', async () => {
  const workspace = normalizePath(await realpath(await mkdtemp(join(tmpdir(), 'gss-workspace-'))));
  roots.push(workspace);
  const root = `${workspace}/app`;
  const physicalId = `${workspace}/shared/Card.gss`;
  await mkdir(root);
  await mkdir(`${workspace}/shared`);
  await writeFile(physicalId, '.card { future-paint: red; }');
  await symlink(physicalId, `${root}/Linked.gss`);
  await writeFile(`${root}/Card.tsx`,
    `import styles from '@shared/Card.gss'; export const Card = () => <div className={styles.card} />;`);
  const framework = react();
  const server = await createServer({
    root, configFile: false,
    resolve: { alias: { '@shared': `${workspace}/shared` } },
    plugins: [gss({ adapter: {
      ...framework,
      transform(input) {
        expect(input.resolveScopeSchema('@shared/Card.gss')?.moduleId).toBe('../shared/Card.gss');
        return framework.transform(input);
      }
    } })],
    server: { middlewareMode: true, watch: null, preTransformRequests: false, fs: { allow: [workspace] } },
    logLevel: 'silent', optimizeDeps: { noDiscovery: true, include: [] }
  });
  servers.push(server);
  expect((await server.transformRequest('/Card.tsx'))?.code).toContain('styles.card.self');
  const container = server.environments.client.pluginContainer;
  for (const specifier of ['../shared/Card.gss', '@shared/Card.gss', './Linked.gss']) {
    expect((await container.resolveId(specifier, `${root}/Card.tsx`))?.id).toBe(`\0gss-l:${physicalId}`);
  }
  expect(await container.load(`\0gss-l:${physicalId}`)).toBe(
    'const card = { self: "gss-s--module__2e__2e__2f_shared_2f_Card_2e_gss--path_card" };\n' +
    'export default { card };\n'
  );
});
