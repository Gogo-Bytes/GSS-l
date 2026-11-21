// Design experiment, not a compiler fallback. Only unlayered color rules with simple local tests.
import assert from 'node:assert/strict';
import { log } from 'node:console';
import { chromium } from 'playwright';
import { createGssCompilerSession } from '@gss-l/compiler';
import { parseStylesheet } from '../../compiler/dist/infrastructure/postcss-stylesheet-parser.js';
import { renderAttributeCondition, renderRelationCombinator } from '../../compiler/dist/application/selector-rendering.js';

function fixtureOutput(source) {
  const { rules, diagnostics, resources } = parseStylesheet('/p/A.gss', source);
  assert.deepEqual([diagnostics, resources], [[], []]);
  const paths = new Map();
  for (const { nodes } of rules) {
    const path = [];
    for (const node of nodes) {
      path.push(node.name);
      if (!paths.has(path.join('.'))) paths.set(path.join('.'), { path: [...path], marker: `w${paths.size}` });
    }
  }
  const css = [];
  for (const rule of rules) {
    const rows = new Set();
    const { nodes, relations } = rule, last = nodes.length - 1;
    assert.ok(!rule.layer && !rule.conditions.length && !rule.externalCondition && !rule.externalTarget);
    assert.ok(nodes.every(n => !n.pseudoElement && !n.hasConditions.length && n.states.every(s => !s.includes('('))));
    const [d] = rule.declarations;
    assert.ok(rule.declarations.length === 1 && d.property === 'color' && !d.important);
    const structural = relations.findIndex(r => r !== 'descendant');
    const witnesses = nodes.flatMap((n, i) => i === last || n.states.length || n.attributes.length ||
      (structural >= 0 && i >= structural) ? [i] : []);
    for (const { path } of paths.values()) {
      if (structural >= 0 && (path.length !== nodes.length || nodes.some((n, i) => n.name !== path[i]))) continue;
      // Enumerate tiny fixtures only. Multiple embeddings can project onto the same witness tuple.
      function bind(i, start, positions) {
        if (i < nodes.length) {
          for (let j = start; j <= path.length - (nodes.length - i); j++) {
            if (nodes[i].name === path[j] && (i !== last || j === path.length - 1)) bind(i + 1, j + 1, [...positions, j]);
          }
          return;
        }
        let previous = -1;
        const selector = witnesses.map(index => {
          const marker = paths.get(path.slice(0, positions[index] + 1).join('.')).marker;
          const edge = previous < 0 ? '' : ` ${renderRelationCombinator(relations[index - 1])} `;
          const compound = `.${marker}`.repeat(index - previous) + nodes[index].attributes.map(renderAttributeCondition).join('') +
            nodes[index].states.map(state => `:${state}`).join('');
          previous = index;
          return edge + compound;
        }).join('');
        rows.add(`${selector}{color:${d.value}}`);
      }
      bind(0, 0, []);
    }
    // Deduplicate embeddings of this rule, never repeated declarations across source positions.
    css.push(...rows);
  }
  return { css: css.join('\n'), marker: scope => paths.get(scope)?.marker ?? '' };
}

