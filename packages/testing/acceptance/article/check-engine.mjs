/* global document, window, getComputedStyle, console, requestAnimationFrame, NodeFilter */
import assert from 'node:assert/strict';
import process from 'node:process';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { arch, platform, release } from 'node:os';
import { createRequire } from 'node:module';
import { build, createServer, preview } from 'vite';
import { chromium, firefox, webkit } from 'playwright';
import { comparePng } from '../task-board/visual.mjs';

const source = fileURLToPath(new URL('.', import.meta.url));
const engine = process.argv[2];
assert.ok(['chromium', 'firefox', 'webkit'].includes(engine));
const artifacts = process.env.ARTICLE_ARTIFACTS;
assert.ok(artifacts, 'Use check.mjs to retain per-engine evidence');
const configFile = join(source, 'vite.config.ts');
const pageOptions = { deviceScaleFactor: 1, locale: 'zh-CN', timezoneId: 'UTC', colorScheme: 'light', reducedMotion: 'reduce' };
const properties = ['display', 'color', 'background-color', 'border-top-color', 'border-left-width', 'border-radius', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-bottom', 'gap', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-decoration-line', 'overflow-wrap', 'white-space', 'list-style-type', 'list-style-position', 'opacity', 'outline-color', 'outline-width', 'outline-offset'];
const pseudoProperties = ['content', 'display', 'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'list-style-type', 'list-style-position'];
const report = { engine, keyboardTraversal: engine === 'webkit' && platform() === 'darwin' ? 'Alt+Tab' : 'Tab', pageOptions, phases: [], interactions: [], screenshots: [], negativeControls: [], visualNegativeControls: [], pageErrors: [],
  environment: { platform: platform(), release: release(), arch: arch(), node: process.version, playwright: createRequire(import.meta.url)('playwright/package.json').version },
  authoringAdjustment: 'Historical original overlapping hover/pressed backgrounds were rejected by GSS1205. The unchanged approved business design here remains hover border / pressed background. The original input now has separate bounded module-local rank acceptance in acceptance/atom-ranks/article-original.gss and atom-ranks:check; this gate still verifies the approved design.',
  visualPolicy: { metric: 'Exact decoded RGBA and dimensions; shared task-board comparePng', threshold: 0, region: 'data-probe=article (business region)', widths: [1440, 390, 320], viewportHeight: 980,
    settling: 'fonts.ready; two animation frames; two identical consecutive captures, maximum five', normalization: 'Same fonts/options/content/focus; foreground each paired action from identical scroll origin, retaining and exactly comparing settled post-action focus/scroll/rects before reset. Snapshot/capture at scroll origin; pointer origin except hover scenes; caret hidden and animations disabled symmetrically. No masks/blur/tolerance.',
    limitations: 'Host system fonts; no cross-engine or cross-host baseline. Pseudo-element boxes have no standard DOM rectangle API: computed values and containing-region paint are compared; text Range and list indentation geometry checked separately.' }
};
let browser, server, gssPage, nativePage;
const probe = (page, name) => page.locator(`[data-probe="${name}"]`);
async function both(action) { for (const page of [gssPage, nativePage]) await action(page); }
function address() { const value = server.httpServer.address(); assert.ok(value && typeof value !== 'string'); return `http://127.0.0.1:${value.port}/`; }
async function snapshot(page) {
  return page.evaluate(({ properties, pseudoProperties }) => {
    const rect = (value) => [value.x + window.scrollX, value.y + window.scrollY, value.width, value.height];
    const values = (style, names) => Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));
    return Object.fromEntries([...document.querySelectorAll('[data-probe]')].map((node) => {
      const pseudos = node.dataset.pseudo === 'quote' ? ['::before', '::after'] : node.dataset.pseudo === 'marker' ? ['::marker'] : node.matches('textarea') ? ['::placeholder'] : [];
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), textRects = [];
      // Direct text nodes only: nested elements carry their own probes, avoiding repeated subtree geometry.
      for (let text = walker.nextNode(); text; text = walker.nextNode()) if (text.parentNode === node && text.textContent.trim()) {
        const range = document.createRange(); range.selectNodeContents(text);
        textRects.push(...[...range.getClientRects()].filter((r) => r.width && r.height).map(rect));
      }
      return [node.dataset.probe, { styles: values(getComputedStyle(node), properties), geometry: rect(node.getBoundingClientRect()), textRects,
        pseudos: Object.fromEntries(pseudos.map((pseudo) => [pseudo, values(getComputedStyle(node, pseudo), pseudoProperties)])),
        text: node.children.length ? null : node.textContent, value: 'value' in node ? node.value : null,
        disabled: 'disabled' in node ? node.disabled : null, focused: document.activeElement === node,
        expanded: node.getAttribute('aria-expanded'), pressed: node.getAttribute('aria-pressed') }];
    }));
  }, { properties, pseudoProperties });
}
async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}
async function interactionState(page) {
  return page.evaluate(() => ({ scrollX: window.scrollX, scrollY: window.scrollY, active: document.activeElement.getAttribute('data-probe'),
    foreground: { visibility: document.visibilityState, focused: document.hasFocus() },
    quote: document.querySelector('[data-probe="quote"]').getBoundingClientRect().toJSON(),
    draft: document.querySelector('[data-probe="draft"]')?.getBoundingClientRect().toJSON() }));
}
async function pairedInteraction(name, action) {
  const pair = [];
  await both(async (page) => {
    await page.bringToFront(); await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo(0, 0)); await settle(page);
    const before = await interactionState(page), steps = [];
    await action(page, async (name, perform) => {
      const step = { name, before: await interactionState(page), samples: [] };
      await perform(); step.immediate = await interactionState(page);
      // Firefox fill can return before its caret scroll. Observe stable browser state
      // before the next click rather than racing that scroll or resetting its result.
      for (let sample = 0; sample < 5; sample++) {
        await settle(page); step.samples.push(await interactionState(page));
        if (sample > 0 && JSON.stringify(step.samples[sample]) === JSON.stringify(step.samples[sample - 1])) break;
      }
      step.settled = step.samples.at(-1); steps.push(step);
    });
    const immediate = await interactionState(page); await settle(page);
    pair.push({ before, steps, immediate, settled: await interactionState(page) });
  });
  const path = join(artifacts, 'interactions', `${name.replaceAll('/', '-')}.json`);
  await mkdir(join(artifacts, 'interactions'), { recursive: true });
  await writeFile(path, JSON.stringify(pair, null, 2));
  assert.deepEqual(pair[0].before, pair[1].before, `Matched interaction starting state: ${name}`);
  assert.equal(pair[0].steps.length, pair[1].steps.length);
  for (const [index, step] of pair[0].steps.entries()) {
    const other = pair[1].steps[index];
    for (const value of [step, other]) assert.deepEqual(value.samples.at(-1), value.samples.at(-2), `Browser state settled: ${name}/${value.name}`);
    assert.equal(step.name, other.name);
    assert.deepEqual(step.before, other.before, `Step starting state: ${name}/${step.name}`);
    assert.deepEqual(step.settled, other.settled, `Step focus/scroll/geometry: ${name}/${step.name}`);
  }
  // Observe focus and scrolling BEFORE any snapshot-origin reset. Immediate values are
  // retained too; settled values must match exactly (no rounding or tolerance).
  assert.deepEqual(pair[0].settled, pair[1].settled, `Post-interaction focus/scroll/geometry: ${name}`);
  report.interactions.push({ name, path });
}
async function parity(name, { negative = false, hover = false } = {}) {
  const snapshots = [];
  await both(async (page) => {
    await page.bringToFront(); await page.mouse.move(0, 0);
    await page.evaluate(() => window.scrollTo(0, 0)); await settle(page);
    if (hover) await probe(page, 'size').hover();
    snapshots.push(await snapshot(page));
  });
  const path = join(artifacts, 'snapshots', name.replaceAll('/', '-'));
  await mkdir(path, { recursive: true });
  await writeFile(join(path, 'gss.json'), JSON.stringify(snapshots[0], null, 2));
  await writeFile(join(path, 'native.json'), JSON.stringify(snapshots[1], null, 2));
  assert.deepEqual(snapshots[0], snapshots[1], `Native oracle mismatch: ${name}`);
  if (!negative) report.phases.push({ name, probes: Object.keys(snapshots[0]).length, properties: properties.length, pseudoProperties: pseudoProperties.length, geometry: 'Element and direct text Range rectangles, exact numbers at matched scroll origin', snapshots: path });
}
async function articleImage(page, hover) {
  await page.bringToFront();
  await page.mouse.move(0, 0);
  await page.evaluate(async () => { await document.fonts.ready; window.scrollTo(0, 0); await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
  if (hover) await probe(page, 'size').hover();
  const options = { animations: 'disabled', caret: 'hide', scale: 'css' };
  let previous = await probe(page, 'article').screenshot(options);
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await probe(page, 'article').screenshot(options);
    if (comparePng(current, previous).passed) return current;
    previous = current;
  }
  await writeFile(join(artifacts, page === gssPage ? 'unsettled-gss.png' : 'unsettled-native.png'), previous);
  throw new Error('Article pixels did not settle');
}
async function visualParity(name, { negative = false, hover = false } = {}) {
  const directory = join(artifacts, 'images', name.replaceAll('/', '-'));
  await mkdir(directory, { recursive: true });
  const actual = await articleImage(gssPage, hover); await writeFile(join(directory, 'gss.png'), actual);
  const expected = await articleImage(nativePage, hover); await writeFile(join(directory, 'native.png'), expected);
  const { diff, ...metric } = comparePng(actual, expected);
  // Keep the raw diff for every pair, including zero-difference recovery evidence.
  await writeFile(join(directory, 'diff.png'), diff);
  const result = { name, ...metric, directory, ...(negative ? { detected: !metric.passed } : {}) };
  await writeFile(join(directory, 'metric.json'), JSON.stringify(result, null, 2));
  (negative ? report.visualNegativeControls : report.screenshots).push(result);
  assert.equal(metric.passed, !negative, `Visual oracle mismatch: ${name}; ${metric.differentPixels} pixels, max delta ${metric.maxChannelDelta}`);
}
async function focused(page, name) { assert.equal(await probe(page, name).evaluate((node) => document.activeElement === node), true, `${name} must own focus`); }
async function inheritance(page, large, warm) {
  const data = await snapshot(page), parent = data.article.styles;
  assert.equal(parent['font-size'], large ? '20px' : '16px');
  // Exact engine serialization, not a cross-engine normalization; paired snapshots stay raw.
  assert.equal(parent['line-height'], large ? '38px' : engine === 'webkit' ? '28.799999px' : '28.8px');
  assert.equal(parent['letter-spacing'], large ? '0.6px' : '0.2px');
  assert.equal(parent.color, warm ? 'rgb(103, 69, 54)' : 'rgb(41, 61, 56)');
  for (const name of ['body', 'intro', 'nested', 'emphasis', 'strong', 'long-copy', 'long-word', 'ordered', 'step-one', 'list-nested', 'unordered', 'bullet-two', 'quote-nested', 'closing', ...(data.thread ? ['copy-lin', 'copy-zhou', 'reply-copy', 'reply-emphasis'] : [])]) {
    for (const property of ['color', 'font-family', 'font-size', 'line-height', 'letter-spacing']) assert.equal(data[name].styles[property], parent[property], `${name} inherits ${property}`);
  }
  assert.equal(data.emphasis.styles['font-style'], 'italic'); assert.equal(data.strong.styles['font-weight'], '700');
  for (const name of ['note', 'note-nested']) {
    assert.equal(data[name].styles['font-size'], '14px'); assert.equal(data[name].styles.color, 'rgb(115, 84, 51)'); assert.equal(data[name].styles['line-height'], engine === 'webkit' ? '23.799999px' : '23.8px'); assert.equal(data[name].styles['letter-spacing'], 'normal');
  }
  assert.equal(data.title.styles['font-size'], '30px'); assert.equal(data.meta.styles['font-size'], '13px');
  assert.equal(data['discussion-link'].styles.color, 'rgb(38, 107, 98)'); assert.equal(data['discussion-link'].styles['font-size'], parent['font-size']);
  for (const name of ['step-one', 'step-two', 'step-three', 'bullet-one', 'bullet-two']) {
    assert.equal(data[name].styles.display, 'list-item');
    const marker = data[name].pseudos['::marker'];
    assert.equal(marker.color, 'rgb(150, 96, 63)'); assert.equal(marker['font-weight'], '700'); assert.equal(marker['font-size'], parent['font-size']);
    assert.equal(data[name].styles['list-style-type'], name.startsWith('step') ? 'decimal' : 'disc');
    assert.equal(data[name].styles['list-style-position'], 'outside');
  }
  for (const [pseudo, content] of [['::before', '「'], ['::after', '」']]) {
    const value = data.quote.pseudos[pseudo]; assert.equal(value.content, `"${content}"`); assert.equal(value.color, 'rgb(82, 124, 100)'); assert.equal(parseFloat(value['font-size']), (large ? 20 : 16) * 1.4);
  }
  const layout = await page.evaluate(() => {
    const page = document.querySelector('[data-probe="article"]'), bounds = page.getBoundingClientRect();
    const walker = document.createTreeWalker(page, NodeFilter.SHOW_TEXT), overflow = [];
    for (let text = walker.nextNode(); text; text = walker.nextNode()) {
      if (!text.textContent.trim() || text.parentElement.closest('textarea')) continue;
      const range = document.createRange(); range.selectNodeContents(text);
      for (const rect of range.getClientRects()) if (rect.width && (rect.left < bounds.left || rect.right > bounds.right || rect.left < 0 || rect.right > window.innerWidth)) overflow.push(text.textContent);
    }
    return { overflow, documentOverflow: document.documentElement.scrollWidth > window.innerWidth,
      gutters: ['ordered', 'unordered'].map((name) => parseFloat(getComputedStyle(document.querySelector(`[data-probe="${name}"]`)).paddingLeft)) };
  });
  assert.deepEqual(layout.overflow, [], 'Every text fragment stays within reading region and viewport'); assert.equal(layout.documentOverflow, false);
  assert.deepEqual(layout.gutters, [32, 28], 'Outside markers retain dedicated indentation at every size');
  if (page.viewportSize().width <= 390) assert.ok(data['long-word'].textRects.length > 1, 'Long English token actually wraps on mobile');
}
async function buttonState(page, pressed, hover) {
  await page.bringToFront();
  if (hover) await probe(page, 'size').hover(); else await page.mouse.move(0, 0);
  const state = await probe(page, 'size').evaluate((node) => ({ pressed: node.getAttribute('aria-pressed'), background: getComputedStyle(node).backgroundColor, border: getComputedStyle(node).borderTopColor }));
  assert.deepEqual(state, { pressed: String(pressed), background: pressed ? 'rgb(223, 238, 227)' : 'rgb(255, 255, 255)', border: hover ? 'rgb(82, 124, 100)' : 'rgb(166, 185, 172)' });
}
async function sequence(mode, width) {
  const prefix = `${mode}/${width}`;
  let group = 0;
  const act = (action) => pairedInteraction(`${prefix}/group-${++group}`, action);
  const image = async (scene, options) => { if (mode === 'production') await visualParity(`${prefix}/${scene}`, options); };
  await both(async (page) => {
    await page.setViewportSize({ width, height: 980 }); await page.goto(address() + (page === nativePage ? '?reference=native' : ''));
    await probe(page, 'article').waitFor(); await page.evaluate(() => document.fonts.ready);
    assert.equal(await probe(page, 'thread').count(), 0); assert.equal(await probe(page, 'editor').count(), 0);
    assert.equal(await probe(page, 'expand').getAttribute('aria-expanded'), 'false');
    await inheritance(page, false, false); await buttonState(page, false, false);
  });
  await parity(`${prefix}/initial`); await image('initial');
  await act(async (page) => {
    // macOS WebKit defaults to text-control Tab traversal; Option+Tab includes buttons/links.
    const key = report.keyboardTraversal;
    for (let step = 0; step < 3; step++) await page.keyboard.press(key);
    await focused(page, 'size');
    assert.equal(await probe(page, 'size').evaluate((node) => getComputedStyle(node).outlineWidth), '3px');
    await page.keyboard.press('Space'); await inheritance(page, true, false);
    await page.keyboard.press('Space'); await inheritance(page, false, false);
    await page.keyboard.press(key); await focused(page, 'tone');
    assert.equal(await probe(page, 'tone').evaluate((node) => getComputedStyle(node).outlineWidth), '3px');
    await page.keyboard.press('Space'); await inheritance(page, false, true);
    await page.keyboard.press('Space'); await inheritance(page, false, false);
  });
  await parity(`${prefix}/keyboard-focus`);
  await act((page) => buttonState(page, false, true)); await parity(`${prefix}/hover-unpressed`, { hover: true });
  await act(async (page) => { await probe(page, 'size').click(); await buttonState(page, true, true); await inheritance(page, true, false); });
  await parity(`${prefix}/hover-pressed`, { hover: true }); await image('hover-pressed', { hover: true });
  await act((page) => buttonState(page, true, false)); await parity(`${prefix}/pressed`);
  await act(async (page) => { await probe(page, 'tone').click(); await inheritance(page, true, true); });
  await parity(`${prefix}/large-warm`); await image('large-warm');
  await act(async (page) => { await probe(page, 'expand').click(); await probe(page, 'thread').waitFor(); await focused(page, 'comments-heading'); assert.equal(await page.locator('[data-probe^="comment-"]').count(), 2); assert.equal(await probe(page, 'expand').getAttribute('aria-expanded'), 'true'); await inheritance(page, true, true); });
  await parity(`${prefix}/expanded`); await image('expanded');
  await act(async (page) => {
    await probe(page, 'reply-lin').click(); await focused(page, 'draft');
    assert.equal(await probe(page, 'send').isDisabled(), true); await probe(page, 'draft').fill('   \n  '); assert.equal(await probe(page, 'send').isDisabled(), true);
    // Exercise the submit guard itself, not only the disabled button.
    await probe(page, 'editor').evaluate((node) => node.requestSubmit());
    assert.equal(await probe(page, 'editor').count(), 1); assert.equal(await probe(page, 'submitted-lin-0').count(), 0);
    await focused(page, 'draft');
  });
  await parity(`${prefix}/empty-guard`); await image('empty-guard');
  await act(async (page, step) => {
    await step('fill-discarded', () => probe(page, 'draft').fill('不应发布的草稿'));
    await step('cancel', async () => {
      await probe(page, 'cancel').click(); await focused(page, 'reply-lin'); assert.equal(await probe(page, 'editor').count(), 0); assert.equal(await probe(page, 'submitted-lin-0').count(), 0); assert.equal(await probe(page, 'notice').innerText(), '已取消，未发布回复。');
    });
    await step('reopen', async () => {
      await probe(page, 'reply-lin').click(); await focused(page, 'draft'); assert.equal(await probe(page, 'draft').inputValue(), '');
    });
    await step('fill-reply', async () => {
      await probe(page, 'draft').fill('  今天注意到了雨后的光。\nA little room for wonder.  '); assert.equal(await probe(page, 'send').isDisabled(), false);
    });
  });
  await parity(`${prefix}/reply-draft`); await image('reply-draft');
  await act(async (page) => {
    await probe(page, 'send').click(); await focused(page, 'reply-lin'); assert.equal(await probe(page, 'editor').count(), 0);
    assert.equal(await probe(page, 'submitted-lin-0').textContent(), '我：今天注意到了雨后的光。\nA little room for wonder.');
    assert.equal(await probe(page, 'notice').innerText(), '回复已添加，仅当前页面可见。');
    await inheritance(page, true, true);
  });
  await parity(`${prefix}/submitted`); await image('submitted');
  await act(async (page) => {
    await probe(page, 'reply-zhou').click(); await focused(page, 'draft'); await probe(page, 'draft').fill('收起时丢弃');
    await probe(page, 'expand').click(); await focused(page, 'expand'); assert.equal(await probe(page, 'thread').count(), 0);
    await probe(page, 'expand').click(); await focused(page, 'comments-heading'); assert.equal(await probe(page, 'editor').count(), 0); assert.equal(await probe(page, 'submitted-lin-0').count(), 1);
    await probe(page, 'reply-zhou').click(); assert.equal(await probe(page, 'draft').inputValue(), ''); await probe(page, 'cancel').click(); await focused(page, 'reply-zhou');
  });
  await parity(`${prefix}/collapse-reopen-cancel`);
  await act(async (page) => { await probe(page, 'size').click(); await probe(page, 'tone').click(); await inheritance(page, false, false); await buttonState(page, false, false); });
  await parity(`${prefix}/restored-inheritance`);
  await act(async (page) => { await page.reload(); await probe(page, 'expand').click(); await focused(page, 'comments-heading'); assert.equal(await probe(page, 'submitted-lin-0').count(), 0); await inheritance(page, false, false); });
  await parity(`${prefix}/reload-resets-local-state`);
}
async function closeServer() {
  if (!server) return;
  if ('close' in server) await server.close();
  else await new Promise((resolve, reject) => server.httpServer.close((error) => error ? reject(error) : resolve()));
  server = undefined;
}
try {
  await mkdir(artifacts, { recursive: true });
  report.sourceHashes = {};
  await mkdir(join(artifacts, 'inputs'));
  for (const file of ['Article.gss', 'reference.css', 'Article.tsx', 'shell.css', 'scope.ts']) {
    const bytes = await readFile(join(source, file)); report.sourceHashes[file] = createHash('sha256').update(bytes).digest('hex');
    await writeFile(join(artifacts, 'inputs', file), bytes);
  }
  const browserType = { chromium, firefox, webkit }[engine]; report.executable = browserType.executablePath();
  browser = await browserType.launch({ headless: true }); report.browserVersion = browser.version();
  gssPage = await browser.newPage(pageOptions); nativePage = await browser.newPage(pageOptions);
  await both(async (page) => { page.on('pageerror', (error) => report.pageErrors.push(String(error))); });
  server = await createServer({ configFile, logLevel: 'silent', server: { port: 0, strictPort: false } }); await server.listen();
  report.scope = (await server.ssrLoadModule('/scope.ts')).scope;
  for (const width of [1440, 390, 320]) await sequence('dev', width);
  report.browserEnvironment = await gssPage.evaluate(() => ({ userAgent: window.navigator.userAgent, devicePixelRatio: window.devicePixelRatio,
    fontFamily: getComputedStyle(document.querySelector('[data-probe="article"]')).fontFamily, fontsStatus: document.fonts.status }));
  await closeServer();
  await build({ configFile, logLevel: 'silent' });
  const manifest = JSON.parse(await readFile(join(source, 'dist/gss-manifest.json'), 'utf8'));
  for (const [from, to] of [['gss-manifest.json', 'gss-manifest.json'], ['gss-report.json', 'gss-report.json'], ['.vite/manifest.json', 'vite-manifest.json']]) await cp(join(source, 'dist', from), join(artifacts, to));
  report.compilation = { modules: manifest.compiler.moduleDetails, atomicRules: manifest.compiler.rules.length, preservedRules: manifest.compiler.preservedRules.length,
    fallbackReasons: manifest.compiler.moduleDetails.flatMap((module) => module.fallbackReasons), limitation: 'Measured for this approved adjusted input only; no arbitrary CSS, unchanged-original-input or savings claim.' };
  assert.equal(manifest.compiler.moduleDetails.length, 1); assert.equal(manifest.compiler.moduleDetails[0].compilationMode, 'atomic');
  assert.equal(report.compilation.atomicRules, 147); assert.equal(report.compilation.preservedRules, 0); assert.deepEqual(report.compilation.fallbackReasons, []);
  server = await preview({ configFile, logLevel: 'silent', preview: { port: 0, strictPort: false } });
  for (const width of [1440, 390, 320]) await sequence('production', width);
  for (const [name, declaration] of [['computed-color', 'color: rgb(255, 0, 255) !important'], ['geometry', 'padding-left: 47px !important']]) {
    const canary = await gssPage.addStyleTag({ content: `[data-probe="intro"] { ${declaration}; }` });
    try { await assert.rejects(() => parity(`canary-${name}`, { negative: true }), /Native oracle mismatch/); report.negativeControls.push({ name, detected: true }); }
    finally { await canary.evaluate((node) => node.remove()); }
    await parity(`recovered-${name}`);
  }
  const paint = await gssPage.addStyleTag({ content: '[data-probe="quote"] { background-image: linear-gradient(magenta, magenta) !important; }' });
  try {
    // This corruption escapes the selected computed properties and geometry but not RGBA.
    await parity('paint-canary-computed-unchanged'); await visualParity('canary-paint', { negative: true });
  } finally { await paint.evaluate((node) => node.remove()); }
  await parity('recovered-paint'); await visualParity('recovered-paint');
  assert.equal(report.screenshots.length, 22); assert.equal(report.visualNegativeControls.length, 1); assert.equal(report.negativeControls.length, 2);
  assert.deepEqual(report.pageErrors, []);
  for (const [file, hash] of Object.entries(report.sourceHashes)) assert.equal(createHash('sha256').update(await readFile(join(source, file))).digest('hex'), hash, 'Business inputs must remain frozen throughout the check');
  report.passed = true;
  console.log(`Article ${engine} ${report.browserVersion}: ${report.phases.length} phases, ${report.screenshots.length} exact RGBA pairs, 2 computed/geometry and 1 paint negative controls with recovery; 147 atomic / 0 preserved rules.`);
} catch (error) {
  report.passed = false; report.error = error.stack ?? String(error);
  await gssPage?.screenshot({ path: join(artifacts, 'failure-gss.png'), fullPage: true }).catch(() => {});
  await nativePage?.screenshot({ path: join(artifacts, 'failure-native.png'), fullPage: true }).catch(() => {});
  throw error;
} finally {
  report.phaseCount = report.phases.length; report.screenshotCount = report.screenshots.length; report.finishedAt = new Date().toISOString();
  await writeFile(join(artifacts, 'result.json'), JSON.stringify(report, null, 2));
  try { await browser?.close(); } finally { await closeServer(); }
}
