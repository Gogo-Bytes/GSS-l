/* global URL, document, getComputedStyle, CSSStyleSheet, window, requestAnimationFrame, fetch */
// Opt-in reproduction for #33. The prepared external template supplies Vite and plugin-react.
import { setTimeout, clearTimeout } from 'node:timers';
import { Buffer } from 'node:buffer';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

assert.ok(process.argv[2], 'Pass the app directory produced by vite-template:check');
const prepared = await realpath(process.argv[2]);
const fixture = fileURLToPath(new URL('./app/src/', import.meta.url));
const root = await realpath(await mkdtemp(join(tmpdir(), 'gss-handoff-')));
const report = { root, observations: [] };
const red = 'rgb(180, 20, 30)';
const evidence = resolve('artifacts/issue-33-handoff', new Date().toISOString().replaceAll(':', '-'));
await mkdir(evidence, { recursive: true });
const require = createRequire(join(prepared, 'package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')));
for (const file of ['index.html', 'src', 'package.json']) await cp(join(prepared, file), join(root, file), { recursive: true });
await cp(fixture, join(root, 'src'), { recursive: true });
await symlink(join(prepared, 'node_modules'), join(root, 'node_modules'), 'dir');
// Both views stay under the same React root. The preview can repaint a previously received prop.
await writeFile(join(root, 'src/Child.tsx'), `import {useState} from 'react'
import styles from './App.gss'
export default function Child({className}: {className: string}) {
  const [previewClass, accept] = useState(className)
  const [visible, show] = useState(true)
  return <><span data-testid="second" className={styles.title}>Second importer</span><h1 data-testid="title" className={className}>External GSS consumer</h1>
    <button onClick={() => show(!visible)}>Toggle preview</button>
    <button onClick={() => accept(className)}>Accept preview update</button>
    {visible && <h2 data-testid="preview" className={previewClass}>Preview</h2>}</>
}`);
await writeFile(join(root, 'vite.config.mjs'), `import react from '@vitejs/plugin-react'
import {gss} from '@gss-l/vite'
import {react as adapter} from '@gss-l/react'
export default {plugins: [gss({adapter: adapter()}), react()]}`);
const server = await createServer({ root, configLoader: 'runner', cacheDir: join(root, '.vite'),
  server: { host: '127.0.0.1', port: 0 } });
