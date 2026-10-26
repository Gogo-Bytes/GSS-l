/* global document, window, getComputedStyle, requestAnimationFrame */
import assert from 'node:assert/strict';
import console from 'node:console';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, URL } from 'node:url';
import { join } from 'node:path';
import { chromium, firefox, webkit } from 'playwright';
import postcss from 'postcss';
import { createGssCompilerSession } from '@gss-l/compiler';
import { comparePng } from '../task-board/visual.mjs';
import { fixtures } from './fixtures.mjs';
import { checkFixedModuleRanks } from './fixed-check.mjs';
import { checkLogicalPhysicalOrder } from './logical-physical-check.mjs';

const artifacts = fileURLToPath(new URL('../../../../artifacts/rank-integration/browser/', import.meta.url));
await mkdir(artifacts, { recursive: true });
const report = { passed: false, engines: [], compilations: [],
  scope: 'Module-wide effect ranks for already-admitted same-module compositions; established ownership/structural proofs first, logical-before-physical property priority, authored order last. Narrow current-node background admission unchanged. No same-node multi-module composition.',
  policy: 'Native CSS and exact expected colors authored independently. Real pointer/focus/click-driven aria state; each target sampled separately after foreground/reset. Exact computed values, geometry, scroll and representative decoded RGBA comparisons within each engine. No tolerance or masks.' };
const normalization = `html { font: 16px/1.5 sans-serif; background: white; } body { margin: 20px; }
  button { display: block; box-sizing: border-box; width: 160px; height: 48px; margin: 12px 0; padding: 4px;
    background-color: gray; color: black; border: 1px solid black; border-radius: 0; font: inherit; }
  #sink { width: 30px; height: 20px; }`;

function compile(fixture, entries = Object.entries(fixture.modules)) {
  const session = createGssCompilerSession({ projectRoot: '/rank-acceptance' });
  for (const [id, source] of entries) {
    const result = session.replaceStylesheet({ id: `/rank-acceptance/${id}`, source });
    assert.equal(result.committed, true, JSON.stringify(result.diagnostics));
    assert.deepEqual(result.diagnostics, []);
  }
  const snapshot = session.finalize();
  const classes = Object.fromEntries(fixture.targets.map((target) => {
    let node = { targets: session.getScopeSchema(`/rank-acceptance/${target.module}`).exports };
    for (const part of target.path) node = node.targets[part];
    return [target.name, node.selfClassName];
  }));
  return { snapshot, classes };
}
async function mount(page, fixture, compiled) {
  await page.setContent(`<style>${normalization}</style><style id="subject-css">${compiled ? compiled.snapshot.css : fixture.nativeCss}</style>
    <button id="sink" tabindex="-1" aria-label="reset"></button>${fixture.targets.map((target) =>
      `<button data-target="${target.name}" class="${compiled ? compiled.classes[target.name] : target.nativeClass}" aria-pressed="false">${target.name}</button>`).join('')}`);
  await page.evaluate(() => {
    for (const button of document.querySelectorAll('[data-target]')) button.addEventListener('click', () => {
      button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true'));
    });
  });
}
async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}
async function sample(page, target, state) {
  await page.bringToFront();
  await page.evaluate(() => window.scrollTo(0, 0));
  const button = page.locator(`[data-target="${target.name}"]`);
  if ((await button.getAttribute('aria-pressed') === 'true') !== state.pressed) await button.click();
  await page.locator('#sink').click();
  if (state.focus) await button.focus();
  // Foreground switching can retain the last pointer coordinates without dispatching
  // a new mousemove. Force a real excursion before requesting hover on either page.
  await page.mouse.move(0, 0);
  if (state.hover) await button.hover(); else await page.mouse.move(0, 0);
  await settle(page);
  const reading = await button.evaluate((node) => {
    const style = getComputedStyle(node), rect = node.getBoundingClientRect();
    return { background: style.backgroundColor, color: style.color, border: style.borderTopColor,
      geometry: [rect.x, rect.y, rect.width, rect.height], scroll: [window.scrollX, window.scrollY],
      hover: document.querySelector(`[data-target="${node.dataset.target}"]:hover`) === node, focus: document.activeElement === node, pressed: node.getAttribute('aria-pressed') === 'true' };
  });
  assert.deepEqual({ hover: reading.hover, focus: reading.focus, pressed: reading.pressed },
    { hover: state.hover, focus: state.focus, pressed: state.pressed });
  assert.deepEqual(reading.scroll, [0, 0]);
  return reading;
}
async function image(page, target) {
  return page.locator(`[data-target="${target.name}"]`).screenshot({ animations: 'disabled', caret: 'hide' });
}

