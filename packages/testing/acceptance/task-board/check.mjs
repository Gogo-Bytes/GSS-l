/* global document, window, getComputedStyle, console, performance */
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { join } from 'node:path';
import { build, createServer, preview } from 'vite';
import { chromium } from 'playwright';
import { createGssCompilerSession } from '@gss-l/compiler';

const source = fileURLToPath(new URL('.', import.meta.url));
const artifacts = fileURLToPath(new URL('../../../../artifacts/acceptance/task-board/', import.meta.url));
const report = { scope: [], phases: [], negativeControls: [], pageErrors: [], expectedDevErrors: [] };
const properties = ['display', 'color', 'background-color', 'border-top-color', 'border-left-width', 'border-radius', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'gap', 'font-size', 'font-weight', 'line-height', 'letter-spacing', 'text-transform', 'opacity', 'outline-color', 'outline-width', 'outline-offset', 'box-shadow', 'grid-template-columns', 'white-space'];
let server, browser, sandbox, gssPage, nativePage;
let invalidEdit = false;
function address() {
  const value = server.httpServer.address();
  assert.ok(value && typeof value !== 'string');
  return `http://127.0.0.1:${value.port}/`;
}
const probe = (page, name) => page.locator(`[data-probe="${name}"]`);
async function snapshot(page) {
  return page.evaluate((properties) => Object.fromEntries([...document.querySelectorAll('[data-probe]')].map((node) => {
    const style = getComputedStyle(node), rect = node.getBoundingClientRect();
    return [node.getAttribute('data-probe'), {
      styles: Object.fromEntries(properties.map((property) => [property, style.getPropertyValue(property)])),
      geometry: [rect.x + window.scrollX, rect.y + window.scrollY, rect.width, rect.height].map((value) => Math.round(value * 100) / 100),
      text: node.children.length ? null : node.textContent,
      value: 'value' in node ? node.value : null,
      disabled: 'disabled' in node ? node.disabled : null,
      placeholder: node.matches('input') ? getComputedStyle(node, '::placeholder').color : null
    }];
  })), properties);
}
async function parity(name, record = true) {
  // Normalize pointer position, but leave keyboard focus intact to compare its styles.
  for (const page of [gssPage, nativePage]) await page.mouse.move(0, 0);
  const actual = await snapshot(gssPage), expected = await snapshot(nativePage);
  assert.deepEqual(actual, expected, `Native oracle mismatch: ${name}`);
  for (const page of [gssPage, nativePage]) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    assert.ok(overflow <= 1, `${name}: horizontal overflow ${overflow}`);
  }
  if (record) report.phases.push({ name, probes: Object.keys(actual).length, properties: properties.length, geometry: true, behavior: true });
}
async function both(action) { for (const page of [gssPage, nativePage]) await action(page); }
async function color(page, name, value) {
  await page.waitForFunction(([name, value]) => {
    const node = document.querySelector(`[data-probe="${name}"]`);
    return node && getComputedStyle(node).color === value;
  }, [name, value]);
}
async function sequence(mode, width) {
  await both(async (page) => {
    await page.setViewportSize({ width, height: 980 });
    await page.goto(address() + (page === nativePage ? '?reference=native' : ''));
    await probe(page, 'card-FW-101').waitFor();
    assert.match(await page.getByTestId('compilation-summary').innerText(), /compile atomically without fallback/);
    assert.doesNotMatch(await page.locator('footer').innerText(), /uses supported whole-module preservation/);
    assert.equal(await page.locator('[data-probe^="card-"]').count(), 4);
    assert.equal(await probe(page, 'clear').isDisabled(), true);
    assert.equal(await probe(page, 'detail').count(), 0);
    assert.equal(await page.getByRole('combobox', { name: 'Move task FW-101', exact: true }).count(), 1);
  });
  await parity(`${mode}/${width}/initial`);
  await both(async (page) => { await probe(page, 'search').focus(); await page.keyboard.press('Tab'); });
  await both(async (page) => {
    assert.equal(await probe(page, 'filter').evaluate((node) => document.activeElement === node && getComputedStyle(node).outlineWidth === '3px'), true);
  });
  await parity(`${mode}/${width}/keyboard-focus`);
  await both(async (page) => { await probe(page, 'search').fill('Maya'); assert.equal(await page.locator('[data-probe^="card-"]').count(), 1); });
  await parity(`${mode}/${width}/search-owner`);
  await both(async (page) => { await probe(page, 'filter').selectOption('done'); await probe(page, 'empty').waitFor(); });
  await parity(`${mode}/${width}/combined-empty`);
  await both(async (page) => { await probe(page, 'clear').click(); await probe(page, 'filter').selectOption('planned'); assert.equal(await page.locator('[data-probe^="card-"]').count(), 2); });
  await parity(`${mode}/${width}/planned`);
  await both(async (page) => { await probe(page, 'status-FW-102').selectOption('active'); assert.equal(await probe(page, 'card-FW-102').count(), 0); });
  await parity(`${mode}/${width}/status-removes-filtered-card`);
  await both(async (page) => { await probe(page, 'clear').click(); await probe(page, 'open-FW-102').click(); await probe(page, 'detail').waitFor(); assert.match(await probe(page, 'detail-meta').innerText(), /In progress/); });
  await both(async (page) => assert.equal(await probe(page, 'detail').evaluate((node) => document.activeElement === node), true));
  await parity(`${mode}/${width}/lazy-detail`);
  if (mode === 'production') await gssPage.screenshot({ path: join(artifacts, `detail-${width}.png`), fullPage: true });
  await both(async (page) => { await probe(page, 'edit-FW-102').click(); await probe(page, 'edit-title').fill('   '); assert.equal(await probe(page, 'save').isDisabled(), true); });
  await parity(`${mode}/${width}/invalid-draft`);
  await both(async (page) => { await probe(page, 'cancel').click(); assert.equal(await probe(page, 'title-FW-102').innerText(), 'Review the empty states'); assert.equal(await probe(page, 'edit-FW-102').evaluate((node) => document.activeElement === node), true); await probe(page, 'edit-FW-102').click();
    await probe(page, 'edit-title').fill('Make the first release welcoming and useful for every new teammate');
    await probe(page, 'edit-owner').fill('Sam Taylor'); await probe(page, 'edit-notes').fill('Review with support.\nInclude a clear next step in every empty state.'); });
  await parity(`${mode}/${width}/edited-draft`);
  if (mode === 'production') await gssPage.screenshot({ path: join(artifacts, `editor-${width}.png`), fullPage: true });
  await both(async (page) => { await probe(page, 'save').click(); assert.equal(await probe(page, 'editor').count(), 0); assert.equal(await probe(page, 'edit-FW-102').evaluate((node) => document.activeElement === node), true); assert.match(await probe(page, 'owner-FW-102').innerText(), /Sam Taylor/); assert.match(await probe(page, 'detail-title').innerText(), /Make the first release/); });
  await parity(`${mode}/${width}/saved-detail-sync`);
  await both(async (page) => { await probe(page, 'status-FW-102').selectOption('done'); assert.equal(await probe(page, 'summary').innerText(), '2 of 4 complete'); assert.match(await probe(page, 'detail-meta').innerText(), /Done/); });
  await parity(`${mode}/${width}/completed`);
  await both(async (page) => { await probe(page, 'detail-close').click(); assert.equal(await probe(page, 'detail').count(), 0); assert.equal(await probe(page, 'open-FW-102').evaluate((node) => document.activeElement === node), true); });
  await parity(`${mode}/${width}/closed`);
  await both(async (page) => { await probe(page, 'edit-FW-101').hover(); });
  assert.deepEqual(await snapshot(gssPage), await snapshot(nativePage), 'Hover styles');
  assert.equal(await probe(gssPage, 'edit-FW-101').evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(232, 240, 235)');
  report.phases.push({ name: `${mode}/${width}/hover`, behavior: true });
  await both(async (page) => { await probe(page, 'search').fill('no-such-task'); await probe(page, 'clear').click(); await page.mouse.move(0, 0); });
  await gssPage.screenshot({ path: join(artifacts, `${mode}-${width}.png`), fullPage: true });
  await both(async (page) => {
    await probe(page, 'search').fill('Sam Taylor');
    await probe(page, 'edit-FW-102').click();
    await probe(page, 'edit-owner').fill('Alex Chen');
    await probe(page, 'save').click();
    assert.equal(await probe(page, 'card-FW-102').count(), 0);
    assert.equal(await probe(page, 'search').evaluate((node) => document.activeElement === node), true);
  });
  await parity(`${mode}/${width}/editor-focus-filtered-fallback`);
  await both(async (page) => { await probe(page, 'clear').click(); await page.mouse.move(0, 0); });
}
async function closeServer() {
  if (!server) return;
  if ('close' in server) await server.close();
  else await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
  server = undefined;
}
try {
  await mkdir(artifacts, { recursive: true });
  sandbox = await mkdtemp(join(artifacts, 'sandbox-'));
  const root = join(sandbox, 'task-board');
  await cp(source, root, { recursive: true, filter: (path) => path !== join(source, 'dist') });
  await symlink(fileURLToPath(new URL('../../node_modules/', import.meta.url)), join(sandbox, 'node_modules'), 'dir');
  const tsconfig = JSON.parse(await readFile(join(root, 'tsconfig.json'), 'utf8'));
  await writeFile(join(root, 'tsconfig.json'), JSON.stringify({ ...tsconfig, extends: fileURLToPath(new URL('../../../../tsconfig.base.json', import.meta.url)) }));
  const configFile = join(root, 'vite.config.ts');
  browser = await chromium.launch({ headless: true });
  server = await createServer({ configFile, logLevel: 'silent', server: { port: 0, strictPort: false } });
  await server.listen();
  // Scope is serialized from the same factual UI list, not inferred from a passing test.
  report.scope = (await server.ssrLoadModule('/scope.ts')).scope;
  gssPage = await browser.newPage(); nativePage = await browser.newPage();
  for (const page of [gssPage, nativePage]) page.on('pageerror', (error) => (invalidEdit ? report.expectedDevErrors : report.pageErrors).push(String(error)));
  await sequence('dev', 1440);
  const path = join(root, 'Board.gss'), original = await readFile(path, 'utf8');
  // A resource-only edit changes central CSS without changing exported atomic classes.
  // Prove that boundary through the real compiler rather than assuming all GSS edits are CSS-only.
  const resource = '\n@property --task-board-hmr-probe { syntax: "<color>"; inherits: true; initial-value: #7a3c20; }\n';
  const cssOnly = original + resource;
  const changed = original.replace('.title { font-size: 32px;', '.title { color: #7a3c20; font-size: 32px;') + resource;
  const compiler = createGssCompilerSession({ projectRoot: root });
  function compileModule(source) {
    const result = compiler.replaceStylesheet({ id: path, source });
    assert.equal(result.committed, true);
    assert.deepEqual(result.diagnostics, []);
    return result.module;
  }
  const originalModule = compileModule(original), cssOnlyModule = compileModule(cssOnly), changedModule = compileModule(changed);
  assert.equal(cssOnlyModule.moduleCode, originalModule.moduleCode);
  assert.deepEqual(cssOnlyModule.scopeSchema, originalModule.scopeSchema);
  assert.notEqual(changedModule.moduleCode, originalModule.moduleCode);
  await gssPage.evaluate(() => { window.__taskBoardHmrProbe = 'css-only-document'; });
  await writeFile(path, cssOnly);
  await gssPage.waitForFunction(() => getComputedStyle(document.querySelector('[data-probe="title"]')).getPropertyValue('--task-board-hmr-probe').trim() === 'rgb(122, 60, 32)');
  assert.equal(await gssPage.evaluate(() => window.__taskBoardHmrProbe), 'css-only-document');
  await nativePage.addStyleTag({ content: resource });
  await parity('dev/css-only-resource-hmr');
  assert.equal(await probe(gssPage, 'title').evaluate((node) => getComputedStyle(node).getPropertyValue('--task-board-hmr-probe')),
    await probe(nativePage, 'title').evaluate((node) => getComputedStyle(node).getPropertyValue('--task-board-hmr-probe')));
  // Atomic class-map changes propagate through native Vite dependency reload, unlike preserved selectors.
  assert.match(await probe(gssPage, 'title-FW-102').innerText(), /Make the first release/);
  await writeFile(path, changed); await color(gssPage, 'title', 'rgb(122, 60, 32)');
  assert.equal(await gssPage.evaluate(() => window.__taskBoardHmrProbe), undefined);
  assert.equal(await probe(gssPage, 'title-FW-102').innerText(), 'Review the empty states');
  await nativePage.reload(); await probe(nativePage, 'title').waitFor();
  await nativePage.addStyleTag({ content: resource + '\n[data-probe="title"] { color: #7a3c20; }' });
  await parity('dev/class-map-edit-reload');
  await gssPage.evaluate(() => { window.__taskBoardHmrProbe = 'last-known-good-document'; });
  invalidEdit = true;
  await writeFile(path, changed + '\n.invalid { color: red; color: blue; }\n');
  await gssPage.locator('vite-error-overlay').waitFor({ state: 'attached' });
  await color(gssPage, 'title', 'rgb(122, 60, 32)');
  assert.equal(await gssPage.evaluate(() => window.__taskBoardHmrProbe), 'last-known-good-document');
  await writeFile(path, original);
  await gssPage.locator('vite-error-overlay').waitFor({ state: 'detached' });
  await color(gssPage, 'title', 'rgb(32, 52, 46)'); invalidEdit = false;
  assert.equal(await gssPage.evaluate(() => window.__taskBoardHmrProbe), undefined);
  await nativePage.reload(); await probe(nativePage, 'title').waitFor();
  await parity('dev/class-map-recovery-reload');
  assert.equal(await readFile(join(source, 'Board.gss'), 'utf8'), original, 'Author source must remain untouched by HMR probes');
  report.development = { disposableCopy: true, authorSourceUnchanged: true,
    cssOnlyHmr: { exportedMappingUnchanged: true, computedResourceUpdated: true, sameDocument: true },
    classMapEdit: { exportedMappingChanged: true, visualUpdate: true, documentReplaced: true, reactStateReset: true, nativeParity: true },
    invalidEditOverlay: true, lastKnownGood: true, invalidEditSameDocument: true,
    recovery: true, recoveryDocumentReplaced: true, recoveryNativeParity: true };
  await sequence('dev', 390);
  await closeServer();
  await build({ configFile, logLevel: 'silent' });
  const manifest = JSON.parse(await readFile(join(root, 'dist/gss-manifest.json'), 'utf8'));
  assert.equal(manifest.version, 2);
  assert.deepEqual(manifest.compiler.modules, ['Board.gss', 'Detail.gss']);
  const css = await readFile(join(root, 'dist', manifest.cssAsset), 'utf8');
  const detailRules = manifest.compiler.rules.filter((rule) => rule.sources.includes('Detail.gss'));
  assert.ok(detailRules.length > 0);
  assert.equal(manifest.compiler.moduleDetails.length, 2);
  assert.ok(manifest.compiler.moduleDetails.every((module) => module.compilationMode === 'atomic'));
  const fallbackReasons = manifest.compiler.moduleDetails.flatMap((module) => module.fallbackReasons);
  assert.deepEqual(fallbackReasons, []);
  assert.deepEqual(manifest.compiler.preservedRules, []);
  assert.ok(manifest.compiler.rules.length > 0);
  for (const property of ['box-shadow', 'letter-spacing', 'text-transform', 'outline-offset']) {
    assert.ok(manifest.compiler.rules.some((rule) => rule.property === property), `Missing atomic effect: ${property}`);
  }
  report.compilation = { moduleDetails: manifest.compiler.moduleDetails, atomicBusinessModules: true,
    atomicModules: manifest.compiler.moduleDetails.length, fallbackReasons,
    atomicRules: manifest.compiler.rules.length, preservedRules: manifest.compiler.preservedRules.length, centralCssCharacters: css.length,
    limitation: 'Atomization is measured only for these two unchanged business modules. No savings, arbitrary CSS or universal MVP acceptance claim.' };
  assert.ok(css.includes('#edf5ef'));
  await writeFile(join(artifacts, 'gss-manifest.json'), JSON.stringify(manifest, null, 2));
  await cp(join(root, 'dist/gss-report.json'), join(artifacts, 'gss-report.json'));
  await cp(join(root, 'dist/.vite/manifest.json'), join(artifacts, 'vite-manifest.json'));
  const viteManifest = JSON.parse(await readFile(join(root, 'dist/.vite/manifest.json'), 'utf8'));
  const lazy = Object.values(viteManifest).find((entry) => entry.isDynamicEntry && entry.src === 'Detail.tsx');
  assert.ok(lazy, 'Detail must remain a dynamic JS entry');
  server = await preview({ configFile, logLevel: 'silent', preview: { port: 0, strictPort: false } });
  await gssPage.goto(address()); await probe(gssPage, 'title').waitFor();
  assert.equal(await gssPage.evaluate((file) => performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(file)), lazy.file), false);
  const centralLinks = () => gssPage.locator('link[rel="stylesheet"]').evaluateAll((links) => links.filter((node) => /\/assets\/gss-[^/]+\.css/.test(node.href)).map((node) => node.href));
  const before = await centralLinks(); assert.equal(before.length, 1);
  await probe(gssPage, 'open-FW-101').click(); await probe(gssPage, 'detail').waitFor();
  assert.equal(await gssPage.evaluate((file) => performance.getEntriesByType('resource').some((entry) => entry.name.endsWith(file)), lazy.file), true);
  assert.deepEqual(await centralLinks(), before);
  assert.equal(await probe(gssPage, 'detail').evaluate((node) => getComputedStyle(node).backgroundColor), 'rgb(237, 245, 239)');
  report.production = { manifestVersion: manifest.version, modules: manifest.compiler.modules, detailRules: detailRules.length, lazyJavaScriptRequestedOnOpen: true, centralCssLinksBeforeAndAfter: 1, lazyCssInInitialCensus: true };
  for (const width of [1440, 390, 320]) await sequence('production', width);
  for (const [name, declaration] of [['card-color', 'background-color: rgb(255, 0, 255) !important'], ['card-geometry', 'padding: 37px !important']]) {
    const canary = await gssPage.addStyleTag({ content: `[data-probe="card-FW-101"] { ${declaration}; }` });
    try { await assert.rejects(() => parity(`canary-${name}`, false), /Native oracle mismatch/); report.negativeControls.push({ name, detected: true }); }
    finally { await canary.evaluate((node) => node.remove()); }
    await parity(`recovered-${name}`);
  }
  assert.deepEqual(report.pageErrors, []);
  report.passed = true;
  console.log(`Task board passed: ${report.phases.length} recorded phases; dev HMR/LKG/recovery; production lazy JS + central CSS census; desktop/mobile independent CSS parity; 2 corrupted-style controls.`);
} catch (error) {
  report.passed = false; report.error = String(error);
  await gssPage?.screenshot({ path: join(artifacts, 'failure.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  await writeFile(join(artifacts, 'result.json'), JSON.stringify(report, null, 2));
  try { await browser?.close(); } finally { try { await closeServer(); } finally { if (sandbox) await rm(sandbox, { recursive: true, force: true }); } }
}
