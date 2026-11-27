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
    // Same originating element, independent pseudo-element cascade. Observe both with and without a matching child.
    for (const reverse of [false, true]) {
      const local = '.box{display:block;color:red;display:flex;margin:1px;margin-left:9px;margin:gss-unsupported}';
      const other = '.box::before{content:"•";margin-left:17px}.box:has(> .child){padding-left:7px}';
      const source = reverse ? other + local : local + other;
      const session = createGssCompilerSession({ projectRoot: '/project' });
      const update = session.replaceStylesheet({ id: '/project/Mixed.gss', source });
      if (!update.committed) throw new Error(JSON.stringify(update.diagnostics));
      const { box, child } = update.module.scopeSchema.exports;
      await page.setContent(`<style>${source}${session.finalize().css}</style>` +
        [['box', 'child'], [box.selfClassName, child.selfClassName]].map(([b, c]) =>
          `<div class="${b}"></div><div class="${b}"><span class="${c}"></span></div>`).join(''));
      const actual = await page.locator('div').evaluateAll(nodes => nodes.map(n => {
        const s = getComputedStyle(n), p = getComputedStyle(n, '::before');
        return [s.display, s.color, s.marginTop, s.marginLeft, p.marginLeft, p.content, s.paddingLeft];
      }));
      const common = ['flex', 'rgb(255, 0, 0)', '1px', '9px', '17px', '"•"'];
      const expected = ['0px', '7px', '0px', '7px'].map(padding => [...common, padding]);
      if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${source}: ${JSON.stringify(actual)}`);
    }
    // Compose two scopes on one host. Only ::before competes; the host and ::after keep their own margins.
    for (const [last, top, left] of [['2px', '2px', '2px'], ['gss-unsupported', '1px', '9px'], ['var(--missing)', '0px', '0px']]) {
      for (const reverse of [false, true]) {
        const a = `.a::before{margin:1px;margin-left:9px;margin:${last}}`, b = '.b::before{margin-left:3px}';
        const source = '.host{margin-left:11px}.host::before{content:"b"}.host::after{content:"a";margin-left:17px}' + (reverse ? b + a : a + b);
        const session = createGssCompilerSession({ projectRoot: '/project', namingMode: 'production' });
        const update = session.replaceStylesheet({ id: '/project/Pseudo.gss', source });
        if (!update.committed) throw new Error(JSON.stringify(update.diagnostics));
        const scopes = update.module.scopeSchema.exports;
        const combinations = [['host'], ['host', 'a'], ['host', 'b'], ['host', 'a', 'b']];
        await page.setContent(`<style>${source}${session.finalize().css}</style>` + [false, true].map(compiled =>
          combinations.map(names => `<div class="${names.map(n => compiled ? scopes[n].selfClassName : n).join(' ')}"></div>`).join('')).join(''));
        const actual = await page.locator('div').evaluateAll(nodes => nodes.map(n => {
          const before = getComputedStyle(n, '::before');
          return [before.marginTop, before.marginLeft, getComputedStyle(n).marginLeft, getComputedStyle(n, '::after').marginLeft];
        }));
        const expected = [['0px', '0px'], [top, left], ['0px', '3px'], [top, reverse ? left : '3px']].map(pair => [...pair, '11px', '17px']);
        if (JSON.stringify(actual) !== JSON.stringify([...expected, ...expected])) throw new Error(`${source}: ${JSON.stringify(actual)}`);
      }
    }
    // The children supply witnesses; only their host receives the writes. Check a list, a conjunction, and their native tie.
    for (const [last, top, left] of [['2px', '2px', '2px'], ['gss-unsupported', '1px', '9px'], ['var(--missing)', '0px', '0px']]) {
      for (const reverse of [false, true]) {
        const a = `.box:has(> .a, > .b){margin:1px;margin-left:9px;margin:${last}}`;
        const b = '.box:has(> .c){margin-left:3px}';
        const source = (reverse ? b + a : a + b) + '.box:has(> .a):has(> .b){padding-top:7px}';
        const session = createGssCompilerSession({ projectRoot: '/project', namingMode: 'production' });
        const update = session.replaceStylesheet({ id: '/project/Observed.gss', source });
        if (!update.committed) throw new Error(JSON.stringify(update.diagnostics));
        const sets = ['', 'a', 'b', 'c', 'ab', 'abc'];
        const scopes = update.module.scopeSchema.exports;
        await page.setContent(`<style>${source}${session.finalize().css}</style>` + [false, true].map(compiled => {
          const cls = n => compiled ? scopes[n].selfClassName : n;
          return sets.map(set => `<div class="${cls('box')}">${[...set].map(n => `<i class="${cls(n)}"></i>`).join('')}</div>`).join('');
        }).join(''));
        const actual = await page.locator('div').evaluateAll(nodes => nodes.map(n => {
          const s = getComputedStyle(n); return [s.marginTop, s.marginLeft, s.paddingTop,
            [...n.children].every(child => getComputedStyle(child).marginLeft === '0px')];
        }));
        const expected = [['0px','0px','0px'], [top,left,'0px'], [top,left,'0px'], ['0px','3px','0px'],
          [top,left,'7px'], [top,reverse ? left : '3px','7px']].map(row => [...row, true]);
        if (JSON.stringify(actual) !== JSON.stringify([...expected, ...expected])) throw new Error(`${source}: ${JSON.stringify(actual)}`);
      }
    }
    // A weaker base cannot lift just the attribute side of a specificity tie with :has().
    for (const [writes, top, left] of [['margin-left:9px', '0px', '9px'], ['margin:1px;margin-left:9px;margin:gss-unsupported', '1px', '9px'],
      ['margin:1px;margin-left:9px;margin:var(--missing)', '0px', '0px'], ['margin:1px;margin-left:9px;margin:2px', '2px', '2px']]) {
      for (const reverse of [false, true]) {
        const local = '.box[x]{margin-left:4px}', observed = `.box:has(> .child){${writes}}`;
        const source = '.box{margin-left:5px}' + (reverse ? observed + local : local + observed);
        const session = createGssCompilerSession({ projectRoot: '/project', namingMode: 'production' });
        const update = session.replaceStylesheet({ id: '/project/Tie.gss', source });
        if (!update.committed) throw new Error(JSON.stringify(update.diagnostics));
        const { box, child } = update.module.scopeSchema.exports;
        await page.setContent(`<style>${source}${session.finalize().css}</style>` + [['box', 'child'], [box.selfClassName, child.selfClassName]].map(([b, c]) =>
          ['', 'x'].flatMap(attr => ['', `<i class="${c}"></i>`].map(inner => `<div class="${b}" ${attr}>${inner}</div>`)).join('')).join(''));
        const actual = await page.locator('div').evaluateAll(nodes => nodes.map(n => {
          const s = getComputedStyle(n); return [s.marginTop, s.marginLeft];
        }));
        const expected = [['0px', '5px'], [top, left], ['0px', '4px'], [top, reverse ? '4px' : left]];
        if (JSON.stringify(actual) !== JSON.stringify([...expected, ...expected])) throw new Error(`${source}: ${JSON.stringify(actual)}`);
      }
    }
    // The space before :global changes which node receives every declaration, not the fallback order.
    for (const space of ['', ' ']) {
      for (const [writes, top, left] of [['margin:1px;margin-left:9px;margin:2px', '2px', '2px'],
        ['margin:2px;margin-left:9px;margin:1px', '1px', '1px'], ['margin:1px;margin-left:9px;margin:gss-unsupported', '1px', '9px'],
        ['margin:1px;margin-left:9px;margin:var(--missing)', '0px', '0px'], ['margin:1px;margin-left:9px!important;margin:2px', '2px', '9px']]) {
        const source = `.editor${space}:global(.active){${writes}}`;
        const session = createGssCompilerSession({ projectRoot: '/project', namingMode: 'production' });
        const update = session.replaceStylesheet({ id: '/project/External.gss', source });
        if (!update.committed) throw new Error(JSON.stringify(update.diagnostics));
        const anchor = update.module.scopeSchema.exports.editor.selfClassName;
        await page.setContent(`<style>.editor${space}.active{${writes}}${session.finalize().css}</style>` + ['editor', anchor].map(c =>
          `<div class="${c} active"><i class="active"></i></div><div class="${c}"><i></i></div><div class="active"><i class="active"></i></div>`).join(''));
        const actual = await page.locator('div, i').evaluateAll(nodes => nodes.map(n => {
          const s = getComputedStyle(n); return [s.marginTop, s.marginLeft];
        }));
        const zero = ['0px', '0px'], hit = [top, left];
        const expected = [space ? zero : hit, space ? hit : zero, zero, zero, zero, zero];
        if (JSON.stringify(actual) !== JSON.stringify([...expected, ...expected])) throw new Error(`${source}: ${JSON.stringify(actual)}`);
      }
    }
    // External classes may co-occur; neither the anchor nor its DOM distance breaks a native tie.
    for (const [aSpace, bSpace] of [[' ', ' '], ['', ''], ['', ' ']]) for (const reverse of [false, true]) {
      for (const [last, top, left, qualifier] of [['gss-unsupported', '1px', '9px', ''], ['2px', '2px', '2px', ''],
        ['var(--missing)', '0px', '0px', ''], ['2px', '2px', '2px', '.strong']]) {
        const a = `.editor${aSpace}:global(.a){margin:1px;margin-left:9px;margin:${last}}`;
        const b = `.editor${bSpace}:global(.b${qualifier}){margin-left:3px}`;
        const source = reverse ? b + a : a + b;
        const session = createGssCompilerSession({ projectRoot: '/project', namingMode: 'production' });
        const update = session.replaceStylesheet({ id: '/project/Competing.gss', source });
        if (!update.committed) throw new Error(JSON.stringify(update.diagnostics));
        const anchor = update.module.scopeSchema.exports.editor.selfClassName;
        const native = source.replaceAll(/:global\(([^)]+)\)/g, '$1');
        await page.setContent(`<style>${native}${session.finalize().css}</style>` + ['editor', anchor].map(c =>
          `<section class="${c}">${['', 'a', 'b strong', 'a b strong'].map(state => `<i class="${c} ${state}"></i>`).join('')}</section>`).join(''));
        const actual = await page.locator('i').evaluateAll(nodes => nodes.map(n => {
          const s = getComputedStyle(n); return [s.marginTop, s.marginLeft];
        }));
        const expected = [['0px', '0px'], [top, left], ['0px', '3px'], [top, !reverse || qualifier ? '3px' : left]];
        if (JSON.stringify(actual) !== JSON.stringify([...expected, ...expected])) throw new Error(`${source}: ${JSON.stringify(actual)}`);
      }
    }
    // Separate stylesheets: the native control must not establish layer order for the compiler output.
    for (const bLayer of ['theme', '']) for (const reverse of [false, true]) for (const important of ['', '!important']) {
      const a = `@layer base{.editor:global(.a){margin:1px${important};margin-left:9px${important};margin:gss-unsupported${important}}}`;
      const bRule = `.editor :global(.b){margin-left:3px${important}}`;
      const b = bLayer ? `@layer ${bLayer}{${bRule}}` : bRule;
      const source = reverse ? b + a : a + b;
      const session = createGssCompilerSession({ projectRoot: '/project', namingMode: 'production', layers: ['base', 'theme'] });
      const update = session.replaceStylesheet({ id: '/project/ExternalLayers.gss', source });
      if (!update.committed) throw new Error(JSON.stringify(update.diagnostics));
      const expected = [['0px','0px'], ['1px','9px'], ['0px','3px'], ['1px', important ? '9px' : '3px']];
      for (const [css, anchor] of [['@layer base, theme;' + source.replaceAll(/:global\(([^)]+)\)/g, '$1'), 'editor'],
        [session.finalize().css, update.module.scopeSchema.exports.editor.selfClassName]]) {
        await page.setContent(`<style>${css}</style><section class="${anchor}">${['', 'a', 'b', 'a b'].map(state => `<i class="${anchor} ${state}"></i>`).join('')}</section>`);
        const actual = await page.locator('i').evaluateAll(nodes => nodes.map(n => {
          const s = getComputedStyle(n); return [s.marginTop, s.marginLeft];
        }));
        if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${source}: ${JSON.stringify(actual)}`);
      }
    }
    // The reference follows project query order, not GSS source order. Width and height can match independently.
    for (const reverseQueryOrder of [false, true]) for (const reverseSource of [false, true]) {
      const width = '(min-width: 600px)', height = '(min-height: 500px)', supports = '(display: grid)';
      const a = `@media ${width}{.editor:global(.active){margin:1px;margin-left:9px;margin:gss-unsupported}}`;
      const b = `@media ${height}{@supports ${supports}{.editor :global(.tag){margin-left:3px}}}`;
      const nativeA = a.replace(':global(.active)', '.active'), nativeB = b.replace(':global(.tag)', '.tag');
      const session = createGssCompilerSession({ projectRoot: '/project', namingMode: 'production',
        conditions: { media: reverseQueryOrder ? [height, width] : [width, height], supports: [supports] } });
      const update = session.replaceStylesheet({ id: '/project/ExternalQueries.gss', source: reverseSource ? b + a : a + b });
      if (!update.committed) throw new Error(JSON.stringify(update.diagnostics));
      for (const [css, anchor] of [[reverseQueryOrder ? nativeB + nativeA : nativeA + nativeB, 'editor'],
        [session.finalize().css, update.module.scopeSchema.exports.editor.selfClassName]]) {
        await page.setContent(`<style>${css}</style><section class="${anchor}"><i class="${anchor} active tag"></i></section>`);
        for (const [w, h, top, left] of [[400,400,'0px','0px'], [700,400,'1px','9px'], [400,600,'0px','3px'],
          [700,600,'1px',reverseQueryOrder ? '9px' : '3px']]) {
          await page.setViewportSize({ width: w, height: h });
          const actual = await page.locator('i').evaluate(n => [getComputedStyle(n).marginTop, getComputedStyle(n).marginLeft]);
          if (actual[0] !== top || actual[1] !== left) throw new Error(`External queries at ${w}x${h}: ${actual} vs ${top},${left}`);
        }
      }
    }
    // Only the owned node with the external class gets the refinement, even when its child also has the class.
    for (const reverse of [false, true]) for (const important of ['', '!important']) {
      const base = `.editor{margin:1px;margin-left:7px${important};margin:gss-unsupported}`;
      const active = '.editor:global(.active){margin:3px;margin-left:9px;margin:gss-unsupported}';
      const source = reverse ? active + base : base + active;
      const session = createGssCompilerSession({ projectRoot: '/project', namingMode: 'production' });
      const update = session.replaceStylesheet({ id: '/project/MixedExternal.gss', source });
      if (!update.committed) throw new Error(JSON.stringify(update.diagnostics));
      const expected = [['1px','7px'], ['0px','0px'], ['3px',important ? '7px' : '9px'], ['0px','0px']];
      for (const [css, c] of [[source.replace(':global(.active)', '.active'), 'editor'],
        [session.finalize().css, update.module.scopeSchema.exports.editor.selfClassName]]) {
        await page.setContent(`<style>${css}</style><div class="${c}"><i class="active"></i></div><div class="${c} active"></div><div class="active"></div>`);
        const actual = await page.locator('div, i').evaluateAll(nodes => nodes.map(n => {
          const s = getComputedStyle(n); return [s.marginTop, s.marginLeft];
        }));
        if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${source}: ${JSON.stringify(actual)}`);
      }
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
