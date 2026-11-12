/* global document, getComputedStyle, CSS, CSSStyleSheet, URL */
// Opt-in reproduction for #33. The prepared external template supplies Vite and plugin-react.
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, realpath, symlink, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import postcss from 'postcss';
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
export default function Child({className}: {className: string}) {
  const [previewClass, accept] = useState(className)
  const [visible, show] = useState(true)
  return <><h1 data-testid="title" className={className}>External GSS consumer</h1>
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
  await page.goto(server.resolvedUrls.local[0]);
  const title = page.getByTestId('title');
  const preview = page.getByTestId('preview');
  const color = (node) => node.evaluate((el) => getComputedStyle(el).color);
  await page.waitForFunction((red) => {
    const node = document.querySelector('[data-testid="title"]');
    return node && getComputedStyle(node).color === red;
  }, red);
  const oldClass = await title.getAttribute('class');
  let nextClass, clean;
  // Give the retirement policy an actual native CSS update with a known-equivalent selector pair.
  // This fixture contains exactly one unlayered, unqualified rule for the title's literal color.
  await page.route(/\/@gss-l\/central\.css(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const css = await response.text();
    const ast = postcss.parse(css);
    const matches = ast.nodes.filter(rule => rule.type === 'rule' && /^\.[\w-]+$/.test(rule.selector) &&
      rule.nodes.length === 1 && rule.first.prop === 'color' && rule.first.value === red && !rule.first.important);
    assert.equal(matches.length, 1);
    const rule = matches[0];
    if (rule.selector === '.' + oldClass) return route.fulfill({ response });
    nextClass = rule.selector.slice(1);
    clean = css;
    rule.selector += ', .' + oldClass;
    await route.fulfill({ response, body: ast.toString() });
  });
  const sheet = join(root, 'src/App.gss');
  await writeFile(sheet, await readFile(sheet, 'utf8') + '\n.extra { color: rgb(12, 34, 56); }\n');
  await page.waitForFunction((old) => {
    const el = document.querySelector('[data-testid="title"]');
    return el && el.className !== old && getComputedStyle(el).color === 'rgb(180, 20, 30)';
  }, oldClass);
  assert.equal(await title.getAttribute('class'), nextClass);
  assert.equal(await preview.getAttribute('class'), oldClass);
  assert.equal(await color(preview), red);
  await preview.evaluate((el, color) => { el.style.color = color; }, red);
  const referencePixels = PNG.sync.read(await preview.screenshot({ path: join(evidence, 'reference.png') }));
  await preview.evaluate(el => el.style.removeProperty('color'));
  report.observations.push('new title and old preview are both red');

  await page.getByText('Toggle preview', { exact: true }).click();
  await preview.waitFor({ state: 'detached' });
  await page.evaluate(({ oldClass, nextClass, clean }) => {
    if (document.getElementsByClassName(oldClass).length) throw Error('Old class is still mounted');
    const sheet = document.querySelector('link[data-gss-dev]').sheet;
    const rule = [...sheet.cssRules].find(r => r.selectorText === '.' + nextClass + ', .' + oldClass);
    if (!rule) throw Error('Missing transition rule');
    rule.selectorText = '.' + CSS.escape(nextClass);
    const reference = new CSSStyleSheet();
    reference.replaceSync(clean);
    const rules = s => JSON.stringify([...s.cssRules].map(r => r.cssText));
    if (rules(sheet) !== rules(reference)) throw Error('Retirement must restore the clean rule list');
  }, { oldClass, nextClass, clean });
  await page.getByText('Toggle preview', { exact: true }).click();
  assert.equal(await preview.getAttribute('class'), oldClass);
  const afterRetirement = await color(preview);
  assert.equal(afterRetirement, 'rgb(8, 6, 13)');
  report.observations.push({ afterRetirement });
  const failedPixels = PNG.sync.read(await preview.screenshot({ path: join(evidence, 'after-retirement.png') }));
  assert.equal(failedPixels.data.equals(referencePixels.data), false);
  await page.evaluate(({ oldClass, nextClass }) => {
    const sheet = document.querySelector('link[data-gss-dev]').sheet;
    const rule = [...sheet.cssRules].find(r => r.selectorText === '.' + nextClass);
    rule.selectorText += ', .' + CSS.escape(oldClass);
  }, { oldClass, nextClass });
  assert.equal(await color(preview), red);
  const restoredPixels = PNG.sync.read(await preview.screenshot({ path: join(evidence, 'restored.png') }));
  assert.equal(restoredPixels.width, referencePixels.width);
  assert.equal(restoredPixels.height, referencePixels.height);
  assert.ok(restoredPixels.data.equals(referencePixels.data), 'Restoring the selector must restore every preview pixel');
  await page.getByText('Accept preview update', { exact: true }).click();
  assert.equal(await preview.getAttribute('class'), nextClass);
  assert.equal(await color(preview), red);
  report.observations.push('restoring only the old selector restores red; preview can then adopt new class');
  report.reproduced = true;
} catch (error) {
  report.error = String(error);
  throw error;
} finally {
  await browser?.close();
  await server.close();
  await writeFile(join(evidence, 'retirement.json'), JSON.stringify(report, null, 2));
  process.stdout.write(evidence + '\n');
}
