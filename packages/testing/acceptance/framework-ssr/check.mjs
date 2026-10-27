/* global window, getComputedStyle, Image, URL, fetch, setTimeout, performance */
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
const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const evidence = join(repo, 'artifacts/framework-ssr', new Date().toISOString().replaceAll(':', '-'));
await mkdir(evidence, { recursive: true });
const external = await realpath(await mkdtemp(join(tmpdir(), 'gss-framework-ssr-')));
const app = join(external, 'app');
const origin = 'http://127.0.0.1:5197';
const report = { passed: false, external, node: process.version, browser: 'Chromium only', commands: [], requests: [], phases: [], errors: [], tarballs: [] };
let server, browser, serverMode;
let serverOutput = '';
async function run(command, args, cwd = repo) {
  const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let output = '';
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (data) => { output += data; });
  const code = await new Promise((resolve, reject) => { child.once('error', reject); child.once('close', resolve); });
  await writeFile(join(evidence, `command-${report.commands.length}.log`), output);
  report.commands.push({ command: [command, ...args].join(' '), cwd, code });
  assert.equal(code, 0, output);
  return output;
}
async function stop() {
  if (!server) return;
  const child = server; server = undefined;
  if (child.exitCode === null) {
    const closed = new Promise((resolve) => child.once('close', resolve));
    child.kill('SIGTERM');
    await closed;
  }
  await writeFile(join(evidence, `${serverMode}-server.log`), serverOutput);
  assert.doesNotMatch(serverOutput, /hydration.*(?:fail|mismatch)|recoverable error|did not match/i);
}
async function serve(mode) {
  const command = mode === 'dev' ? ['react-router', 'dev', '--host', '127.0.0.1', '--port', '5197', '--strictPort']
    : ['react-router-serve', './build/server/index.js'];
  server = spawn(join(app, 'node_modules/.bin', command[0]), command.slice(1), {
    cwd: app, env: { ...process.env, PORT: '5197', HOST: '127.0.0.1', NODE_ENV: mode === 'dev' ? 'development' : 'production' }, stdio: ['ignore', 'pipe', 'pipe']
  });
  serverMode = mode; serverOutput = '';
  for (const stream of [server.stdout, server.stderr]) stream.on('data', (data) => { serverOutput += data; });
  const deadline = Date.now() + 30000;
  while (true) {
    assert.equal(server.exitCode, null, serverOutput);
    try { if ((await fetch(origin)).ok) return; } catch { /* Wait for the actual framework CLI server. */ }
    assert.ok(Date.now() < deadline, serverOutput);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
async function styles(page, path, mode) {
  const testId = path === '/' ? 'title' : 'detail';
  await page.getByTestId(testId).waitFor();
  const expected = path === '/' ? 'rgb(180, 20, 30)' : 'rgb(20, 100, 40)';
  const state = await page.getByTestId(testId).evaluate((node) => ({ color: getComputedStyle(node).color, className: node.className }));
  assert.equal(state.color, expected);
  assert.match(state.className, /gss-/);
  assert.notEqual(state.className, '[object Object]');
  const art = await page.getByTestId('art').evaluate(async (node) => {
    const css = getComputedStyle(node);
    const image = new Image(); image.src = css.backgroundImage.slice(5, -2); await image.decode();
    return { width: css.width, height: css.height, decodedWidth: image.naturalWidth, decodedHeight: image.naturalHeight };
  });
  assert.deepEqual(art, { width: path === '/' ? '30px' : '24px', height: path === '/' ? '20px' : '16px', decodedWidth: 3, decodedHeight: 2 });
  const links = await page.locator('link[rel="stylesheet"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('href')).filter((href) => /gss-|@gss-l\/stylesheet/.test(href)));
  assert.equal(links.length, 1, JSON.stringify(links));
  if (mode === 'production') assert.equal(links[0], report.productionHref);
  return { ...state, art, href: links[0] };
}
async function requests(mode) {
  for (const [path, token] of [['/', 'first-request'], ['/', 'second-request'], ['/details/99', 'deep-request']]) {
    const response = await fetch(`${origin}${path}?token=${token}`);
    assert.equal(response.status, 200);
    const html = await response.text();
    await writeFile(join(evidence, `${mode}-${token}.html`), html);
    assert.ok(html.includes(token));
    assert.ok(!html.includes(token === 'first-request' ? 'second-request' : 'first-request'));
    assert.match(html, /gss-/);
    const links = [...html.matchAll(/<link\b[^>]*href="([^"]+)"[^>]*>/g)].map((match) => match[1]).filter((href) => /gss-|@gss-l\/stylesheet/.test(href));
    assert.equal(links.length, 1);
    if (mode === 'production') assert.equal(links[0], report.productionHref);
    const css = await fetch(new URL(links[0], origin), { headers: { accept: 'text/css' } });
    assert.equal(css.status, 200);
    assert.match(css.headers.get('content-type'), /css/);
    assert.match(await css.text(), /180/);
    report.requests.push({ mode, path, token, href: links[0], status: 200, requestDataInHTML: true });
  }
}
async function browserChecks(mode) {
  await requests(mode);
  const nojs = await browser.newContext({ javaScriptEnabled: false });
  const js = await browser.newContext();
  try {
    for (const [context, enabled] of [[nojs, false], [js, true]]) {
      const page = await context.newPage();
      page.on('pageerror', (error) => report.errors.push({ mode, error: String(error) }));
      page.on('console', (message) => { if (message.type() === 'error') report.errors.push({ mode, error: message.text() }); });
      for (const path of ['/', '/details/99']) {
        const response = await page.goto(`${origin}${path}?token=browser-request`, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        assert.equal(await page.getByTestId('token').textContent(), 'browser-request');
        const state = await styles(page, path, mode);
        if (path !== '/') await page.getByRole('heading', { name: 'Detail 99', exact: true }).waitFor();
        if (enabled) {
          await page.getByRole('button', { name: 'Count 0', exact: true }).click();
          await page.getByRole('button', { name: 'Count 1', exact: true }).waitFor();
        }
        report.phases.push({ mode, path, javaScriptEnabled: enabled, ...state });
        await page.screenshot({ path: join(evidence, `${mode}-${enabled ? 'hydrated' : 'nojs'}-${path === '/' ? 'home' : 'detail'}.png`), fullPage: true });
      }
      await page.close();
    }
    const page = await js.newPage();
    page.on('pageerror', (error) => report.errors.push({ mode, error: String(error) }));
    page.on('console', (message) => { if (message.type() === 'error') report.errors.push({ mode, error: message.text() }); });
    await page.goto(origin, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Count 0', exact: true }).click();
    await page.evaluate(() => { window.__ssrDocument = 'client-navigation'; });
    if (mode === 'production') {
      assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => /\/detail-[^/]+\.js/.test(entry.name))), false);
    }
    await page.getByRole('link', { name: 'Detail', exact: true }).click();
    await page.waitForURL(`${origin}/details/42`);
    await styles(page, '/details/42', mode);
    await page.getByRole('heading', { name: 'Detail 42', exact: true }).waitFor();
    assert.equal(await page.getByTestId('token').textContent(), 'none');
    if (mode === 'production') assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').some((entry) => /\/detail-[^/]+\.js/.test(entry.name))), true);
    await page.goBack(); await page.waitForURL(origin + '/'); await styles(page, '/', mode);
    await page.goForward(); await page.waitForURL(`${origin}/details/42`); await styles(page, '/details/42', mode);
    assert.equal(await page.evaluate(() => window.__ssrDocument), 'client-navigation');
    assert.equal(await page.getByRole('button', { name: 'Count 1', exact: true }).count(), 1);
    const canary = await page.addStyleTag({ content: '[data-testid="detail"] { color: rgb(1, 2, 3) !important; }' });
    await assert.rejects(() => styles(page, '/details/42', mode), { code: 'ERR_ASSERTION' });
    await canary.evaluate((node) => node.remove());
    await styles(page, '/details/42', mode);
    await page.reload({ waitUntil: 'networkidle' });
    await styles(page, '/details/42', mode);
    assert.equal(await page.evaluate(() => window.__ssrDocument), undefined);
    assert.equal(await page.getByRole('button', { name: 'Count 0', exact: true }).count(), 1);
    report.phases.push({ mode, navigationHistoryLazyAndReload: true, negativeControl: true });
    await page.close();
  } finally { await nojs.close(); await js.close(); }
}
try {
  report.sourceCommit = (await run('git', ['rev-parse', 'HEAD'])).trim();
  await writeFile(join(evidence, 'source.diff'), await run('git', ['diff', '--binary']));
  await cp(fileURLToPath(import.meta.url), join(evidence, 'check.mjs'));
  report.pnpm = (await run('corepack', ['pnpm', '--version'])).trim();
  report.framework = JSON.parse(await run('npm', ['view', '@react-router/dev@8.5.0', 'version', 'engines', 'peerDependencies', '--json']));
  await run('npm', ['exec', '--yes', '--package=create-react-router@8.5.0', '--', 'create-react-router', 'app', '--no-install', '--no-git-init', '--yes'], external);
  await cp(app, join(evidence, 'official-template'), { recursive: true });
  await cp(join(fixture, 'app'), join(app, 'app'), { recursive: true });
  const pkg = JSON.parse(await readFile(join(app, 'package.json'), 'utf8'));
  for (const name of ['@react-router/node', '@react-router/serve', 'react-router']) pkg.dependencies[name] = '8.5.0';
  Object.assign(pkg.dependencies, { react: '19.3.1', 'react-dom': '19.3.1', isbot: '5.1.36' });
  Object.assign(pkg.devDependencies, { '@react-router/dev': '8.5.0', vite: '8.3.5', typescript: '6.0.3', '@types/node': '24.19.2', '@types/react': '19.3.0', '@types/react-dom': '19.3.0', '@tailwindcss/vite': '4.2.2', tailwindcss: '4.2.2' });
  pkg.packageManager = 'pnpm@8.6.2'; pkg.pnpm = { overrides: {} };
  await mkdir(join(external, 'tarballs')); await mkdir(join(evidence, 'tarballs'));
  for (const name of ['types', 'compiler', 'react', 'vite']) {
    await run('corepack', ['pnpm', 'pack', '--pack-destination', join(external, 'tarballs')],
      join(repo, { types: 'types', compiler: 'compiler', react: 'adapters/react', vite: 'integrations/vite' }[name]));
    const file = join(external, 'tarballs', `gss-l-${name}-0.0.0.tgz`);
    const dependency = `file:../tarballs/gss-l-${name}-0.0.0.tgz`;
    pkg.devDependencies[`@gss-l/${name}`] = dependency;
    pkg.pnpm.overrides[`@gss-l/${name}`] = dependency;
    report.tarballs.push({ name, sha256: createHash('sha256').update(await readFile(file)).digest('hex') });
    await cp(file, join(evidence, 'tarballs', `gss-l-${name}-0.0.0.tgz`));
  }
  await writeFile(join(app, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  await writeFile(join(app, '.npmrc'), 'strict-peer-dependencies=true\n');
  const config = await readFile(join(app, 'vite.config.ts'), 'utf8');
  await writeFile(join(app, 'vite.config.ts'), `import {gss} from '@gss-l/vite';\nimport {react} from '@gss-l/react';\n` + config.replace('plugins: [', 'plugins: [gss({adapter:react()}), '));
  await run('corepack', ['pnpm', 'install', '--strict-peer-dependencies'], app);
  await run('corepack', ['pnpm', 'install', '--frozen-lockfile', '--strict-peer-dependencies'], app);
  for (const file of ['package.json', 'pnpm-lock.yaml', 'vite.config.ts', 'react-router.config.ts', 'tsconfig.json', '.npmrc']) await cp(join(app, file), join(evidence, file));
  await cp(join(app, 'app'), join(evidence, 'consumer-app'), { recursive: true });
  await run('corepack', ['pnpm', 'typecheck'], app);
  report.resolution = await run(process.execPath, ['--input-type=module', '-e', `import { realpathSync } from 'node:fs'; import { fileURLToPath } from 'node:url'; for(const name of ['@gss-l/types','@gss-l/compiler','@gss-l/react','@gss-l/vite','vite','react-router','@react-router/dev/vite']) console.log(name,realpathSync(fileURLToPath(import.meta.resolve(name))));`], app);
  assert.ok(!report.resolution.includes(repo));
  browser = await chromium.launch({ headless: true }); report.browserVersion = browser.version();
  await serve('dev'); await browserChecks('dev'); await stop();
  await run('corepack', ['pnpm', 'build'], app);
  await cp(join(app, 'build'), join(evidence, 'build'), { recursive: true });
  const client = JSON.parse(await readFile(join(app, 'build/client/gss-manifest.json'), 'utf8'));
  const serverManifest = JSON.parse(await readFile(join(app, 'build/server/gss-manifest.json'), 'utf8'));
  assert.deepEqual(client.compiler.modules, ['app/routes/detail.gss', 'app/routes/home.gss']);
  assert.equal(client.cssAsset, serverManifest.cssAsset);
  assert.deepEqual(client.compiler, serverManifest.compiler);
  assert.equal(client.compiler.preservedRules.length, 0);
  const css = await readFile(join(app, 'build/client', client.cssAsset), 'utf8');
  // The official framework relocates/deduplicates SSR assets into build/client.
  assert.match(await readFile(join(app, 'build/server/index.js'), 'utf8'), new RegExp(client.cssAsset.replaceAll('.', '\\.')));
  assert.ok(css.length > 0);
  assert.ok(client.compiler.rules.some((rule) => rule.sources.includes('app/routes/detail.gss') &&
    rule.property === 'color' && rule.value === 'rgb(20, 100, 40)'));
  report.productionHref = '/' + client.cssAsset;
  await serve('production'); await browserChecks('production'); await stop();
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.error = error.stack ?? String(error);
  throw error;
} finally {
  await browser?.close(); await stop();
  await writeFile(join(evidence, 'result.json'), JSON.stringify(report, null, 2));
  console.log(`Framework SSR evidence: ${evidence}`);
}