// A browser-matched external descendant can hit a ranked target even when its
// owned anchor has a completely different path. Check rejection and last-good
// behavior here, not parity for an input that must never be committed.
async function checkExternalTargetBoundary(native, atomic, engineReport) {
  const seed = '.button:hover { background-color: red; } .button[aria-pressed="true"] { background-color: blue; }';
  const nativeSeed = '.native-button:hover { background-color: red; } .native-button[aria-pressed="true"] { background-color: blue; }';
  const id = '/rank-acceptance/Boundary.gss';
  const target = { name: 'button', nativeClass: 'native-button' };
  const state = { hover: true, focus: false, pressed: true };
  const wrapAnchor = (page, className) => page.locator('[data-target]').evaluate((button, anchorClass) => {
    const anchor = document.createElement('div');
    anchor.className = anchorClass;
    button.before(anchor);
    anchor.append(button);
  }, className);
  for (const atomizationFallback of ['error', 'preserve-module']) {
    const session = createGssCompilerSession({ projectRoot: '/rank-acceptance', atomizationFallback });
    assert.equal(session.replaceStylesheet({ id, source: seed + ' .root :global([aria-pressed="true"]) { color: green; }' }).committed, true);
    const snapshot = session.finalize(), schema = session.getScopeSchema(id);
    const fixture = { targets: [target], nativeCss: nativeSeed + ' .native-root [aria-pressed="true"] { color: green; }' };
    await mount(native, fixture);
    await wrapAnchor(native, 'native-root');
    await mount(atomic, fixture, { snapshot, classes: { button: schema.exports.button.selfClassName } });
    await wrapAnchor(atomic, schema.exports.root.selfClassName);
    const reference = await sample(native, target, state), lastGood = await sample(atomic, target, state);
    assert.equal(reference.background, 'rgb(0, 0, 255)');
    assert.equal(reference.color, 'rgb(0, 128, 0)');
    assert.deepEqual(lastGood, reference, 'Noncompeting external color remains accepted and browser-matched');
    engineReport.externalTargetBoundaries.push({ atomizationFallback, property: 'color', committed: true, reference, lastGood });
    for (const property of ['background-color', 'background']) {
      const result = session.replaceStylesheet({ id, source: seed + ` .root :global([aria-pressed="true"]) { ${property}: green; }` });
      assert.equal(result.committed, false);
      assert.deepEqual(result.diagnostics, [{ code: 'GSS1205', severity: 'error', phase: 'resolve', id,
        reason: 'ambiguous-coactive-state-conflict', message: 'Coactive descendant conditions assign ambiguous background-color on button.' }]);
      assert.deepEqual(session.finalize(), snapshot);
      assert.deepEqual(session.getScopeSchema(id), schema);
      await mount(native, { targets: [target], nativeCss: nativeSeed + ` .native-root [aria-pressed="true"] { ${property}: green; }` });
      await wrapAnchor(native, 'native-root');
      const rejectedNative = await sample(native, target, state), retainedCompiled = await sample(atomic, target, state);
      assert.equal(rejectedNative.background, 'rgb(0, 128, 0)', 'Different anchor does not prove external target disjointness');
      assert.deepEqual(retainedCompiled, lastGood, 'Rejected replacement leaves the last-good browser rendering unchanged');
      engineReport.externalTargetBoundaries.push({ atomizationFallback, property, committed: false,
        diagnostics: result.diagnostics, rejectedNative, retainedCompiled });
    }
  }
}

