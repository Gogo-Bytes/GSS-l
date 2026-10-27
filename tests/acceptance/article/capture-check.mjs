/* global document */
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { comparePng } from '../task-board/visual.mjs';
import { captureArticleRegion } from './capture.mjs';

/** Native/native regression: no compiler participates in screenshot state loss. */
export async function checkArticleCapture(browser, artifacts) {
  const images = [], controls = [];
  for (const index of [0, 1]) {
    const page = await browser.newPage({ viewport: { width: 390, height: 980 }, deviceScaleFactor: 1 });
    try {
      await page.setContent(`<style>body{margin:0} header{height:62.1px} article{height:2126.15px;background:white}
        button{margin:182.6px 20px 0;width:78px;height:37.5px;border:1px solid rgb(166,185,172);background:white}
        button[aria-pressed="true"]{background:rgb(223,238,227)}button:hover{border-color:rgb(82,124,100)}</style>
        <header></header><article data-probe="article"><button data-probe="size" aria-pressed="false">size</button></article>
        <footer>Host footer, as in the real Article page</footer>`);
      await page.locator('button').evaluate(node => node.addEventListener('click', () => node.setAttribute('aria-pressed', 'true')));
      await page.bringToFront(); await page.locator('button').click(); await page.locator('button').hover();
      const captured = await captureArticleRegion(page, { hover: true, pressed: 'true' });
      assert.equal(captured.before.border, 'rgb(82, 124, 100)');
      assert.equal(captured.before.background, 'rgb(223, 238, 227)');
      assert.ok(captured.clip.height > captured.before.viewport[1], 'Capture includes the full offscreen article');
      images.push(captured.image);
      await writeFile(join(artifacts, `capture-native-${index}.png`), captured.image);
      // Reproduce the old API's implicit scroll, then dispatch an actual mouse
      // move at the original pointer position (no forced pseudo-state/reset).
      const oldImage = await page.locator('article').screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
      const point = captured.before.target;
      await page.mouse.move(point.x + point.width / 2, point.y + point.height / 2);
      const lost = await page.locator('button').evaluate(node => ({ hover: document.querySelector('button:hover') === node,
        pressed: node.getAttribute('aria-pressed') }));
      assert.deepEqual(lost, { hover: false, pressed: 'true' });
      await assert.rejects(() => captureArticleRegion(page, { hover: true, pressed: 'true' }), /Required real state/);
      const negative = await page.locator('article').screenshot({ animations: 'disabled', caret: 'hide', scale: 'css' });
      const comparison = comparePng(negative, captured.image);
      await writeFile(join(artifacts, `capture-old-${index}.png`), oldImage);
      await writeFile(join(artifacts, `capture-lost-hover-${index}.png`), negative);
      assert.equal(comparison.dimensionsMatch, true, `Document clip and old element API cover identical full pixel bounds: ${JSON.stringify({ clip: captured.clip, actual: comparison.actual, expected: comparison.expected })}`);
      assert.deepEqual(comparison.expected, { width: captured.clip.width, height: captured.clip.height });
      assert.equal(comparison.passed, false, 'Lost real hover must change exact paint');
      controls.push({ before: captured.before, after: captured.after, clip: captured.clip, lost,
        differentPixels: comparison.differentPixels });
    } finally { await page.close(); }
  }
  const comparison = comparePng(images[0], images[1]);
  assert.equal(comparison.passed, true, 'Independent native/native captures preserve exact real hovered/pressed paint');
  return { controls, nativePair: { passed: comparison.passed, differentPixels: comparison.differentPixels } };
}
