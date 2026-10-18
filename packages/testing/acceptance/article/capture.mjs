/* global document, window, getComputedStyle */
import assert from 'node:assert/strict';

/** Capture the full article without locator.screenshot's implicit scroll, which
 * can move a hovered control out from under the real pointer. Keep the same
 * enclosing pixel bounds as an element screenshot; never crop to the viewport. */
export async function captureArticleRegion(page, expected) {
  const state = () => page.evaluate(() => {
    const article = document.querySelector('[data-probe="article"]'), size = document.querySelector('[data-probe="size"]');
    return { scroll: [window.scrollX, window.scrollY], viewport: [window.innerWidth, window.innerHeight],
      documentSize: ['Width', 'Height'].map(axis => Math.max(...[document.body, document.documentElement]
        .flatMap(node => ['scroll', 'offset', 'client'].map(kind => node[`${kind}${axis}`])))),
      visibility: document.visibilityState, foreground: document.hasFocus(),
      active: document.activeElement.getAttribute('data-probe'),
      hover: document.querySelector('[data-probe="size"]:hover') === size, pressed: size.getAttribute('aria-pressed'),
      border: getComputedStyle(size).borderTopColor, background: getComputedStyle(size).backgroundColor,
      article: article.getBoundingClientRect().toJSON(), target: size.getBoundingClientRect().toJSON() };
  });
  const before = await state();
  assert.deepEqual({ hover: before.hover, pressed: before.pressed }, expected, 'Required real state before article capture');
  assert.equal(before.visibility, 'visible'); assert.equal(before.foreground, true);
  assert.deepEqual(before.scroll, [0, 0], 'Article capture starts at the asserted snapshot origin');
  const box = before.article;
  // Match Playwright's enclosingIntRect pixel bounds, including fractional layout.
  const x = Math.floor(box.x + 1e-3), y = Math.floor(box.y + 1e-3);
  const clip = { x, y, width: Math.ceil(box.right - 1e-3) - x, height: Math.ceil(box.bottom - 1e-3) - y };
  assert.ok(clip.x + clip.width <= before.documentSize[0] && clip.y + clip.height <= before.documentSize[1],
    'The complete enclosing article bounds must fit the document; never silently trim its last pixel');
  const image = await page.screenshot({ fullPage: true, clip, animations: 'disabled', caret: 'hide', scale: 'css' });
  const after = await state();
  assert.deepEqual(after, before, 'Article capture must not change pointer state, focus, scroll, viewport or geometry');
  return { image, before, after, clip };
}