try {
  const compiled = new Map();
  for (const fixture of fixtures) {
    const result = compile(fixture);
    assert.deepEqual(compile(fixture, Object.entries(fixture.modules).reverse()), result, 'Registration order must not affect output');
    compiled.set(fixture.name, result);
    const item = { name: fixture.name, emittedRules: result.snapshot.manifest.rules.length,
      targetClassReferences: Object.values(result.classes).reduce((count, classes) => count + classes.split(' ').length, 0),
      distinctTargetClasses: new Set(Object.values(result.classes).flatMap((classes) => classes.split(' '))).size,
      ...result };
    report.compilations.push(item);
  }
  for (const [engine, launcher] of Object.entries({ chromium, firefox, webkit })) {
    const engineReport = { engine, comparisons: [], screenshots: [], negativeControls: [], externalTargetBoundaries: [], errors: [] };
    report.engines.push(engineReport);
    const directory = join(artifacts, engine);
    await mkdir(directory, { recursive: true });
    const browser = await launcher.launch({ headless: true });
    try {
      const context = await browser.newContext({ viewport: { width: 800, height: 720 }, deviceScaleFactor: 1,
        locale: 'en-US', timezoneId: 'UTC', colorScheme: 'light', reducedMotion: 'reduce' });
      const native = await context.newPage(), atomic = await context.newPage();
      for (const page of [native, atomic]) page.on('pageerror', (error) => engineReport.errors.push(String(error)));
      for (const fixture of fixtures) {
        await mount(native, fixture);
        await mount(atomic, fixture, compiled.get(fixture.name));
        for (const target of fixture.targets) {
          for (const [index, state] of fixture.states.entries()) {
            const reference = await sample(native, target, state);
            assert.equal(reference.background, target.expected[index], `${fixture.name}/${target.name}/${state.name}: independent native expectation`);
            const expectedImage = fixture.images ? await image(native, target) : undefined;
            const actual = await sample(atomic, target, state);
            assert.equal(actual.background, target.expected[index], `${fixture.name}/${target.name}/${state.name}: compiled expectation`);
            assert.deepEqual(actual, reference, `${fixture.name}/${target.name}/${state.name}: native parity`);
            engineReport.comparisons.push({ fixture: fixture.name, target: target.name, state: state.name, expected: target.expected[index], reference, actual });
            if (expectedImage) {
              const actualImage = await image(atomic, target), comparison = comparePng(actualImage, expectedImage);
              const name = `${fixture.name}-${target.name}-${state.name}`;
              await writeFile(join(directory, `${name}-native.png`), expectedImage);
              await writeFile(join(directory, `${name}-compiled.png`), actualImage);
              const { diff, ...summary } = comparison;
              if (!comparison.passed) await writeFile(join(directory, `${name}-diff.png`), diff);
              engineReport.screenshots.push({ name, ...summary });
              assert.equal(comparison.passed, true, `${name}: exact representative screenshot`);
            }
          }
        }
        if (fixture.corruptOrder) {
          const tree = postcss.parse(compiled.get(fixture.name).snapshot.css);
          tree.nodes.reverse();
          await atomic.locator('#subject-css').evaluate((style, css) => { style.textContent = css; }, tree.toString());
          for (const target of fixture.targets.slice(0, 2)) {
            const state = fixture.states[3];
            const expected = await sample(native, target, state), expectedImage = await image(native, target);
            const corrupted = await sample(atomic, target, state), actualImage = await image(atomic, target);
            const comparison = comparePng(actualImage, expectedImage);
            assert.notEqual(corrupted.background, expected.background, 'Order corruption must be detected for each opposite target');
            assert.equal(comparison.passed, false, 'Order corruption must change representative paint');
            await writeFile(join(directory, `corrupted-${target.name}.png`), actualImage);
            await writeFile(join(directory, `corrupted-${target.name}-diff.png`), comparison.diff);
            engineReport.negativeControls.push({ target: target.name, expected: expected.background, corrupted: corrupted.background,
              detected: true, differentPixels: comparison.differentPixels });
          }
        }
      }
      engineReport.fixedModule = { fixtures: [], comparisons: [], images: [], negativeControls: [] };
      await checkFixedModuleRanks(native, atomic, directory, engineReport.fixedModule);
      console.log(`${engine}: fixed module ${engineReport.fixedModule.fixtures.length} fixtures, ${engineReport.fixedModule.comparisons.length} comparisons, ${engineReport.fixedModule.images.length} exact image pairs, ${engineReport.fixedModule.negativeControls.length} corruptions`);
      engineReport.logicalPhysical = {};
      await checkLogicalPhysicalOrder(native, atomic, directory, engineReport.logicalPhysical);
      console.log(`${engine}: logical/physical ${engineReport.logicalPhysical.simpleFixtures} simple + ${engineReport.logicalPhysical.semanticFixtures} semantic fixtures, ${engineReport.logicalPhysical.readings.length * 2} paired readings + ${engineReport.logicalPhysical.authoredReadings.length} original-native readings, ${engineReport.logicalPhysical.images.length} exact image pairs, ${engineReport.logicalPhysical.negativeControls.length} corruptions`);
      await checkExternalTargetBoundary(native, atomic, engineReport);
      assert.equal(engineReport.externalTargetBoundaries.length, 6);
      assert.deepEqual(engineReport.errors, []);
      assert.equal(engineReport.comparisons.length, 96);
      assert.equal(engineReport.screenshots.length, 32);
      assert.equal(engineReport.negativeControls.length, 2);
      console.log(`${engine}: ${engineReport.comparisons.length} state comparisons, ${engineReport.screenshots.length} exact image pairs, ${engineReport.negativeControls.length} detected order corruptions, ${engineReport.externalTargetBoundaries.length} external-target boundary checks`);
    } finally { await browser.close(); }
  }
  report.passed = true;
} finally {
  await writeFile(join(artifacts, 'result.json'), JSON.stringify(report, null, 2));
}
console.log(`Module-local atom rank acceptance passed: ${artifacts}`);
