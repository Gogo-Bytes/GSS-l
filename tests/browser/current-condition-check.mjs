import assert from 'node:assert/strict';
import { createGssCompilerSession } from '@gss-l/compiler';

export async function checkCurrentConditions(browser) {
  await checkCompoundMarkers(browser);
  await checkHasListAgainstSibling(browser);
  await checkHasListValidity(browser);
  await checkNativeAttributeSubjects(browser);
  await checkTextEmphasis(browser);
  await checkLanguageDirection(browser);
  await checkConditionedPrefix(browser);
  await checkExclusiveWitnesses(browser);
  await checkStructuralEdgePositions(browser);
  await checkChildConditions(browser);
  await checkStructuralShorthandTie(browser);
  await checkWrapAlias(browser);
  await checkStructuralFunctionComposition(browser);
  await checkEquivalentStructuralFunctions(browser);
  await checkFunctionalCompositionOrder(browser);
  await checkFunctionalAttributes(browser);
  await checkQuotedGlobal(browser);
  await checkOwnedCurrentConditions(browser);
  const base = '.a,.other {color:black}';
  const focus = '.a:hover:focus {color:blue}';
  const on = '.a[data-on]:hover {color:red}';
  // A weaker predicate for only one competitor must not change the order of the tie.
  const weaker = '.a:focus {color:green}';
  for (const reverse of [false, true]) {
    const source = base + weaker + (reverse ? on + focus : focus + on) + '.zone:hover .leaf {color:silver}';
    const session = createGssCompilerSession({ projectRoot: '/p' });
    const update = session.replaceStylesheet({ id: '/p/A.gss', source });
    assert.deepEqual(update.diagnostics, []);
    assert.equal(update.module.compilationMode, 'atomic');
    const { a, other } = session.getScopeSchema('/p/A.gss').exports;
    assert.ok(a.selfClassName.split(' ').includes(other.selfClassName), 'The two subjects actually share the base atom');
    for (const [css, active, inactive] of [[source, 'a', 'other'], [session.finalize().css, a.selfClassName, other.selfClassName]]) {
      const page = await browser.newPage();
      try {
        await page.setContent(`<style>${css}</style><button data-on class="${active}">A</button><button data-on class="${inactive}">B</button>`);
        const [first, second] = await page.locator('button').all();
        const color = el => el.evaluate(node => node.ownerDocument.defaultView.getComputedStyle(node).color);
        await first.hover(); assert.equal(await color(first), 'rgb(255, 0, 0)');
        await first.focus(); assert.equal(await color(first), reverse ? 'rgb(0, 0, 255)' : 'rgb(255, 0, 0)');
        await first.evaluate(node => node.removeAttribute('data-on')); assert.equal(await color(first), 'rgb(0, 0, 255)');
        await second.hover(); await second.focus(); assert.equal(await color(second), 'rgb(0, 0, 0)');
      } finally { await page.close(); }
    }
  }
}

async function checkCompoundMarkers(browser) {
  const page = await browser.newPage();
  try {
    for (const selector of ['.button.active', '.button:is(.active)']) {
      const session = createGssCompilerSession({ projectRoot: '/p', namingMode: 'production' });
      const source = `${selector}{opacity:.5}`;
      const compile = source => {
        const update = session.replaceStylesheet({ id: '/p/A.gss', source });
        assert.deepEqual(update.diagnostics, []);
        return update.module.scopeSchema.exports;
      };
      const simple = compile(source);
      assert.deepEqual(simple.button.targets, {});
      assert.deepEqual(Object.keys(simple).sort(), ['active', 'button']);
      assert.equal(session.finalize().manifest.rules[0].selector, `.${simple.button.selfClassName}:is(.${simple.active.selfClassName})`);
      const { button, active } = compile(source + '.button .active{padding:8px}');
      const b = button.selfClassName, a = active.selfClassName, deep = button.targets.active.selfClassName;
      const native = `${selector}{opacity:.5}.deep{padding:8px}`; // JSX explicitly selects the ownership path.
      for (const [css, subject, flag, path] of [[native, 'button', 'active', 'deep'], [session.finalize().css, b, a, deep]]) {
        await page.setContent(`<style>${css}</style>` + [subject, flag, `${subject} ${flag}`, path].map(c => `<i class="${c}"></i>`).join('') +
          `<span class="${subject}"><i class="${flag}"></i></span>`);
        assert.deepEqual(await page.locator('i').evaluateAll(nodes => nodes.map(el => { const s = el.ownerDocument.defaultView.getComputedStyle(el);
          return [s.opacity, s.paddingTop]; })), [['1','0px'], ['1','0px'], ['0.5','0px'], ['1','8px'], ['1','0px']]);
      }
    }
  } finally { await page.close(); }
}

