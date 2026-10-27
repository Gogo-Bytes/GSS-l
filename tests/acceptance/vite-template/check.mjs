/* global window, document, getComputedStyle, Image, URL, fetch, setTimeout, performance */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import console from 'node:console';
import { chromium } from 'playwright';

const fixture = dirname(fileURLToPath(import.meta.url));
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const evidence = join(repo, 'artifacts/vite-template', new Date().toISOString().replaceAll(':', '-'));
await mkdir(evidence, { recursive: true });
const external = await realpath(await mkdtemp(join(tmpdir(), 'gss-vite-template-')));
const app = join(external, 'app');
const report = { passed: false, external, browser: 'Chromium only', commands: [], phases: [], routing: [], pageErrors: [] };
let browser, page, server;
let expectedError = false;

async function run(command, args, cwd = repo) {
  const index = report.commands.length;
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (data) => { output += data; });
  const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
  await writeFile(join(evidence, `command-${index}.log`), output);
  report.commands.push({ command: [command, ...args].join(' '), cwd, code });
  assert.equal(code, 0, output);
  return output;
}
async function stop() {
  if (!server) return;
  const child = server;
  server = undefined;
  const closed = new Promise((resolve) => child.once('close', resolve));
  child.kill('SIGTERM');
  await closed;
}
async function serve(mode) {
  server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', ...(mode === 'preview' ? ['preview'] : []), '--host', '127.0.0.1', '--port', '5196', '--strictPort'], { cwd: app, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', (data) => { output += data; });
  server.on('close', () => { void writeFile(join(evidence, `${mode}-server.log`), output); });
  const deadline = Date.now() + 30000;
  while (true) {
    assert.equal(server.exitCode, null, output);
    try { if ((await fetch('http://127.0.0.1:5196/')).ok) break; } catch { /* Wait for the external CLI host. */ }
    assert.ok(Date.now() < deadline, output);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
async function color(value) {
  await page.waitForFunction((expected) => {
    const node = document.querySelector('[data-testid="title"]');
    return node && getComputedStyle(node).color === expected;
  }, value);
}
async function observe(phase) {
  const state = await page.evaluate(() => ({
    pathname: window.location.pathname,
    title: getComputedStyle(document.querySelector('[data-testid="title"]')).color,
    className: document.querySelector('[data-testid="title"]').className,
    count: [...document.querySelectorAll('button')].find((node) => node.textContent.startsWith('Count ')).textContent,
    documentMarker: window.__consumerDocument ?? null
  }));
  report.phases.push({ phase, ...state });
  return state;
}
async function asset(testId, width, height) {
  const actual = await page.getByTestId(testId).evaluate(async (node) => {
    const css = getComputedStyle(node);
    const url = css.backgroundImage.slice(5, -2);
    const image = new Image(); image.src = url; await image.decode();
    return { width: css.width, height: css.height, imageWidth: image.naturalWidth, imageHeight: image.naturalHeight };
  });
  assert.deepEqual(actual, { width, height, imageWidth: 3, imageHeight: 2 });
}
async function centralCss() {
  return page.locator('link[rel="stylesheet"]').evaluateAll((nodes) =>
    nodes.filter((node) => /gss-[^/]+\.css/.test(node.href)).map((node) => node.href));
}
async function route(mode, phase, path, marker, count, cssLinks) {
  await page.waitForURL(`http://127.0.0.1:5196${path}`);
  assert.equal(await page.evaluate(() => window.location.pathname), path);
  await color('rgb(180, 20, 30)');
  if (path === '/') {
    await page.getByRole('heading', { name: 'Home route', exact: true }).waitFor();
    assert.equal(await page.getByTestId('detail').count(), 0);
    await asset('asset', '30px', '20px');
  } else {
    await page.getByRole('heading', { name: `Detail route ${path.split('/').at(-1)}`, exact: true }).waitFor();
    assert.equal(await page.getByTestId('home').count(), 0);
    assert.equal(await page.getByTestId('detail').evaluate((node) => getComputedStyle(node).color), 'rgb(20, 100, 40)');
    await asset('detail-asset', '24px', '16px');
  }
  assert.equal(await page.evaluate(() => window.__consumerDocument ?? null), marker);
  assert.equal(await page.getByRole('button', { name: `Count ${count}`, exact: true }).count(), 1);
  if (mode === 'production') {
    const links = await centralCss();
    assert.equal(links.length, 1);
    if (cssLinks) assert.deepEqual(links, cssLinks);
  }
  report.routing.push({ mode, phase, path, documentMarker: marker, count, literalStylesAndAssets: true });
}
async function baseline(mode) {
  await color('rgb(180, 20, 30)');
  const title = page.getByTestId('title');
  assert.match(await title.getAttribute('class'), /gss-/);
  assert.notEqual(await title.getAttribute('class'), '[object Object]');
  const cssLinks = mode === 'production' ? await centralCss() : undefined;
  await route(mode, 'initial-home', '/', null, 0, cssLinks);
  const lazyRequested = () => page.evaluate(() => performance.getEntriesByType('resource')
    .some((entry) => /Detail(?:\.tsx|-[^/]+\.js)/.test(entry.name)));
  assert.equal(await lazyRequested(), false);
  await page.getByRole('button', { name: 'Count 0', exact: true }).click();
  await page.evaluate(() => { window.__consumerDocument = 'client-navigation'; });
  await page.getByRole('link', { name: 'Open detail', exact: true }).click();
  await route(mode, 'link-detail', '/details/42', 'client-navigation', 1, cssLinks);
  assert.equal(await lazyRequested(), true);
  await page.goBack();
  await route(mode, 'history-back', '/', 'client-navigation', 1, cssLinks);
  await page.goForward();
  await route(mode, 'history-forward', '/details/42', 'client-navigation', 1, cssLinks);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await route(mode, 'link-home', '/', 'client-navigation', 1, cssLinks);
  report.routingLazy = { ...report.routingLazy, [mode]: { absentBeforeNavigation: true, requestedOnDetail: true } };
  return observe(mode);
}
async function deepLinks(mode) {
  const response = await page.goto('http://127.0.0.1:5196/details/99');
  assert.equal(response.status(), 200);
  assert.match(response.headers()['content-type'], /text\/html/);
  await route(mode, 'direct-deep-link', '/details/99', null, 0);
  await page.evaluate(() => { window.__consumerDocument = 'before-reload'; });
  const reloaded = await page.reload();
  assert.equal(reloaded.status(), 200);
  await route(mode, 'reload-deep-link', '/details/99', null, 0);
  await page.evaluate(() => { window.__consumerDocument = 'deep-link-return'; });
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await route(mode, 'deep-link-home', '/', 'deep-link-return', 0);
}
try {
  report.sourceCommit = (await run('git', ['rev-parse', 'HEAD'])).trim();
  report.node = process.version;
  report.pnpm = (await run('corepack', ['pnpm', '--version'])).trim();
  report.router = JSON.parse(await run('npm', ['view', 'react-router@8.5.0', 'version', 'engines', 'peerDependencies', '--json']));
  report.routerMode = 'Declarative BrowserRouter, client-only';
  await run('npm', ['exec', '--yes', '--package=create-vite@9.3.1', '--', 'create-vite', 'app', '--template', 'react-ts', '--no-interactive'], external);
  await cp(app, join(evidence, 'official-template'), { recursive: true });
  await cp(join(fixture, 'app'), app, { recursive: true });
  const pkg = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'));
  // Pin the actual template toolchain; never replace Vite 8 with the workspace's Vite 7.
  Object.assign(pkg.dependencies, { react: '19.3.1', 'react-dom': '19.3.1', 'react-router': '8.5.0' });
  Object.assign(pkg.devDependencies, { vite: '8.3.5', '@vitejs/plugin-react': '6.1.2', typescript: '6.0.3',
    '@types/node': '24.19.2', '@types/react': '19.3.0', '@types/react-dom': '19.3.0', oxlint: '1.88.0' });
  pkg.packageManager = 'pnpm@8.6.2';
  const tarballs = join(external, 'tarballs');
  await mkdir(tarballs);
  await mkdir(join(evidence, 'tarballs'));
  pkg.pnpm = { overrides: {} };
  report.tarballs = [];
  for (const name of ['types', 'compiler', 'react', 'vite']) {
    await run('corepack', ['pnpm', 'pack', '--pack-destination', tarballs],
      join(repo, { types: 'types', compiler: 'compiler', react: 'adapters/react', vite: 'integrations/vite' }[name]));
    const file = join(tarballs, `gss-l-${name}-0.0.0.tgz`);
    const dependency = `file:../tarballs/gss-l-${name}-0.0.0.tgz`;
    pkg.devDependencies[`@gss-l/${name}`] = dependency;
    // Workspace versions are unpublished: resolve every transitive edge to the unmodified local tarball.
    pkg.pnpm.overrides[`@gss-l/${name}`] = dependency;
    const bytes = await readFile(file);
    report.tarballs.push({ name, sha256: createHash('sha256').update(bytes).digest('hex') });
    await cp(file, join(evidence, 'tarballs', `gss-l-${name}-0.0.0.tgz`));
  }
  await writeFile(join(app, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  await writeFile(join(app, 'vite.config.ts'), `import react from '@vitejs/plugin-react'\nimport { defineConfig } from 'vite'\nimport { gss } from '@gss-l/vite'\nimport { react as gssReact } from '@gss-l/react'\nexport default defineConfig({ plugins: [gss({ adapter: gssReact() }), react()], build: { manifest: true } })\n`);
  await writeFile(join(app, 'src/gss.d.ts'), '/// <reference types="@gss-l/vite/client" />\n');
  await writeFile(join(app, '.npmrc'), 'strict-peer-dependencies=true\n');
  await run('corepack', ['pnpm', 'install', '--strict-peer-dependencies'], app);
  await run('corepack', ['pnpm', 'install', '--frozen-lockfile', '--strict-peer-dependencies'], app);
  for (const file of ['package.json', 'pnpm-lock.yaml', 'vite.config.ts', 'tsconfig.app.json', 'tsconfig.node.json', 'tsconfig.json', '.npmrc']) await cp(join(app, file), join(evidence, file));
  await cp(join(app, 'src'), join(evidence, 'consumer-src'), { recursive: true });
  await run('corepack', ['pnpm', 'exec', 'tsc', '-b'], app);
  // Prove package resolution cannot escape to workspace sources or node_modules.
  const resolution = await run(process.execPath, ['--input-type=module', '-e', `import { realpathSync } from 'node:fs'; import { fileURLToPath } from 'node:url'; for (const name of ['@gss-l/types','@gss-l/compiler','@gss-l/react','@gss-l/vite','vite','react-router']) console.log(name,realpathSync(fileURLToPath(import.meta.resolve(name))));`], app);
  assert.ok(!resolution.includes(repo), resolution);
  report.resolution = resolution;
  browser = await chromium.launch({ headless: true });
  report.browserVersion = browser.version();
  page = await browser.newPage();
  page.on('pageerror', (error) => { if (!expectedError) report.pageErrors.push(String(error)); });
  await serve('dev');
  await page.goto('http://127.0.0.1:5196/');
  const initial = await baseline('dev');
  const sheet = join(app, 'src/App.gss');
  const original = await readFile(sheet, 'utf8');
  await page.evaluate(() => { window.__consumerDocument = 'before-react-refresh'; });
  const childPath = join(app, 'src/Child.tsx');
  const childSource = await readFile(childPath, 'utf8');
  await writeFile(childPath, childSource.replace('External GSS consumer', 'Updated GSS consumer'));
  await page.getByRole('heading', { name: 'Updated GSS consumer' }).waitFor();
  assert.equal(await page.getByRole('button', { name: 'Count 1', exact: true }).count(), 1);
  assert.equal(await page.evaluate(() => window.__consumerDocument), 'before-react-refresh');
  await observe('react-refresh-state-preserved');
  const changed = original.replace('180, 20, 30', '30, 60, 180');
  await writeFile(sheet, changed);
  await color('rgb(30, 60, 180)');
  // This official React plugin accepts the update; the general GSS contract still permits reloads.
  assert.equal(await page.evaluate(() => window.__consumerDocument), 'before-react-refresh');
  assert.equal(await page.getByRole('button', { name: 'Count 1', exact: true }).count(), 1);
  const edited = await observe('gss-edit-same-document-state-preserved');
  assert.notEqual(edited.className, initial.className);
  await page.getByRole('button', { name: 'Count 1', exact: true }).click();
  await page.getByRole('button', { name: 'Count 2', exact: true }).waitFor();
  await page.evaluate(() => { window.__consumerDocument = 'invalid-lkg'; });
  expectedError = true;
  await writeFile(sheet, changed + '\n.invalid { color: red; color: blue; }\n');
  await page.locator('vite-error-overlay').waitFor({ state: 'attached' });
  await color('rgb(30, 60, 180)');
  assert.equal(await page.evaluate(() => window.__consumerDocument), 'invalid-lkg');
  assert.equal(await page.getByRole('button', { name: 'Count 2', exact: true }).count(), 1);
  assert.equal((await observe('invalid-overlay-lkg-state-preserved')).className, edited.className);
  await writeFile(sheet, original);
  await page.locator('vite-error-overlay').waitFor({ state: 'detached' });
  await color('rgb(180, 20, 30)');
  assert.equal(await page.evaluate(() => window.__consumerDocument), 'invalid-lkg');
  expectedError = false;
  assert.equal(await page.getByRole('button', { name: 'Count 2', exact: true }).count(), 1);
  assert.equal((await observe('recovery-same-document-state-preserved')).className, initial.className);
  await deepLinks('dev');
  await stop();
  await run('corepack', ['pnpm', 'build'], app);
  await cp(join(app, 'dist'), join(evidence, 'dist'), { recursive: true });
  const manifest = JSON.parse(await readFile(join(app, 'dist/gss-manifest.json'), 'utf8'));
  assert.deepEqual(manifest.compiler.modules, ['src/App.gss', 'src/Detail.gss']);
  assert.equal(manifest.compiler.preservedRules.length, 0);
  assert.ok(manifest.compiler.moduleDetails.every((entry) => entry.compilationMode === 'atomic'));
  assert.ok(manifest.compiler.rules.some((rule) => rule.sources.includes('src/Detail.gss') &&
    rule.property === 'color' && rule.value === 'rgb(20, 100, 40)'), 'Lazy detail CSS must be in initial census');
  await serve('preview');
  await page.goto('http://127.0.0.1:5196/');
  assert.equal(await page.locator('link[rel="stylesheet"]').evaluateAll((nodes) => nodes.filter((node) => /gss-[^/]+\.css/.test(node.href)).length), 1);
  await baseline('production');
  await deepLinks('production');
  await page.getByRole('link', { name: 'Open detail', exact: true }).click();
  await route('production', 'before-route-canary', '/details/42', 'deep-link-return', 0);
  const routeCanary = await page.addStyleTag({ content: '[data-testid="detail"] { color: rgb(1, 2, 3) !important; }' });
  await assert.rejects(() => route('production', 'corrupted-route', '/details/42', 'deep-link-return', 0), { code: 'ERR_ASSERTION' });
  await routeCanary.evaluate((node) => node.remove());
  await route('production', 'restored-route', '/details/42', 'deep-link-return', 0);
  await page.getByRole('link', { name: 'Home', exact: true }).click();
  await route('production', 'restored-home', '/', 'deep-link-return', 0);
  report.routingNegativeControl = { literalRouteColorCorruptionDetected: true, restored: true };
  const canary = await page.addStyleTag({ content: '[data-testid="title"] { color: rgb(1, 2, 3) !important; }' });
  assert.notEqual(await page.getByTestId('title').evaluate((node) => getComputedStyle(node).color), 'rgb(180, 20, 30)');
  await canary.evaluate((node) => node.remove());
  await color('rgb(180, 20, 30)');
  report.negativeControl = { corruptedTitleDetected: true, restored: true };
  await page.screenshot({ path: join(evidence, 'production.png'), fullPage: true });
  assert.deepEqual(report.pageErrors, []);
  report.passed = true;
} catch (error) {
  report.error = error.stack ?? String(error);
  await page?.screenshot({ path: join(evidence, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await browser?.close();
  await stop();
  await writeFile(join(evidence, 'result.json'), JSON.stringify(report, null, 2));
  console.log(`External Vite template evidence: ${evidence}`);
}
