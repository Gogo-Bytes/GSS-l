/* global getComputedStyle */
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { createGssCompilerSession } from '@gss-l/compiler';
import { conservativeFixtureOutput } from '../../compiler/test/conservative-output.mjs';

export async function checkConservativeOutput(browser) {
  const page = await browser.newPage();
  const results = [];
  const red = 'rgb(255, 0, 0)', blue = 'rgb(0, 0, 255)', green = 'rgb(0, 128, 0)';
  const shallow = ['title'], card = ['layout', 'card'], deep = [...card, 'title'];
  try {
    for (const [relation, rule] of [['child', '.layout .card > .title'], ['presence', '.layout .card[data-ready] .title']]) {
      const source = `.title{color:red}${rule}{color:blue}`;
      const session = createGssCompilerSession({ projectRoot: '/project' });
      const result = session.replaceStylesheet({ id: '/project/Case.gss', source });
      assert.equal(result.module?.compilationMode, 'atomic');
      const outputs = [conservativeFixtureOutput(source), { css: session.finalize().css, classes(path) {
        let node = result.module.scopeSchema.exports[path[0]];
        for (const step of path.slice(1)) node = node.targets[step];
        return node.selfClassName;
      } }];
      for (const [name, path, wrap, ready, compete, expected] of [
        ['shallow', shallow, false, true, false, red], ['deep', deep, false, true, false, blue],
        ['wrapped', deep, true, true, false, relation === 'child' ? red : blue],
        ['absent', deep, false, false, false, relation === 'child' ? blue : red],
        ['specificity', deep, false, true, true, blue], ['shallow competitor', shallow, false, true, true, green]
      ]) {
        let reference;
        for (const output of outputs) {
          const target = `<div id="target" class="control ${output.classes(path)}">title</div>`;
          await page.setContent(`<style>${output.css} ${compete ? '.theme .control{color:green}' : ''}</style>
            <section class="theme ${output.classes(card)}" ${ready ? 'data-ready' : ''}>${wrap ? `<div>${target}</div>` : target}</section>`);
          const el = page.locator('#target');
          assert.equal(await el.evaluate(node => getComputedStyle(node).color), expected, `${relation}: ${name}`);
          const image = PNG.sync.read(await el.screenshot());
          if (reference) {
            assert.equal(image.width, reference.width); assert.equal(image.height, reference.height);
            assert.ok(image.data.equals(reference.data), `${relation}: ${name} pixels`);
          }
          reference = image;
        }
        results.push({ relation, name, expected });
      }
    }
    return results;
  } finally { await page.close(); }
}