async function checkHasListAgainstSibling(browser) {
  const page = await browser.newPage();
  try {
    const observed = '.root .card:has(.a,.b:checked){opacity:.5}', sibling = '.root[ready] + .card{opacity:.75}';
    for (const source of [observed + sibling, sibling + observed]) {
      const session = createGssCompilerSession({ projectRoot: '/p' });
      const result = session.replaceStylesheet({ id: '/p/A.gss', source });
      assert.deepEqual(result.diagnostics, []);
      const { root, a } = result.module.scopeSchema.exports;
      for (const [css, anchor, card, child] of [[source, 'root', 'card', 'a'],
        [session.finalize().css, root.selfClassName, root.targets.card.selfClassName, a.selfClassName]]) {
        // Only the weaker list branch (.a) ever matches. The unchecked branch still sets specificity.
        await page.setContent(`<style>${css}</style>` + [[true, true], [false, true], [true, false], [false, false]]
          .map(([ready, hasChild]) => `<section class="${anchor}"><i class="${anchor}" ${ready ? 'ready' : ''}></i>` +
            `<article class="${card}">${hasChild ? `<b class="${child}"></b>` : ''}</article></section>`).join(''));
        assert.deepEqual(await page.locator('article').evaluateAll(nodes => nodes.map(el =>
          el.ownerDocument.defaultView.getComputedStyle(el).opacity)), ['0.5', '0.5', '0.75', '1']);
      }
    }
  } finally { await page.close(); }
}

async function checkHasListValidity(browser) {
  const page = await browser.newPage();
  try {
    const supportsCaseSensitive = await page.evaluate(() => globalThis.CSS.supports('selector([data-kind="yes" s])'));
    for (const flag of ['i', 's']) {
      const source = `.box:has(> [data-kind="yes" ${flag}], > [ready]){opacity:.5}`;
      const session = createGssCompilerSession({ projectRoot: '/p' });
      const result = session.replaceStylesheet({ id: '/p/A.gss', source });
      assert.deepEqual(result.diagnostics, []);
      const valid = flag === 'i' || supportsCaseSensitive;
      for (const [css, box] of [[source, 'box'], [session.finalize().css, result.module.scopeSchema.exports.box.selfClassName]]) {
        await page.setContent(`<style>${css}</style>` + ['data-kind="yes"', 'ready', 'ready data-kind="yes"', ''].map(attrs =>
          `<div class="${box}"><i ${attrs}></i></div>`).join(''));
        const values = await page.locator('div').evaluateAll(nodes => nodes.map(el => el.ownerDocument.defaultView.getComputedStyle(el).opacity));
        assert.deepEqual(values, valid ? ['0.5', '0.5', '0.5', '1'] : ['1', '1', '1', '1']);
      }
    }
  } finally { await page.close(); }
}

async function checkNativeAttributeSubjects(browser) {
  const source = '.box:has(> [data-kind^="warn" i]){opacity:.5}.box :global([data-kind~="ready" i]){outline-style:solid}';
  const session = createGssCompilerSession({ projectRoot: '/p' });
  const result = session.replaceStylesheet({ id: '/p/A.gss', source });
  assert.deepEqual(result.diagnostics, []);
  assert.deepEqual(Object.keys(result.module.scopeSchema.exports), ['box']);
  const page = await browser.newPage();
  try {
    for (const [css, box] of [[source.replace(':global([data-kind~="ready" i])', '[data-kind~="ready" i]'), 'box'],
      [session.finalize().css, result.module.scopeSchema.exports.box.selfClassName]]) {
      await page.setContent(`<style>${css}</style><div class="${box}"><i></i></div><i data-kind="ready"></i>`);
      for (const [kind, opacity, outline] of [['WARN READY', '0.5', 'solid'], ['warn', '0.5', 'none'],
        ['Ready', '1', 'solid'], ['already', '1', 'none']]) {
        await page.locator('div > i').evaluate((el, value) => el.setAttribute('data-kind', value), kind);
        assert.deepEqual(await page.locator('div, i').evaluateAll(nodes => nodes.map(el => {
          const style = el.ownerDocument.defaultView.getComputedStyle(el);
          return [style.opacity, style.outlineStyle];
        })), [[opacity, 'none'], ['1', outline], ['1', 'none']]);
      }
    }
  } finally { await page.close(); }
}

