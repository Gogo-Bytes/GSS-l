/* global document, getComputedStyle */
import { createGssCompilerSession } from '@gss-l/compiler';
import { PNG } from 'pngjs';

export async function checkDeclarationFallback(browser) {
  const page = await browser.newPage();
  const cases = [
    ['last-supported', 'display:block;display:flex', { display: 'flex' }],
    ['reverse-order', 'display:flex;display:block', { display: 'block' }],
    ['interleaved', 'display:block;color:red;display:flex', { display: 'flex', color: 'rgb(255, 0, 0)' }],
    ['interleaved-reverse', 'display:flex;color:red;display:block', { display: 'block', color: 'rgb(255, 0, 0)' }],
    ['interleaved-shorthand', 'margin:1px;margin-left:9px;margin:2px', { marginTop: '2px', marginLeft: '2px' }],
    ['interleaved-unsupported', 'margin:1px;margin-left:9px;margin:gss-unsupported', { marginTop: '1px', marginLeft: '9px' }],
    ['interleaved-computed', 'margin:1px;margin-left:9px;margin:var(--missing)', { marginTop: '0px', marginLeft: '0px' }],
    ['interleaved-important', 'margin:1px!important;margin-left:9px;margin:gss-unsupported!important', { marginTop: '1px', marginLeft: '1px' }],
    ['interleaved-middle-important', 'margin:1px;margin-left:9px!important;margin:2px', { marginTop: '2px', marginLeft: '9px' }],
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
    // Both rules may match. Check the interleaved shorthand's unopposed top as well as the contested left.
    for (const reverse of [false, true]) {
      const a = '.box[a]{margin:1px;margin-left:9px;margin:gss-unsupported}', b = '.box[b]{margin-left:3px}';
      const source = reverse ? b + a : a + b;
      const session = createGssCompilerSession({ projectRoot: '/project' });
      const update = session.replaceStylesheet({ id: '/project/Conditional.gss', source });
      if (!update.committed) throw new Error(JSON.stringify(update.diagnostics));
      const classes = update.module.scopeSchema.exports.box.selfClassName;
      await page.setContent(`<style>${source}${session.finalize().css}</style>` + ['box', classes].map(c =>
        ['', 'a', 'b', 'a b'].map(attrs => `<div class="${c}" ${attrs}></div>`).join('')).join(''));
      const actual = await page.locator('div').evaluateAll(nodes => nodes.map(n => {
        const s = getComputedStyle(n); return [s.marginTop, s.marginLeft];
      }));
      const expected = [['0px', '0px'], ['1px', '9px'], ['0px', '3px'], ['1px', reverse ? '9px' : '3px']];
      if (JSON.stringify(actual) !== JSON.stringify([...expected, ...expected])) throw new Error(`${source}: ${JSON.stringify(actual)}`);
    }
    // An unregistered name is not evidence that a declaration is inert: order works in this browser.
    for (const reverse of [false, true]) {
      const session = createGssCompilerSession({ projectRoot: '/project' });
      const sized = 'container-type:size;', reset = 'container:card / inline-size;';
      const shallow = '.button{background-color:blue;padding-top:7px;order:1}';
      const deep = `.panel .button{background:var(--paint);order:4;future-paint:1;${reverse ? reset + sized : sized + reset}}`;
      const update = session.replaceStylesheet({ id: '/project/Owned.gss', source: reverse ? deep + shallow : shallow + deep });
      if (!update.committed || update.module.compilationMode !== 'atomic') throw new Error(JSON.stringify(update.diagnostics));
      const { button, panel } = update.module.scopeSchema.exports, css = session.finalize().css;
      if (!css.includes('future-paint: 1;')) throw new Error('Unknown declaration was lost');
      await page.setContent(`<style>body{--paint:red}${css}</style><button class="${panel.targets.button.selfClassName}"></button>
        <section class="${panel.selfClassName}"><button class="${button.selfClassName}"></button></section>`);
      const actual = await page.locator('button').evaluateAll(nodes => nodes.map(n => {
        const s = getComputedStyle(n); return [s.backgroundColor, s.paddingTop, s.order, s.containerType];
      }));
      if (JSON.stringify(actual) !== JSON.stringify([['rgb(255, 0, 0)', '7px', '4', reverse ? 'size' : 'inline-size'], ['rgb(0, 0, 255)', '7px', '1', 'normal']])) throw new Error(JSON.stringify(actual));
    }
    // A compatibility expansion can also force fallback without any unknown authored property.
    for (const deepLast of [false, true]) {
      const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: [{ safari: '6.0' }] });
      const shallow = '.button{flex-direction:row;padding-top:7px}', deep = '.panel .button{flex-direction:column}';
      const update = session.replaceStylesheet({ id: '/project/Legacy.gss', source: deepLast ? shallow + deep : deep + shallow });
      if (!update.committed) throw new Error(JSON.stringify(update.diagnostics));
      const { panel, button } = update.module.scopeSchema.exports;
      await page.setContent(`<style>button{padding:0}${session.finalize().css}</style>
        <button class="${panel.targets.button.selfClassName}"></button><div class="${panel.selfClassName}"><button class="${button.selfClassName}"></button></div>`);
      const actual = await page.locator('button').evaluateAll(nodes => nodes.map(n => {
        const s = getComputedStyle(n); return [s.flexDirection, s.paddingTop];
      }));
      if (JSON.stringify(actual) !== JSON.stringify([['column', '7px'], ['row', '7px']])) throw new Error(`Compatibility scope binding: ${JSON.stringify(actual)}`);
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
