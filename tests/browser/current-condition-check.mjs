import assert from 'node:assert/strict';
import { createGssCompilerSession } from '@gss-l/compiler';

export async function checkCurrentConditions(browser) {
  const base = '.a,.other {color:black}';
  const focus = '.a:hover:focus {color:blue}';
  const on = '.a[data-on]:hover {color:red}';
  // A weaker predicate for only one competitor must not change the order of the tie.
  const weaker = '.a:focus {color:green}';
  for (const reverse of [false, true]) {
    const source = base + weaker + (reverse ? on + focus : focus + on);
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