async function checkTextEmphasis(browser) {
  const page = await browser.newPage();
  try {
    const shorthand = 'text-emphasis:var(--mark)', longhand = 'text-emphasis-color:blue';
    for (const [declarations, expectedColor] of [[`${shorthand};${longhand}`, 'rgb(0, 0, 255)'],
      [`${longhand};${shorthand}`, 'rgb(255, 0, 0)'], [`${longhand}!important;${shorthand}`, 'rgb(0, 0, 255)']]) {
      const source = `.text{text-emphasis-position:under left;${declarations}}`;
      const session = createGssCompilerSession({ projectRoot: '/p' });
      const result = session.replaceStylesheet({ id: '/p/E.gss', source });
      assert.deepEqual(result.diagnostics, []);
      assert.equal(result.module.compilationMode, 'atomic');
      for (const [css, scope] of [[source, 'text'], [session.finalize().css, result.module.scopeSchema.exports.text.selfClassName]]) {
        await page.setContent(`<style>${css}</style><p class="${scope}" style="--mark:dot red">text</p>`);
        assert.deepEqual(await page.locator('p').evaluate(el => { const s = el.ownerDocument.defaultView.getComputedStyle(el);
          return [s.textEmphasisColor, s.textEmphasisStyle, s.textEmphasisPosition]; }), [expectedColor, 'dot', 'under left']);
      }
    }
  } finally { await page.close(); }
}

