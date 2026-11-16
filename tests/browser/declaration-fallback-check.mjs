/* global document, getComputedStyle */
import { createGssCompilerSession } from '@gss-l/compiler';
import { PNG } from 'pngjs';

export async function checkDeclarationFallback(browser) {
  const page = await browser.newPage();
  const cases = [
    ['last-supported', 'display:block;display:flex', { display: 'flex' }],
    ['reverse-order', 'display:flex;display:block', { display: 'block' }],
    ['unsupported-last', 'color:rgb(12,34,56);color:gss-unsupported', { color: 'rgb(12, 34, 56)' }],
    ['computed-invalid', 'color:red;color:var(--missing)', { color: 'rgb(0, 0, 0)' }],
    ['importance', 'color:red!important;color:blue!important;color:green', { color: 'rgb(0, 0, 255)' }],
    ['shorthand', 'margin:1px;margin:gss-unsupported;margin-left:3px', { marginTop: '1px', marginLeft: '3px' }]
  ];
  const results = [];
  try {
    for (const [name, declarations, expected] of cases) {
      const session = createGssCompilerSession({ projectRoot: '/project', namingMode: 'production' });
      const source = `.box { ${declarations} }`;
      const result = session.replaceStylesheet({ id: '/project/a.gss', source });
      if (!result.committed) throw new Error(JSON.stringify(result.diagnostics));
      const css = session.finalize().css;
      const classes = result.module.scopeSchema.exports.box.selfClassName;
      await page.setContent(`<style>body{color:black}div{box-sizing:border-box;width:140px;height:32px;padding:4px}
        .native { ${declarations} } ${css}</style>
        <div id="native" class="native">fallback</div><div id="atomic" class="${classes}">fallback</div>`);
      const readings = await page.evaluate(properties => Object.fromEntries(['native', 'atomic'].map(id =>
        [id, Object.fromEntries(properties.map(property => [property, getComputedStyle(document.getElementById(id))[property]]))])), Object.keys(expected));
      const native = PNG.sync.read(await page.locator('#native').screenshot());
      const atomic = PNG.sync.read(await page.locator('#atomic').screenshot());
      const pixelsEqual = native.width === atomic.width && native.height === atomic.height && native.data.equals(atomic.data);
      results.push({ name, source, css, classes, expected, ...readings, pixelsEqual,
        passed: pixelsEqual && JSON.stringify(readings.native) === JSON.stringify(expected) &&
          JSON.stringify(readings.atomic) === JSON.stringify(expected) });
    }
    // Corrupt the actual output; the independently written expected values must detect both faults.
    const lost = results.find(result => result.name === 'unsupported-last');
    const ordered = results.find(result => result.name === 'last-supported');
    const lostCss = lost.css.replace(/color: rgb\(12,\s*34,\s*56\);/, '');
    const reorderedCss = ordered.css.replace('display: block;\n  display: flex;', 'display: flex;\n  display: block;');
    if (lostCss === lost.css || reorderedCss === ordered.css) throw new Error('Fallback controls did not alter the intended output.');
    await page.setContent(`<style>body{color:black}${lostCss}${reorderedCss}</style>
      <div id="lost" class="${lost.classes}">fallback</div><div id="reordered" class="${ordered.classes}">fallback</div>`);
    const controls = await page.evaluate(() => ({
      lostFallback: getComputedStyle(document.getElementById('lost')).color !== 'rgb(12, 34, 56)',
      reordered: getComputedStyle(document.getElementById('reordered')).display !== 'flex'
    }));
    return { detected: results.every(result => result.passed) && controls.lostFallback && controls.reordered, results, controls };
  } finally { await page.close(); }
}
