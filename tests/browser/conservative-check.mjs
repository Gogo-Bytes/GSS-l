/* global getComputedStyle */
import assert from 'node:assert/strict';
import { PNG } from 'pngjs';
import { createGssCompilerSession } from '@gss-l/compiler';
import { conservativeFixtureOutput } from '../../compiler/test/conservative-output.mjs';

function fixtureOutputs(source) {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const result = session.replaceStylesheet({ id: '/project/Case.gss', source });
  assert.equal(result.module?.compilationMode, 'atomic');
  return [conservativeFixtureOutput(source), { css: session.finalize().css, classes(path) {
    let node = result.module.scopeSchema.exports[path[0]];
    for (const step of path.slice(1)) node = node.targets[step];
    return node.selfClassName;
  } }];
}

async function compareFixture(page, outputs, render, expected, label) {
  let reference;
  for (const output of outputs) {
    await page.setContent(`<style>${output.css}</style>${render(output.classes)}`);
    const actual = await page.locator('#target').evaluate((node, properties) => {
      const style = getComputedStyle(node);
      return Object.fromEntries(properties.map(key => [key, style[key]]));
    }, Object.keys(expected));
    assert.deepEqual(actual, expected, label);
    const image = PNG.sync.read(await page.locator('section').screenshot());
    if (reference) {
      assert.equal(image.width, reference.width); assert.equal(image.height, reference.height);
      assert.ok(image.data.equals(reference.data), `${label} pixels`);
    }
    reference = image;
  }
}

export async function checkConservativeOutput(browser) {
  const page = await browser.newPage();
  const results = [];
  const red = 'rgb(255, 0, 0)', blue = 'rgb(0, 0, 255)', green = 'rgb(0, 128, 0)';
  const shallow = ['title'], card = ['layout', 'card'], deep = [...card, 'title'];
  try {
    for (const [relation, rule] of [['child', '.layout .card > .title'], ['presence', '.layout .card[data-ready] .title']]) {
      const source = `.title{color:red}${rule}{color:blue}`;
      const outputs = fixtureOutputs(source);
      for (const [name, path, wrap, ready, compete, expected] of [
        ['shallow', shallow, false, true, false, red], ['deep', deep, false, true, false, blue],
        ['wrapped', deep, true, true, false, relation === 'child' ? red : blue],
        ['absent', deep, false, false, false, relation === 'child' ? blue : red],
        ['specificity', deep, false, true, true, blue], ['shallow competitor', shallow, false, true, true, green]
      ]) {
        await compareFixture(page, outputs, classes => {
          const target = `<div id="target" class="control ${classes(path)}">title</div>`;
          return `<style>${compete ? '.theme .control{color:green}' : ''}</style>
            <section class="theme ${classes(card)}" ${ready ? 'data-ready' : ''}>${wrap ? `<div>${target}</div>` : target}</section>`;
        }, { color: expected }, `${relation}: ${name}`);
        results.push({ relation, name, expected });
      }
    }
    for (const [name, source, path, dir, expected] of [
      ['ownership deep', '.card .title{color:blue}.title{color:red}', ['card','title'], 'ltr', { color: blue }],
      ['ownership shallow', '.card .title{color:blue}.title{color:red}', shallow, 'ltr', { color: red }],
      ['box', '.x{margin:1px 2px;margin-left:3px}', ['x'], 'ltr', { marginTop:'1px', marginRight:'2px', marginLeft:'3px' }],
      ['fallback', '.x{margin:1px;margin:unsupported;margin-left:3px}', ['x'], 'ltr', { marginTop:'1px', marginLeft:'3px' }],
      ['alias ltr', '.x{margin-left:2px;margin-inline-start:1px}', ['x'], 'ltr', { marginLeft:'2px', marginRight:'0px' }],
      ['alias rtl', '.x{margin-left:2px;margin-inline-start:1px}', ['x'], 'rtl', { marginLeft:'2px', marginRight:'1px' }]
    ]) {
      await compareFixture(page, fixtureOutputs(source), classes =>
        `<section dir="${dir}" style="display:flow-root"><div id="target" class="${classes(path)}">title</div></section>`, expected, name);
      results.push({ relation: 'pure ownership', name, expected });
    }
    return results;
  } finally { await page.close(); }
}