async function checkLanguageDirection(browser) {
  const page = await browser.newPage();
  try {
    const lang = '.panel:LANG(zh) > .text{color:red}', dir = '.panel > .text:DIR(rtl){color:blue}';
    for (const langLast of [false, true]) {
      const source = langLast ? dir + lang : lang + dir;
      const session = createGssCompilerSession({ projectRoot: '/p' });
      const result = session.replaceStylesheet({ id: '/p/D.gss', source });
      assert.deepEqual(result.diagnostics, []);
      const { panel } = result.module.scopeSchema.exports;
      for (const [css, parent, child] of [[source, 'panel', 'text'], [session.finalize().css, panel.selfClassName, panel.targets.text.selfClassName]]) {
        await page.setContent(`<style>span{color:green}${css}</style><article><div class="${parent}"><span class="${child}">text</span></div></article>`);
        const actual = await page.locator('span').evaluate(el => {
          const read = () => el.ownerDocument.defaultView.getComputedStyle(el).color;
          const outer = el.closest('article'); outer.lang = 'en'; outer.dir = 'ltr';
          const values = [read()]; outer.lang = 'zh-Hant'; values.push(read()); outer.dir = 'rtl'; values.push(read());
          outer.lang = 'en'; values.push(read()); el.lang = 'zh'; el.dir = 'ltr'; values.push(read()); return values;
        });
        assert.deepEqual(actual, ['rgb(0, 128, 0)', 'rgb(255, 0, 0)', langLast ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)', 'rgb(0, 0, 255)', 'rgb(0, 128, 0)']);
      }
    }
  } finally { await page.close(); }
}

async function checkConditionedPrefix(browser) {
  const page = await browser.newPage();
  try {
    for (const edge of ['>', ' ']) {
      const source = `.a:is([x]) .gap .mid[y] ${edge} .b:is(.active){color:blue}`;
      const session = createGssCompilerSession({ projectRoot: '/p' });
      const update = session.replaceStylesheet({ id: '/p/Chain.gss', source });
      assert.deepEqual(update.diagnostics, []);
      const { a, active } = update.module.scopeSchema.exports, mid = a.targets.gap.targets.mid;
      const native = `.a:is([x]) .m[y] ${edge} .b:is(.active){color:blue}`;
      for (const [css, parent, middle, target, flag] of [[native, 'a', 'm', 'b', 'active'],
        [session.finalize().css, a.selfClassName, mid.selfClassName, mid.targets.b.selfClassName, active.selfClassName]]) {
        for (const [x, y, enabled, gap, hit] of [[true, true, true, false, true], [false, true, true, false, false],
          [true, false, true, false, false], [true, true, false, false, false], [true, true, true, true, edge === ' ']]) {
          const leaf = `<i class="${target} ${enabled ? flag : ''}"></i>`;
          await page.setContent(`<style>i{color:red}${css}</style><div class="${parent}" ${x ? 'x' : ''}><div class="${middle}" ${y ? 'y' : ''}>${gap ? `<div>${leaf}</div>` : leaf}</div></div>`);
          assert.equal(await page.locator('i').evaluate(el => el.ownerDocument.defaultView.getComputedStyle(el).color), hit ? 'rgb(0, 0, 255)' : 'rgb(255, 0, 0)');
        }
      }
    }
  } finally { await page.close(); }
}

async function checkExclusiveWitnesses(browser) {
  const page = await browser.newPage();
  const red = 'rgb(255, 0, 0)', blue = 'rgb(0, 0, 255)';
  try {
    for (const [left, right, html] of [
      ['.a[type=button] + .b', '.a[type=BUTTON] + .b', '<button type=button class=a></button><i class=b></i>'],
      ['.a[data-mode=on] .b', '.a[data-mode=off] .b', '<div class=a data-mode=on><div class=a data-mode=off><i class=b></i></div></div>']
    ]) for (const reverse of [false, true]) {
      const rules = [`${left}{color:red}`, `${right}{color:blue}`];
      const source = (reverse ? rules.reverse() : rules).join('');
      await page.setContent(`<style>${source}</style>${html}`);
      assert.deepEqual(await page.locator('i').evaluate((el, selectors) => [
        ...selectors.map(s => el.matches(s)), el.ownerDocument.defaultView.getComputedStyle(el).color
      ], [left, right]), [true, true, reverse ? red : blue]);
      const session = createGssCompilerSession({ projectRoot: '/p' });
      const update = session.replaceStylesheet({ id: '/p/S.gss', source });
      assert.deepEqual(update.diagnostics, []);
      const a = update.module.scopeSchema.exports.a;
      assert.equal(new Set(a.selfClassName.split(' ')).size, 2);
      assert.equal(new Set(a.targets.b.selfClassName.split(' ')).size, 2);
      const marked = html.replaceAll('class=a', `class="${a.selfClassName}"`).replace('class=b', `class="${a.targets.b.selfClassName}"`);
      await page.setContent(`<style>${session.finalize().css}</style>${marked}`);
      assert.equal(await page.locator('i').evaluate(el => el.ownerDocument.defaultView.getComputedStyle(el).color), reverse ? red : blue);
    }
    // A weaker rule refining only one side of the tie must not lift its equal-strength competitor.
    for (const reverse of [false, true]) {
      const on = '.a[data-mode=on][x] .b{color:red}', off = '.a[data-mode=off][y] .b{color:blue}';
      const source = '.a[x] .b{color:orange}' + (reverse ? off + on : on + off);
      const session = createGssCompilerSession({ projectRoot: '/p' });
      const update = session.replaceStylesheet({ id: '/p/Nested.gss', source });
      assert.deepEqual(update.diagnostics, []);
      const a = update.module.scopeSchema.exports.a;
      for (const [css, parent, target] of [[source, 'a', 'b'], [session.finalize().css, a.selfClassName, a.targets.b.selfClassName]]) {
        for (const [outer, inner, expected] of [[true, true, reverse ? red : blue], [true, false, red], [false, true, blue], [false, false, 'rgb(0, 128, 0)']]) {
          await page.setContent(`<style>i{color:green}${css}</style><div class="${parent}" ${outer ? 'data-mode=on x' : ''}><div class="${parent}" ${inner ? 'data-mode=off y' : ''}><i class="${target}"></i></div></div>`);
          assert.equal(await page.locator('i').evaluate(el => el.ownerDocument.defaultView.getComputedStyle(el).color), expected);
        }
      }
    }
    const source = '.a[x] > .b[data-mode=A]{color:red}.a[y] > .b[data-mode=a]{color:blue}';
    const session = createGssCompilerSession({ projectRoot: '/p' });
    const update = session.replaceStylesheet({ id: '/p/S.gss', source });
    assert.deepEqual(update.diagnostics, []);
    const { a } = update.module.scopeSchema.exports;
    for (const [css, parent, child] of [[source, 'a', 'b'], [session.finalize().css, a.selfClassName, a.targets.b.selfClassName]]) {
      await page.setContent(`<style>${css}</style><div x y class="${parent}"><i class="${child}"></i></div>`);
      for (const [mode, expected] of [['A', red], ['a', blue]]) {
        assert.equal(await page.locator('i').evaluate((el, value) => {
          el.dataset.mode = value; return el.ownerDocument.defaultView.getComputedStyle(el).color;
        }, mode), expected);
      }
    }
  } finally { await page.close(); }
}

async function checkStructuralEdgePositions(browser) {
  const page = await browser.newPage();
  try {
    for (const reverse of [false, true]) {
      const rules = ['.p > .m .b{color:red!important}', '.p .m > .b{color:blue}'];
      const session = createGssCompilerSession({ projectRoot: '/p' });
      const update = session.replaceStylesheet({ id: '/p/Edges.gss', source: (reverse ? rules.reverse() : rules).join('') });
      assert.deepEqual(update.diagnostics, []);
      const { p } = update.module.scopeSchema.exports, m = p.targets.m, b = m.targets.b;
      // The second rule binds m > b; p is an ownership prefix, not a required ancestor.
      const refs = ['.p > .m .b{color:red!important}', '.m.m > .b{color:blue}'];
      for (const [css, parent, middle, target] of [[(reverse ? refs.reverse() : refs).join(''), 'p', 'm', 'b'],
        [session.finalize().css, p.selfClassName, m.selfClassName, b.selfClassName]]) {
        const leaf = `<button class="${target}"></button>`, wrap = html => `<div>${html}</div>`;
        const container = (name, html) => `<section class="${name}">${html}</section>`;
        for (const [html, expected] of [[container(middle, leaf), 'rgb(0, 0, 255)'],
          [container(parent, container(middle, wrap(leaf))), 'rgb(255, 0, 0)'],
          [container(parent, container(middle, leaf)), 'rgb(255, 0, 0)'], [container(middle, wrap(leaf)), 'rgb(0, 128, 0)']]) {
          await page.setContent(`<style>button{color:green}${css}</style>${html}`);
          assert.equal(await page.locator('button').evaluate(el => el.ownerDocument.defaultView.getComputedStyle(el).color), expected);
        }
      }
    }
  } finally { await page.close(); }
}

async function checkChildConditions(browser) {
  const page = await browser.newPage();
  try {
    for (const blueLast of [false, true]) {
      const rules = (base, deep) => {
        const whenFocused = `.panel[data-open] > .${deep}:focus`;
        const colors = blueLast ? ['green', 'blue'] : ['blue', 'green'];
        return `.${base}{color:red}` + colors.map(color => `${whenFocused}{color:${color}}`).join('') +
          `.panel[data-open] > .${deep}[data-mode^="warn" i]{color:${colors[1]}}`;
      };
      const session = createGssCompilerSession({ projectRoot: '/p' });
      const update = session.replaceStylesheet({ id: '/p/C.gss', source: rules('button', 'button') });
      assert.deepEqual(update.diagnostics, []);
      const { panel, button } = update.module.scopeSchema.exports;
      for (const [css, parent, deep, shallow] of [[rules('button', 'owned'), 'panel', 'button owned', 'button'],
        [session.finalize().css, panel.selfClassName, panel.targets.button.selfClassName, button.selfClassName]]) {
        await page.setContent(`<style>${css}</style><section data-open class="${parent}"><button class="${deep}">child</button></section>`);
        const readings = await page.locator('button').evaluate((node, shallowClass) => {
          const parent = node.parentElement;
          const color = () => node.ownerDocument.defaultView.getComputedStyle(node).color;
          const colors = [color()];
          node.focus(); colors.push(color());
          parent.removeAttribute('data-open'); node.setAttribute('data-open', ''); colors.push(color());
          parent.setAttribute('data-open', ''); node.blur(); colors.push(color());
          node.dataset.mode = 'WARNING'; colors.push(color()); delete node.dataset.mode;
          const wrapper = node.ownerDocument.createElement('div'); wrapper.setAttribute('data-open', '');
          parent.append(wrapper); wrapper.append(node); node.focus(); colors.push(color());
          parent.append(node); node.focus(); colors.push(color());
          node.className = shallowClass; colors.push(color());
          return colors;
        }, shallow);
        const red = 'rgb(255, 0, 0)', winner = blueLast ? 'rgb(0, 0, 255)' : 'rgb(0, 128, 0)';
        assert.deepEqual(readings, [red, winner, red, red, winner, red, winner, red]);
      }
    }
  } finally { await page.close(); }
}

async function checkStructuralShorthandTie(browser) {
  const page = await browser.newPage();
  try {
    for (const withFunction of [false, true]) for (const redLast of [false, true]) {
      const red = `.p${withFunction ? ':is([x],[y][z])' : '[x]'} > .b{background-color:red}`;
      const blue = `.q[v][w]${withFunction ? '[u]' : ''}{background:var(--paint)}`;
      const source = '.b{background-color:green}' + (redLast ? blue + red : red + blue);
      const session = createGssCompilerSession({ projectRoot: '/p' });
      const update = session.replaceStylesheet({ id: '/p/B.gss', source });
      assert.deepEqual(update.diagnostics, []);
      const { p, q } = update.module.scopeSchema.exports;
      for (const [css, parent, target] of [[source, 'p', 'b q'],
        [session.finalize().css, p.selfClassName, `${p.targets.b.selfClassName} ${q.selfClassName}`]]) {
        await page.setContent(`<style>${css}</style><section class="${parent}" x style="--paint:blue no-repeat"><span class="${target}" v w u>B</span></section>`);
        const readings = await page.locator('span').evaluate(el => {
          const read = () => { const s = el.ownerDocument.defaultView.getComputedStyle(el); return [s.backgroundColor, s.backgroundRepeat]; };
          const values = [read()]; el.removeAttribute('v'); values.push(read());
          el.parentElement.removeAttribute('x'); values.push(read()); el.setAttribute('v', ''); values.push(read()); return values;
        });
        assert.deepEqual(readings, [[redLast ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)', 'no-repeat'],
          ['rgb(255, 0, 0)', 'repeat'], ['rgb(0, 128, 0)', 'repeat'], ['rgb(0, 0, 255)', 'no-repeat']]);
      }
    }
  } finally { await page.close(); }
}

async function checkWrapAlias(browser) {
  const page = await browser.newPage();
  try {
    for (const aliasLast of [false, true]) {
      const alias = '.card[data-note] > .text{word-wrap:anywhere}';
      const authored = '.card .text:focus{overflow-wrap:break-word}';
      const native = '.text.text:focus{overflow-wrap:break-word}'; // ownership prefix adds strength, not a required parent
      const session = createGssCompilerSession({ projectRoot: '/p', atomizationFallback: 'error' });
      const update = session.replaceStylesheet({ id: '/p/Wrap.gss', source: aliasLast ? authored + alias : alias + authored });
      assert.deepEqual(update.diagnostics, []);
      assert.equal(update.module.compilationMode, 'atomic');
      const { card } = update.module.scopeSchema.exports;
      for (const [css, parent, text] of [[aliasLast ? native + alias : alias + native, 'card', 'text'],
        [session.finalize().css, card.selfClassName, card.targets.text.selfClassName]]) {
        await page.setContent(`<style>${css}</style><section class="${parent}"><span tabindex="0" class="${text}">longword</span></section>`);
        const readings = await page.locator('span').evaluate(el => {
          const read = () => el.ownerDocument.defaultView.getComputedStyle(el).overflowWrap;
          const values = [read()]; el.parentElement.setAttribute('data-note', ''); values.push(read());
          el.focus(); values.push(read()); el.parentElement.removeAttribute('data-note'); values.push(read()); return values;
        });
        assert.deepEqual(readings, ['normal', 'anywhere', aliasLast ? 'anywhere' : 'break-word', 'break-word']);
      }
    }
  } finally { await page.close(); }
}

async function checkStructuralFunctionComposition(browser) {
  const page = await browser.newPage();
  try {
    for (const fn of ['is', 'not', 'where']) for (const redLast of [false, true]) {
      const args = fn === 'not' ? '[q],[y][z]' : '[x],[y][z]';
      const red = `.p:${fn}(${args}) > .b{color:red}`;
      const blue = `.q${fn === 'where' ? '[v]' : '[v][w][u]'}{color:blue}`;
      const source = '.b{color:green}' + (redLast ? blue + red : red + blue);
      const session = createGssCompilerSession({ projectRoot: '/p' });
      const update = session.replaceStylesheet({ id: '/p/F.gss', source });
      assert.deepEqual(update.diagnostics, []);
      const { p, q } = update.module.scopeSchema.exports;
      for (const [css, parent, classes] of [[source, 'p', 'b q'],
        [session.finalize().css, p.selfClassName, `${p.targets.b.selfClassName} ${q.selfClassName}`]]) {
        await page.setContent(`<style>${css}</style><section class="${parent}" x><span class="${classes}" v w u>B</span></section>`);
        const readings = await page.locator('span').evaluate(el => {
          const color = () => el.ownerDocument.defaultView.getComputedStyle(el).color;
          const values = [color()]; el.removeAttribute('v'); values.push(color());
          el.parentElement.removeAttribute('x'); el.parentElement.setAttribute('q', ''); values.push(color());
          el.setAttribute('v', ''); values.push(color()); return values;
        });
        assert.deepEqual(readings, [redLast ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)', 'rgb(255, 0, 0)',
          'rgb(0, 128, 0)', 'rgb(0, 0, 255)'], `${fn}, redLast=${redLast}`);
      }
    }
  } finally { await page.close(); }
}

