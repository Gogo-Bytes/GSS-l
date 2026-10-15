/* global document, getComputedStyle, console, Image, URL */
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { build, createServer, preview } from 'vite';
import { chromium } from 'playwright';

const sourceRoot = fileURLToPath(new URL('.', import.meta.url));
const artifacts = fileURLToPath(new URL('../../../artifacts/playground/', import.meta.url));
let sandbox;
const report = { expectedDevErrors: [], pageErrors: [] };
let server;
let browser;
let page;
let expectedError = false;
function address(server) {
  const value = server.httpServer.address();
  if (!value || typeof value === 'string') throw new Error('Missing playground address');
  return `http://127.0.0.1:${value.port}/`;
}
async function color(testid, expected) {
  await page.waitForFunction(([id, value]) => {
    const element = document.querySelector(`[data-testid="${id}"]`);
    return element && getComputedStyle(element).color === value;
  }, [testid, expected]);
}
async function liveChecks() {
  await color('live-title', 'rgb(255, 0, 0)');
  await color('implicit-title', 'rgb(255, 0, 0)');
  await page.getByTestId('implicit-toggle').click();
  await color('implicit-title', 'rgb(0, 128, 0)');
  await page.getByTestId('toggle-active').click();
  await color('live-title', 'rgb(0, 0, 255)');
  await page.getByTestId('toggle-alias').click();
  await color('live-title', 'rgb(0, 128, 0)');
  await page.locator('#relation-check').check();
  await color('relation-label', 'rgb(0, 0, 255)');
  await page.getByTestId('toggle-external').click();
  await color('external-node', 'rgb(255, 0, 0)');
  await page.getByTestId('load-lazy').click();
  await color('lazy-card', 'rgb(255, 255, 255)');
  const data = await page.evaluate(async () => {
    const asset = getComputedStyle(document.querySelector('[data-testid="asset"]')).backgroundImage;
    const url = /^url\("([^"]+)"\)$/.exec(asset)?.[1];
    if (!url) throw new Error('Missing computed Asset URL');
    const image = new Image(); image.src = url; await image.decode();
    return { size: [image.naturalWidth, image.naturalHeight],
      links: [...document.querySelectorAll('link[rel="stylesheet"]')].filter((link) =>
        link.href.includes('/@gss-l/central.css') || /\/assets\/gss-[^/]+\.css/.test(link.href)).length,
      external: document.querySelector('[data-testid="external-node"]').classList.contains('focused'),
      implicit: document.querySelector('[data-testid="implicit-title"]').className };
  });
  assert.deepEqual(data.size, [72, 40]);
  assert.equal(data.links, 1);
  assert.equal(data.external, true);
  assert.ok(data.implicit && !data.implicit.includes('[object Object]'));
  return data;
}
async function explorerChecks() {
  await page.getByRole('button', { name: 'Native fixtures', exact: true }).click();
  await page.getByTestId('fixture-status').filter({ hasText: /^PASS/ }).waitFor();
  await page.getByLabel('Fixture', { exact: true }).selectOption('native-empty-attribute-module-isolation');
  await page.getByTestId('fixture-status').filter({ hasText: /^PASS/ }).waitFor();
  await page.getByLabel('Phase', { exact: true }).selectOption('1');
  await page.getByTestId('fixture-status').filter({ hasText: /^PASS/ }).waitFor();
  assert.equal(await page.getByLabel('Phase', { exact: true }).inputValue(), '1');
  await page.getByTestId('run-all').click();
  await page.waitForFunction(() => /^(PASS|FAIL)/.test(document.querySelector('[data-testid="sweep-status"]')?.textContent ?? ''), undefined, { timeout: 120_000 });
  const sweep = await page.getByTestId('sweep-status').textContent();
  assert.ok(sweep.startsWith('PASS · 123 fixtures / 1260 comparisons'), sweep);
  await page.getByRole('button', { name: 'Compiler only', exact: true }).click();
  await page.getByTestId('compiler-status').waitFor();
  await page.getByLabel('Compiler case', { exact: true }).selectOption('duplicate-property');
  assert.match(await page.getByTestId('compiler-status').textContent(), /expected rejected · committed false · rollback true/);
  await page.getByLabel('Compiler case', { exact: true }).selectOption('conditional-keyframes');
  assert.match(await page.getByTestId('compiler-status').textContent(), /compiler-only · expected atomic · committed true/);
  await page.getByRole('button', { name: 'React transform', exact: true }).click();
  await page.getByTestId('adapter-status').waitFor();
  await page.getByLabel('Adapter case', { exact: true }).selectOption('mutable-alias');
  assert.match(await page.locator('section').textContent(), /GSS2103/);
  await page.getByLabel('Adapter case', { exact: true }).selectOption('alias-member-boundary');
  assert.match(await page.getByTestId('adapter-status').textContent(), /KNOWN BOUNDARY/);
  await page.getByRole('button', { name: 'React + Vite', exact: true }).click();
  return { sweep, phaseSelection: true, negativeRollback: true, compilerOnlyLabel: true, adapterDiagnosticsAndBoundary: true };
}
try {
  await mkdir(artifacts, { recursive: true });
  // HMR/error probes only mutate a disposable copy, never an author's files.
  sandbox = await mkdtemp(join(artifacts, 'run-'));
  const root = join(sandbox, 'playground');
  await cp(sourceRoot, root, { recursive: true, filter: (source) => source !== join(sourceRoot, 'dist') });
  const tsconfig = JSON.parse(await readFile(join(root, 'tsconfig.json'), 'utf8'));
  await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ ...tsconfig,
    extends: fileURLToPath(new URL('../../../tsconfig.base.json', import.meta.url)) }));
  await symlink(fileURLToPath(new URL('../browser/', import.meta.url)), join(sandbox, 'browser'), 'dir');
  await symlink(fileURLToPath(new URL('../node_modules/', import.meta.url)), join(sandbox, 'node_modules'), 'dir');
  const configFile = join(root, 'vite.config.ts');
  const sourcePath = join(root, 'Live.gss');
  const original = await readFile(sourcePath, 'utf8');
  browser = await chromium.launch({ headless: true });
  server = await createServer({ configFile, logLevel: 'silent', server: { port: 0, strictPort: false } });
  await server.listen();
  page = await browser.newPage();
  page.on('pageerror', (error) => (expectedError ? report.expectedDevErrors : report.pageErrors).push(String(error)));
  const devUrl = address(server);
  await page.goto(devUrl);
  await color('live-title', 'rgb(255, 0, 0)');
  const changed = original.replace('.card .title { color: red; }', '.card .title { color: orange; }');
  assert.notEqual(changed, original);
  await writeFile(sourcePath, changed);
  await color('live-title', 'rgb(255, 165, 0)');
  expectedError = true;
  await writeFile(sourcePath, changed + '\n.invalid { color: red; color: blue; }\n');
  await page.locator('vite-error-overlay').waitFor({ state: 'attached' });
  await color('live-title', 'rgb(255, 165, 0)');
  await writeFile(sourcePath, original);
  await page.locator('vite-error-overlay').waitFor({ state: 'detached' });
  await color('live-title', 'rgb(255, 0, 0)');
  expectedError = false;
  report.dev = { hmr: true, lastKnownGood: true, recovery: true,
    live: await liveChecks(), explorer: await explorerChecks() };
  await page.screenshot({ path: join(artifacts, 'dev.png'), fullPage: true });
  await page.close(); await server.close(); server = undefined;
  await build({ configFile, logLevel: 'silent' });
  const manifest = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
  assert.ok(manifest.compiler.modules.some((id) => id.endsWith('/Lazy.gss') || id === 'Lazy.gss'));
  assert.equal(manifest.version, 2);
  server = await preview({ configFile, logLevel: 'silent', preview: { port: 0, strictPort: false } });
  page = await browser.newPage();
  page.on('pageerror', (error) => report.pageErrors.push(String(error)));
  await page.goto(address(server));
  report.production = { lazyCensus: true, manifest: true,
    live: await liveChecks(), explorer: await explorerChecks() };
  await page.screenshot({ path: join(artifacts, 'preview.png'), fullPage: true });
  assert.deepEqual(report.pageErrors, []);
  report.passed = true;
  console.log('Playground passed: dev HMR/LKG/recovery; JSX/TSX/state/external/asset/lazy; production census; 123 fixtures / 1260 comparisons in both dev and preview; Compiler-only negative rollback.');
} catch (error) {
  report.passed = false; report.error = String(error);
  await page?.screenshot({ path: join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  try {
    await writeFile(join(artifacts, 'result.json'), JSON.stringify(report, null, 2));
  } finally {
    try { await browser?.close(); } finally {
      try {
        if (server) {
          if ('close' in server) await server.close();
          else await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
        }
      } finally { if (sandbox) await rm(sandbox, { recursive: true, force: true }); }
    }
  }
}