const browser = await chromium.launch();
const page = await browser.newPage();
const colors = { red: 'rgb(255, 0, 0)', blue: 'rgb(0, 0, 255)', green: 'rgb(0, 128, 0)' };
let reads = 0;
const production = new Map();
async function run(name, source, native, cases, admission = 'GSS1101') {
  const baseline = fixtureOutput(source);
  const session = createGssCompilerSession({ projectRoot: '/p' });
  const update = session.replaceStylesheet({ id: '/p/A.gss', source });
  const status = update.committed ? 'atomic' : update.diagnostics[0]?.code;
  assert.equal(status, admission, name);
  production.set(name, status);
  const outputs = [['native', native, () => ''], ['baseline', baseline.css, baseline.marker]];
  if (update.committed) {
    assert.equal(update.module.compilationMode, 'atomic');
    outputs.push(['production', session.finalize().css, scope => {
      const [root, ...rest] = scope.split('.');
      let node = update.module.scopeSchema.exports[root];
      for (const part of rest) node = node?.targets[part];
      return node?.selfClassName ?? '';
    }]);
  }
  for (const [mode, css, marker] of outputs) for (const [html, focus, expected, gssWinner] of cases) {
    const marked = html.replace(/s="([\w.]+)"/g, (_, scope) => `data-s="${scope}" class="${marker(scope)}"`);
    await page.setContent(`<style>button{color:red}${css}</style>${marked}`);
    if (focus) await page.locator('button').focus();
    const actual = await page.locator('button').evaluate(el => el.ownerDocument.defaultView.getComputedStyle(el).color);
    assert.equal(actual, colors[mode === 'production' && gssWinner ? gssWinner : expected], `${name}: ${mode}: ${html}`);
    reads++;
  }
}
try {
  const target = '<button s="p.b"></button>', shallow = '<button s="b"></button>';
  const p = '<i s="p" x y></i>', gap = '<i></i>';
  for (const [edge, withGap] of [['>', 'red'], [' ', 'blue'], ['+', 'red'], ['~', 'blue']]) {
    const tree = (attrs, child, separated = false) => edge === '>' || edge === ' '
      ? `<div s="p" ${attrs}>${separated ? `<div x y>${child}</div>` : child}</div>`
      : `<i s="p" ${attrs}></i>${separated ? gap : ''}${child}`;
    await run(`endpoints ${JSON.stringify(edge)}`, `.b{color:red}.p[x][y] ${edge} .b:focus{color:blue}`,
      `[data-s=p][x][y] ${edge} [data-s="p.b"]:focus{color:blue}`, [
        [tree('x y', target), true, 'blue'], [tree('x', target.replace('button ', 'button y ')), true, 'red'],
        [tree('x y', target), false, 'red'], [tree('x y', shallow), true, 'red'], [tree('x y', target, true), true, withGap]
      ]);
  }
  await run('existing child endpoints', '.p[x] > .b[y]:focus{color:blue}',
    '[data-s=p][x] > [data-s="p.b"][y]:focus{color:blue}', [
      ['<div s="p" x><button s="p.b" y></button></div>', true, 'blue'],
      ['<div s="p" y><button s="p.b" x></button></div>', true, 'red']
    ], 'atomic');
  await run('competing swapped endpoints', '.p[x] > .b[y]{color:blue}.p[y] > .b[x]{color:green}',
    '[data-s=p][x] > [data-s="p.b"][y]{color:blue}[data-s=p][y] > [data-s="p.b"][x]{color:green}', [
      ['<div s="p" x><button s="p.b" y></button></div>', false, 'blue'],
      ['<div s="p" x y><button s="p.b" x y></button></div>', false, 'green']
    ], 'GSS1205');
  await run('ownership prefix + middle witness', '.layout .p[x] > .m[z] + .b:focus{color:blue}',
    '[data-s="layout.p"][x] > [data-s="layout.p.m"][z] + [data-s="layout.p.m.b"]:focus{color:blue}',
    [['<div s="layout.p" x><i s="layout.p.m" z></i><button s="layout.p.m.b"></button></div>', true, 'blue'],
      ['<div s="layout.p" x z><i s="layout.p.m"></i><button s="layout.p.m.b"></button></div>', true, 'red']]);
  await run('split siblings', '.p[x][y] ~ .b:focus{color:blue}', '[data-s=p][x][y] ~ [data-s="p.b"]:focus{color:blue}',
    [[`<i s="p" x></i><i s="p" y></i>${target}`, true, 'red'], [p + target, true, 'blue']]);
  await run('repeated ownership name', '.p .p .b{color:green}.p[x] .b{color:blue}',
    '[data-s="p.p.b"][data-s="p.p.b"][data-s="p.p.b"]{color:green}:is([data-s=p],[data-s="p.p"])[x] [data-s="p.p.b"]{color:blue}',
    [['<button s="p.p.b"></button>', false, 'green'],
      ['<div s="p" x><button s="p.p.b"></button></div>', false, 'blue'],
      ['<div s="p.p" x><button s="p.p.b"></button></div>', false, 'blue']], 'atomic');
  for (const reverse of [false, true]) {
    const rules = ['.p[x] ~ .b:focus{color:green}', '.p[y] ~ .b:focus{color:blue}'];
    const ref = ['[data-s=p][x] ~ [data-s="p.b"]:focus{color:green}', '[data-s=p][y] ~ [data-s="p.b"]:focus{color:blue}'];
    await run(`two independent witnesses reverse=${reverse}`, (reverse ? rules.reverse() : rules).join(''),
      (reverse ? ref.reverse() : ref).join(''), [[`<i s="p" x></i><i s="p" y></i>${target}`, true, reverse ? 'green' : 'blue']]);
    const pairs = ['.p + .b{color:green}', '.p ~ .b{color:blue}'];
    const native = ['[data-s=p] + [data-s="p.b"]{color:green}', '[data-s=p] ~ [data-s="p.b"]{color:blue}'];
    await run(`ADR-0013 order control reverse=${reverse}`, (reverse ? pairs.reverse() : pairs).join(''),
      (reverse ? native.reverse() : native).join(''), [[p + target, false, reverse ? 'green' : 'blue', 'green'], [p + gap + target, false, 'blue']], 'atomic');
  }
  log(`Chromium ${browser.version()}: ${reads} computed colors; current compiler:`, Object.fromEntries(production));
} finally { await browser.close(); }