let browser, page;
try {
  await server.listen();
  browser = await chromium.launch();
  page = await browser.newPage();
  let onRename;
  report.errors = [];
  report.updates = [];
  page.on('pageerror', error => report.errors.push(String(error)));
  page.on('websocket', ws => ws.on('framereceived', ({payload}) => {
    const msg = JSON.parse(payload);
    if (msg.event === 'gss:atom-handoff' && msg.data.rename) onRename?.(msg.data.rename.to, msg.data.timestamp);
    if (msg.type === 'update' || msg.event === 'gss:atom-handoff') report.updates.push(msg);
  }));
  await page.goto(server.resolvedUrls.local[0]);
  const title = page.getByTestId('title');
  const preview = page.getByTestId('preview');
  const color = (node) => node.evaluate((el) => getComputedStyle(el).color);
  await page.waitForFunction((red) => {
    const node = document.querySelector('[data-testid="title"]');
    return node && getComputedStyle(node).color === red;
  }, red);
  const oldClass = await title.getAttribute('class');
  const sheet = join(root, 'src/App.gss');
  const original = await readFile(sheet, 'utf8');
  const extended = original + '\n.extra { color: rgb(12, 34, 56); }\n';
  await page.evaluate(async red => {
    const {createHotContext} = await import('/@vite/client');
    window.applied = [];
    createHotContext('/handoff-test-observer').on('vite:afterUpdate', ({updates}) => {
      for (const u of updates) if (u.path === '/@gss-l/central.css') window.applied.push(u.timestamp);
    });
    window.checkPreview = true;
    window.paintSamples = { count: 0, wrong: [] };
    function sample() {
      for (const id of (window.checkPreview ? ['title', 'second', 'preview'] : ['title', 'second'])) {
        const el = document.querySelector('[data-testid="' + id + '"]');
        const color = el && getComputedStyle(el).color;
        if (color !== red) window.paintSamples.wrong.push([id, color]);
      }
      window.paintSamples.count++;
      requestAnimationFrame(sample);
    }
    sample();
  }, red);
  // Count literal title-color pixels in compositor frames independently of getComputedStyle.
  // A tiny animated square outside the title forces paint even when the fix is invisible.
  const box = await title.boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const captures = [];
  cdp.on('Page.screencastFrame', event => {
    void cdp.send('Page.screencastFrameAck', { sessionId: event.sessionId });
    captures.push(Buffer.from(event.data, 'base64'));
  });
  await page.evaluate(() => {
    const marker = document.body.appendChild(document.createElement('i'));
    marker.style.cssText = 'position:fixed;bottom:0;left:0;background:red;width:2px;height:2px';
    marker.animate([{transform:'translateX(0)'}, {transform:'translateX(60px)'}], {duration:300,iterations:Infinity});
  });
  await cdp.send('Page.startScreencast', {format:'png', everyNthFrame:1});
  await writeFile(sheet, extended);
  await page.waitForFunction((old) => {
    const el = document.querySelector('[data-testid="title"]');
    return el && el.className !== old && getComputedStyle(el).color === 'rgb(180, 20, 30)';
  }, oldClass);
  const nextClass = await title.getAttribute('class');
  await page.waitForFunction(name => document.querySelector('[data-testid="second"]').className === name, nextClass);
  async function waitSheet(name, alias) {
    await page.waitForFunction(([name, alias]) => {
      const links = document.querySelectorAll('link[data-gss-dev]');
      return links.length === 1 && [...links[0].sheet.cssRules].some(rule =>
        rule.selectorText === '.' + name + (alias ? ', .' + alias : ''));
    }, [name, alias]);
  }
  await waitSheet(nextClass, oldClass);
  await cdp.send('Page.stopScreencast');
  report.titleRedPixels = [];
  for (const [i, frame] of captures.entries()) {
    const png = PNG.sync.read(frame);
    let redPixels = 0;
    for (let y = Math.ceil(box.y); y < box.y + box.height; y++)
      for (let x = Math.ceil(box.x); x < box.x + box.width; x++) {
        const k = 4 * (y * png.width + x);
        if (png.data[k] === 180 && png.data[k + 1] === 20 && png.data[k + 2] === 30) redPixels++;
      }
    await writeFile(join(evidence, 'title-' + i + '.png'), frame);
    report.titleRedPixels.push(redPixels);
  }
  assert.ok(captures.length >= 2 && report.titleRedPixels.every(n => n > 0), 'No captured title may lose its color');
  await writeFile(sheet, extended + '\n.invalid {color:red;color:blue}');
  await page.locator('vite-error-overlay').waitFor({state:'attached'});
  assert.equal(await color(preview), red);
  await writeFile(sheet, extended);
  await page.locator('vite-error-overlay').waitFor({state:'detached'});
  await waitSheet(nextClass, oldClass);
  // Reverse and immediately reapply after the reverse reached React.
  await writeFile(sheet, original);
  await page.waitForFunction(old => document.querySelector('[data-testid="title"]').className === old, oldClass);
  await writeFile(sheet, extended);
  await page.waitForFunction(name => document.querySelector('[data-testid="title"]').className === name, nextClass);
  await waitSheet(nextClass, oldClass);
  // Delay one real CSS request until the next revision is published. Do not
  // synthesize a stylesheet, Vite event, or React commit.
  const published = name => new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error('Missing rename to ' + name)), 10000);
    onRename = (next, timestamp) => { if (next === name) { clearTimeout(timeout); resolve(timestamp); } };
  });
  const delayed = page.waitForRequest(req => req.url().includes('/@gss-l/central.css?t='));
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route('**/@gss-l/central.css?t=*', async route => { await gate; await route.continue(); }, {times:1});
  await writeFile(sheet, original);
  await delayed;
  const reapplied = published(nextClass);
  await writeFile(sheet, extended);
  let timestamp;
  try { timestamp = await reapplied; } finally { release(); }
  onRename = undefined;
  await page.waitForFunction(t => window.applied.includes(t), timestamp);
  await waitSheet(nextClass, oldClass);
  assert.equal(await preview.getAttribute('class'), oldClass);
  assert.equal(await color(preview), red);
  await preview.evaluate((el, color) => { el.style.color = color; }, red);
  const referencePixels = PNG.sync.read(await preview.screenshot({ path: join(evidence, 'reference.png') }));
  await preview.evaluate(el => el.style.removeProperty('color'));
  report.observations.push('new title and old preview are both red');

  await page.evaluate(() => { window.checkPreview = false; });
  await page.getByText('Toggle preview', { exact: true }).click();
  await preview.waitFor({ state: 'detached' });
  await waitSheet(nextClass);
  await page.evaluate(async () => {
    const link = document.querySelector('link[data-gss-dev]');
    const reference = new CSSStyleSheet();
    reference.replaceSync(await (await fetch(link.href, {headers:{Accept:'text/css'}})).text());
    const rules = s => JSON.stringify([...s.cssRules].map(r => r.cssText));
    if (rules(link.sheet) !== rules(reference)) throw Error('Retirement must restore the clean rule list');
  });
  await page.getByText('Toggle preview', { exact: true }).click();
  assert.equal(await preview.getAttribute('class'), oldClass);
  const afterRetirement = await color(preview);
  assert.equal(afterRetirement, 'rgb(8, 6, 13)');
  report.observations.push({ afterRetirement });
  const failedPixels = PNG.sync.read(await preview.screenshot({ path: join(evidence, 'after-retirement.png') }));
  assert.equal(failedPixels.data.equals(referencePixels.data), false);
  await page.getByText('Accept preview update', { exact: true }).click();
  assert.equal(await preview.getAttribute('class'), nextClass);
  assert.equal(await color(preview), red);
  const restoredPixels = PNG.sync.read(await preview.screenshot({ path: join(evidence, 'restored.png') }));
  assert.equal(restoredPixels.width, referencePixels.width);
  assert.equal(restoredPixels.height, referencePixels.height);
  assert.ok(restoredPixels.data.equals(referencePixels.data), 'Accepting the current class must restore every preview pixel');
  report.paint = await page.evaluate(() => window.paintSamples);
  assert.ok(report.paint.count > 1);
  assert.deepEqual(report.paint.wrong, []);
  report.observations.push('reappearing stale state is unstyled; accepting the current class restores every reference pixel');
  assert.deepEqual(report.errors, []);
  report.passed = true;
} catch (error) {
  report.error = String(error);
  report.failure = await page?.evaluate(() => ({
    links: [...document.querySelectorAll('link[data-gss-dev]')].map(link => link.href), colors: window.paintSamples, rules: [...(document.querySelector('link[data-gss-dev]')?.sheet?.cssRules ?? [])].map(r => r.cssText)
  }));
  throw error;
} finally {
  await browser?.close();
  await server.close();
  await writeFile(join(evidence, 'retirement.json'), JSON.stringify(report, null, 2));
  process.stdout.write(evidence + '\n');
}
