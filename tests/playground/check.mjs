/* global document, window, getComputedStyle, console, Image, URL */
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { build, createServer, preview } from 'vite';
import { chromium } from 'playwright';

const sourceRoot = fileURLToPath(new URL('.', import.meta.url));
const artifacts = fileURLToPath(new URL('../../artifacts/playground/', import.meta.url));
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
  assert.equal(await page.getByRole('heading', { level: 1, name: /看得到的样式变化/ }).count(), 1);
  assert.equal(await page.getByTestId('live-source').evaluate((node) => node.open), false);
  assert.equal((await page.locator('body').innerText()).includes('gss-a--'), false);
  await color('live-title', 'rgb(255, 0, 0)');
  await page.getByTestId('toggle-active').click();
  await color('live-title', 'rgb(0, 0, 255)');
  await page.getByTestId('toggle-alias').click();
  await color('live-title', 'rgb(0, 128, 0)');
  await page.getByTestId('reset-demo').click();
  await color('live-title', 'rgb(255, 0, 0)');
  await page.getByTestId('live-source').locator('summary').click();
  assert.equal(await page.getByTestId('live-source').evaluate((node) => node.open), true);
  await page.getByTestId('scene-interactions').click();
  assert.equal(await page.getByTestId('live-title').count(), 0, 'Previous scenes must unmount, not remain hidden');
  assert.equal(await page.getByTestId('live-source').evaluate((node) => node.open), false);
  await page.getByTestId('state-action').hover();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="state-action"]')).backgroundColor === 'rgb(173, 216, 230)');
  await page.getByTestId('toggle-disabled').focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('[data-testid="state-action"]')).outlineColor === 'rgb(0, 0, 255)');
  await page.getByTestId('toggle-disabled').click();
  assert.equal(await page.getByTestId('state-action').isDisabled(), true);
  assert.equal(await page.getByTestId('state-action').evaluate((node) => getComputedStyle(node).opacity), '0.5');
  await page.getByTestId('reset-demo').click();
  assert.equal(await page.getByTestId('state-action').isDisabled(), false);
  await page.getByTestId('scene-relations').click();
  await page.locator('#relation-check').check();
  await color('relation-label', 'rgb(0, 0, 255)');
  await page.getByTestId('observer-check').check();
  await color('observer-node', 'rgb(0, 128, 0)');
  await page.getByTestId('reset-demo').click();
  assert.equal(await page.locator('#relation-check').isChecked(), false);
  assert.equal(await page.getByTestId('observer-check').isChecked(), false);
  await page.getByTestId('scene-external').click();
  await page.getByTestId('toggle-external').click();
  await color('external-node', 'rgb(255, 0, 0)');
  const external = await page.getByTestId('external-node').evaluate((node) => node.classList.contains('focused'));
  assert.equal(external, true);
  await page.getByTestId('scene-resources').click();
  await page.getByTestId('load-lazy').click();
  await color('lazy-card', 'rgb(255, 255, 255)');
  const data = await page.evaluate(async () => {
    const asset = getComputedStyle(document.querySelector('[data-testid="asset"]')).backgroundImage;
    const url = /^url\("([^"]+)"\)$/.exec(asset)?.[1];
    if (!url) throw new Error('Missing computed Asset URL');
    const image = new Image(); image.src = url; await image.decode();
    return { size: [image.naturalWidth, image.naturalHeight],
      links: [...document.querySelectorAll('link[rel="stylesheet"]')].filter((link) =>
        link.href.includes('/@gss-l/central.css') || /\/assets\/gss-[^/]+\.css/.test(link.href)).length };
  });
  assert.deepEqual(data.size, [72, 40]);
  assert.equal(data.links, 1);
  await page.getByTestId('scene-implicit').click();
  await color('implicit-title', 'rgb(255, 0, 0)');
  await page.getByTestId('implicit-toggle').click();
  await color('implicit-title', 'rgb(0, 128, 0)');
  const implicit = await page.getByTestId('implicit-title').getAttribute('class');
  assert.ok(implicit && !implicit.includes('[object Object]'));
  await page.getByTestId('reset-demo').click();
  await color('implicit-title', 'rgb(255, 0, 0)');
  return { ...data, external, implicit, guidedScenes: 6, nativeStates: true, reset: true, progressiveDisclosure: true };
}
async function explorerChecks() {
  await page.getByTestId('nav-fixtures').click();
  await page.locator('[data-testid="fixture-status"][data-state="passed"]').waitFor();
  await page.getByLabel('搜索浏览器案例').fill('空属性');
  await page.getByTestId('fixture-select').selectOption('native-empty-attribute-module-isolation');
  await page.locator('[data-testid="fixture-status"][data-state="passed"]').waitFor();
  await page.getByTestId('phase-select').selectOption('1');
  await page.locator('[data-testid="fixture-status"][data-state="passed"]').waitFor();
  assert.equal(await page.getByTestId('phase-select').inputValue(), '1');
  await page.getByLabel('搜索浏览器案例').fill('no-matching-fixture');
  assert.equal(await page.getByTestId('fixture-select').inputValue(), 'native-empty-attribute-module-isolation');
  assert.equal(await page.getByTestId('fixture-select').locator('option').count(), 1);
  await page.getByLabel('搜索浏览器案例').fill('');
  await page.getByTestId('run-all').click();
  await page.locator('[data-testid="sweep-status"]:is([data-state="passed"], [data-state="failed"])').waitFor({ timeout: 120_000 });
  const sweep = await page.getByTestId('sweep-status').textContent();
  assert.equal(await page.getByTestId('sweep-status').getAttribute('data-state'), 'passed', sweep);
  assert.match(sweep, /125 个案例 \/ 1267 项对比/);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  assert.ok(await page.evaluate(() => window.scrollY > 0), 'Exercise navigation from a scrolled fixture page');
  await page.getByTestId('nav-compiler').click();
  await page.getByTestId('compiler-status').waitFor();
  assert.equal(await page.evaluate(() => window.scrollY), 0, 'Section changes start at their heading');
  await page.getByLabel('搜索编译案例').fill('重复属性');
  await page.getByTestId('compiler-select').selectOption('duplicate-property');
  for (const [key, expected] of Object.entries({ expected: 'rejected', committed: 'false', rollback: 'true', state: 'passed' })) {
    assert.equal(await page.getByTestId('compiler-status').getAttribute(`data-${key}`), expected);
  }
  await page.getByLabel('搜索编译案例').fill('');
  await page.getByTestId('compiler-select').selectOption('conditional-keyframes');
  for (const [key, expected] of Object.entries({ level: 'compiler-only', expected: 'atomic', committed: 'true' })) {
    assert.equal(await page.getByTestId('compiler-status').getAttribute(`data-${key}`), expected);
  }
  await page.getByTestId('nav-adapter').click();
  await page.getByTestId('adapter-status').waitFor();
  await page.getByTestId('adapter-select').selectOption('mutable-alias');
  assert.match(await page.getByTestId('adapter-diagnostics').textContent(), /GSS2103/);
  await page.getByTestId('adapter-select').selectOption('cross-module-warning');
  assert.match(await page.getByTestId('adapter-diagnostics').textContent(), /warning · GSS2107/);
  assert.match(await page.getByTestId('adapter-mixing-note').textContent(), /动态字符串/);
  assert.equal(await page.getByTestId('adapter-status').getAttribute('data-state'), 'passed');
  await page.getByTestId('adapter-select').selectOption('alias-member');
  assert.equal(await page.getByTestId('adapter-status').getAttribute('data-state'), 'passed');
  await page.getByTestId('nav-live').click();
  return { sweep, phaseSelection: true, negativeRollback: true, compilerOnlyLabel: true, adapterDiagnosticsAndBoundary: true, chineseSearch: true, filterRetention: true, navigationScrollReset: true };
}
async function supportingTextContrast() {
  const failures = await page.evaluate(() => {
    function rgba(value) { const [r, g, b, a = 1] = value.match(/[\d.]+/g).map(Number); return { rgb: [r, g, b], a }; }
    function luminance(rgb) { return rgb.map((n) => n / 255).map((n) => n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4).reduce((sum, n, i) => sum + n * [.2126, .7152, .0722][i], 0); }
    function over(fg, bg) { return fg.rgb.map((n, i) => n * fg.a + bg[i] * (1 - fg.a)); }
    const problems = [];
    const selectors = ['.brand small', '.nav-copy small', '.nav-count', '.sidebar-note', '.sidebar-note p', '.version-label', '.eyebrow', '.scene-number', '.panel-kicker', '.text-button', '.sample-kicker', '.sample-avatar', '.sample-description', '.sample-state', '.expectation-panel > p', '.concept-details summary', '.scope-label', '.summary-meta', '.filter-hint', '.panel-footnote', '.scope-note', '.code-heading > span', '.frame-label span', '.result-status', '.editor-bar', '.resource-items small', '.lazy-placeholder', '.implicit-tile code', '.diagnostic code', '.diagnostic-panel h3', '.workspace-footer > span', '.workspace-footer summary', 'input[placeholder]'];
    for (const selector of selectors) for (const element of document.querySelectorAll(selector)) {
      if (!element.getClientRects().length) continue;
      const ancestors = [];
      for (let node = element; node; node = node.parentElement) ancestors.unshift(node);
      let background = [255, 255, 255];
      for (const node of ancestors) background = over(rgba(getComputedStyle(node).backgroundColor), background);
      const style = getComputedStyle(element, element.matches('input') ? '::placeholder' : null);
      const foreground = over(rgba(style.color), background);
      const [a, b] = [luminance(foreground), luminance(background)].sort((x, y) => y - x);
      const ratio = (a + .05) / (b + .05);
      if (ratio < 4.5) problems.push({ selector, color: style.color, ratio: Number(ratio.toFixed(2)) });
    }
    return problems;
  });
  assert.deepEqual(failures, [], 'Supporting UI text needs 4.5:1 contrast (native fixture/sample colors are intentionally separate)');
}
async function layoutChecks() {
  for (const tab of ['live', 'fixtures', 'compiler', 'adapter']) {
    await page.getByTestId(`nav-${tab}`).click();
    if (tab === 'fixtures') await page.locator('[data-testid="fixture-status"][data-state="passed"]').waitFor();
    await page.getByRole('heading', { level: 1 }).waitFor();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 980 });
      for (const scene of tab === 'live' ? ['states', 'interactions', 'relations', 'external', 'resources', 'implicit'] : [null]) {
        if (scene) await page.getByTestId(`scene-${scene}`).click();
        const dimensions = await page.evaluate(() => ({ actual: document.documentElement.scrollWidth, viewport: window.innerWidth }));
        assert.ok(dimensions.actual <= dimensions.viewport + 1, `${tab}/${scene}/${width}: page overflow ${JSON.stringify(dimensions)}`);
        if (width === 1440) await supportingTextContrast();
      }
    }
  }
  await page.getByTestId('nav-live').click();
  await color('live-title', 'rgb(255, 0, 0)');
  const canary = await page.addStyleTag({ content: '.nav-copy small { color: #778494 !important; } .summary-meta { color: #84919e !important; }' });
  try { await assert.rejects(supportingTextContrast, /Supporting UI text needs/); }
  finally { await canary.evaluate((node) => node.remove()); }
  await supportingTextContrast();
  await page.screenshot({ path: join(artifacts, 'redesign-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: join(artifacts, 'redesign-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 980 });
  return { widths: [320, 390, 768, 1440], allSections: true, pageOverflow: false, supportingTextContrast: true, contrastCanary: true };
}
try {
  await mkdir(artifacts, { recursive: true });
  // HMR/error probes only mutate a disposable copy, never an author's files.
  sandbox = await mkdtemp(join(artifacts, 'run-'));
  const root = join(sandbox, 'playground');
  await cp(sourceRoot, root, { recursive: true, filter: (source) => source !== join(sourceRoot, 'dist') });
  const tsconfig = JSON.parse(await readFile(join(root, 'tsconfig.json'), 'utf8'));
  await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ ...tsconfig,
    extends: fileURLToPath(new URL('../../tsconfig.base.json', import.meta.url)) }));
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
  assert.equal(await page.getByTestId('scene-states').count(), 1, 'Live examples need a clear scenario selector');
  assert.equal(await page.getByTestId('scene-panel').count(), 1, 'Only one guided scenario is shown at a time');
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
    live: await liveChecks(), explorer: await explorerChecks(), layout: await layoutChecks() };
  await page.screenshot({ path: join(artifacts, 'preview.png'), fullPage: true });
  assert.deepEqual(report.pageErrors, []);
  report.passed = true;
  console.log('Playground passed: dev HMR/LKG/recovery; JSX/TSX/state/external/asset/lazy; production census; 125 fixtures / 1267 comparisons in both dev and preview; Compiler-only negative rollback; guided scenes/reset/native states; all sections/scenes at 320/390/768/1440px.');
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