async function checkEquivalentStructuralFunctions(browser) {
  const page = await browser.newPage();
  try {
    const red = 'rgb(255, 0, 0)', blue = 'rgb(0, 0, 255)', green = 'rgb(0, 128, 0)';
    for (const fn of [':is([x],[y][z])', ':not([q],[y][z])', ':where([x],[y][z])', ':is([x])']) {
      for (const reverse of [false, true]) {
        const rules = [`.p${fn}${fn}:focus > .b{color:red}`, `.p${fn}:focus:focus > .b{color:blue}`];
        const source = (reverse ? rules.reverse() : rules).join('');
        const session = createGssCompilerSession({ projectRoot: '/p' });
        const result = session.replaceStylesheet({ id: '/p/F.gss', source });
        assert.deepEqual(result.diagnostics, []);
        const { p } = result.module.scopeSchema.exports;
        const expected = fn.startsWith(':where') ? blue : fn === ':is([x])' ? (reverse ? red : blue) : red;
        for (const [css, parent, child] of [[source, 'p', 'b'], [session.finalize().css, p.selfClassName, p.targets.b.selfClassName]]) {
          await page.setContent(`<style>span{color:green}${css}</style><div tabindex="0" x class="${parent}"><span class="${child}">B</span></div>`);
          const color = () => page.locator('span').evaluate(el => el.ownerDocument.defaultView.getComputedStyle(el).color);
          assert.equal(await color(), green);
          await page.locator('[tabindex]').focus();
          assert.equal(await color(), expected, `${fn}, reverse=${reverse}`);
        }
      }
    }
  } finally { await page.close(); }
}

