import assert from 'node:assert/strict';
import { createGssCompilerSession } from '@gss-l/compiler';

export async function checkCurrentConditions(browser) {
  await checkConditionedPrefix(browser);
  await checkExclusiveWitnesses(browser);
  await checkStructuralEdgePositions(browser);
  await checkChildConditions(browser);
  await checkStructuralShorthandTie(browser);
  await checkStructuralFunctionComposition(browser);
  await checkEquivalentStructuralFunctions(browser);
  await checkFunctionalCompositionOrder(browser);
  await checkFunctionalAttributes(browser);
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
