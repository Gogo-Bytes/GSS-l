import assert from 'node:assert/strict';
import { createGssCompilerSession } from '@gss-l/compiler';

export async function checkCurrentConditions(browser) {
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