async function checkFunctionalCompositionOrder(browser) {
  const page = await browser.newPage();
  try {
    for (const fn of ['is', 'where', 'not']) for (const redLast of [true, false]) {
      // Only [x] matches :is, but the unmatched [z][w] branch supplies its specificity.
      const argument = fn === 'not' ? '[z],[z][w]' : '[x],[z][w]';
      const red = `.a:${fn}(${argument}){color:red}`, blue = '.b[x][y]{color:blue}';
      const source = '.b[x]{color:green}' + (redLast ? blue + red : red + blue);
      const session = createGssCompilerSession({ projectRoot: '/p' });
      const update = session.replaceStylesheet({ id: '/p/T.gss', source });
      assert.deepEqual(update.diagnostics, []);
      assert.equal(update.module.compilationMode, 'atomic');
      const { a, b } = update.module.scopeSchema.exports;
      const expected = fn !== 'where' && redLast ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)';
      for (const [css, classes] of [[source, 'a b'], [session.finalize().css, `${a.selfClassName} ${b.selfClassName}`]]) {
        await page.setContent(`<style>${css}</style><button x y class="${classes}">both</button>`);
        assert.equal(await page.locator('button').evaluate(node => node.ownerDocument.defaultView.getComputedStyle(node).color), expected, `${fn}, red last: ${redLast}`);
      }
    }
  } finally { await page.close(); }
}

async function checkQuotedGlobal(browser) {
  const page = await browser.newPage();
  try {
    const red = '.b:is([data-label=":global("]){color:red}', blue = '.b:focus{color:blue}';
    for (const redLast of [false, true]) {
      const source = redLast ? blue + red : red + blue;
      const session = createGssCompilerSession({ projectRoot: '/p' });
      const update = session.replaceStylesheet({ id: '/p/Literal.gss', source });
      assert.deepEqual(update.diagnostics, []);
      for (const [css, classes] of [[source, 'b'], [session.finalize().css, update.module.scopeSchema.exports.b.selfClassName]]) {
        await page.setContent(`<style>button{color:green}${css}</style><button class="${classes}"></button>`);
        const readings = await page.locator('button').evaluate(el => {
          const color = () => el.ownerDocument.defaultView.getComputedStyle(el).color;
          const values = [color()]; el.dataset.label = ':global('; values.push(color());
          el.focus(); values.push(color()); el.removeAttribute('data-label'); values.push(color()); return values;
        });
        assert.deepEqual(readings, ['rgb(0, 128, 0)', 'rgb(255, 0, 0)', redLast ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)', 'rgb(0, 0, 255)']);
      }
    }
  } finally { await page.close(); }
}

async function checkFunctionalAttributes(browser) {
  const source = '.button{color:black}.button:is([data-mode^="warn" i],.flag):not(:where([data-tags~="muted" i])){color:red}';
  const session = createGssCompilerSession({ projectRoot: '/p' });
  const update = session.replaceStylesheet({ id: '/p/F.gss', source });
  assert.deepEqual(update.diagnostics, []);
  assert.equal(update.module.compilationMode, 'atomic');
  const { button, flag } = update.module.scopeSchema.exports;
  for (const [css, classes, marker] of [[source, 'button', 'flag'], [session.finalize().css, button.selfClassName, flag.selfClassName]]) {
    const page = await browser.newPage();
    try {
      await page.setContent(`<style>${css}</style><button class="${classes}">A</button>`);
      const readings = await page.locator('button').evaluate((node, local) => {
        const color = () => node.ownerDocument.defaultView.getComputedStyle(node).color;
        const values = [color()];
        node.dataset.mode = 'WARNING'; values.push(color());
        node.dataset.tags = 'live MUTED'; values.push(color());
        delete node.dataset.mode; delete node.dataset.tags; values.push(color());
        node.classList.add(local); values.push(color());
        return values;
      }, marker);
      assert.deepEqual(readings, ['rgb(0, 0, 0)', 'rgb(255, 0, 0)', 'rgb(0, 0, 0)', 'rgb(0, 0, 0)', 'rgb(255, 0, 0)']);
    } finally { await page.close(); }
  }
}

async function checkOwnedCurrentConditions(browser) {
  for (const property of ['color', 'background-color']) for (const deepLast of [true, false]) {
    const pressed = `.button[aria-pressed=true]{${property}:blue}`;
    const deep = `.panel .button{${property}:green}`;
    const source = `.button{padding-top:7px;${property}:black}.button:hover{${property}:red}` +
      (deepLast ? pressed + deep : deep + pressed) + `.panel .button[data-tone^="LOUD" i]:focus{${property}:purple}`;
    const session = createGssCompilerSession({ projectRoot: '/p' });
    const update = session.replaceStylesheet({ id: '/p/B.gss', source });
    assert.deepEqual(update.diagnostics, []);
    assert.equal(update.module.compilationMode, 'atomic');
    const { button, panel } = update.module.scopeSchema.exports;
    const page = await browser.newPage();
    try {
      // Neither button has a panel ancestor. Only the explicit deep scope gets panel declarations.
      await page.setContent(`<style>${session.finalize().css}</style><button>A</button><button>B</button>`);
      const [shallow, nested] = await page.locator('button').all();
      for (const [el, scope] of [[shallow, button], [nested, panel.targets.button]]) {
        await el.evaluate((node, className) => { node.className = className; }, scope.selfClassName);
        const read = prop => el.evaluate((node, name) => node.ownerDocument.defaultView.getComputedStyle(node).getPropertyValue(name), prop);
        assert.equal(await read('padding-top'), '7px');
        assert.equal(await read(property), el === shallow ? 'rgb(0, 0, 0)' : 'rgb(0, 128, 0)');
        await el.hover(); await el.evaluate(node => node.setAttribute('aria-pressed', 'true'));
        assert.equal(await read(property), el === nested && deepLast ? 'rgb(0, 128, 0)' : 'rgb(0, 0, 255)');
        await el.focus(); await el.evaluate(node => node.setAttribute('data-tone', 'louder'));
        assert.equal(await read(property), el === nested ? 'rgb(128, 0, 128)' : 'rgb(0, 0, 255)');
      }
    } finally { await page.close(); }
  }
}
