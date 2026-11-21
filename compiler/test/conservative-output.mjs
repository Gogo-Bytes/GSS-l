// Test-only emitter for the fixed, already admitted browser fixtures. Not an admission policy.
import assert from 'node:assert/strict';
import { parseStylesheet } from '../dist/infrastructure/postcss-stylesheet-parser.js';
import { groupAdjacentDeclarations } from '../dist/domain/validate-declarations.js';
import { getOwnershipPath } from '../dist/domain/ownership-path.js';
import { bindDescendantConditions, bindStructuralRelations } from '../dist/domain/selector-bindings.js';
import { collectOrderOccurrences } from '../dist/domain/order-occurrences.js';
import { planFixedModuleOrder } from '../dist/domain/fixed-module-ranks.js';
import { renderAttributeCondition } from '../dist/application/selector-rendering.js';

export function conservativeFixtureOutput(source) {
  const parsed = parseStylesheet('/project/Case.gss', source);
  assert.deepEqual(parsed.diagnostics, []);
  assert.equal(parsed.resources.length, 0);
  const rules = groupAdjacentDeclarations(parsed.rules);
  const paths = rules.flatMap(rule => {
    const path = getOwnershipPath(rule.nodes);
    return path.map((_, i) => path.slice(0, i + 1));
  });
  const childRules = rules.filter(rule => rule.relations.includes('child'));
  for (const rule of rules) {
    assert.ok(!rule.layer && !rule.conditions.length && !rule.externalTarget && !rule.externalCondition);
    assert.ok(rule.nodes.every(n => !n.states.length && !n.hasConditions.length && !n.pseudoElement));
    assert.ok(rule.relations.every(r => r === 'descendant' || r === 'child'));
    const attrs = rule.nodes.flatMap(n => n.attributes);
    if (childRules.includes(rule)) {
      assert.equal(rule.relations.indexOf('child'), rule.relations.length - 1);
      assert.equal(attrs.length, 0);
    } else if (attrs.length) {
      assert.equal(attrs.length, 1);
      assert.equal(attrs[0].operator, null);
      assert.equal(rule.nodes.at(-1).attributes.length, 0);
    }
  }
  const bound = bindDescendantConditions(rules.filter(r => !childRules.includes(r)), paths);
  const bindings = [...bound.flatMap(t => t.bindings), ...bindStructuralRelations(childRules)];
  const instances = bindings.map(b => ({ ...b, declarations: b.rule.declarations, relationRank: 0 }));
  const order = planFixedModuleOrder(rules, instances);
  const members = new Map(paths.map(path => [JSON.stringify(path), []]));
  function member(path, marker) { members.get(JSON.stringify(path)).push(marker); return marker; }
  const rows = collectOrderOccurrences(rules, instances).occurrences.map(({ instance: b, declaration: d }, i) => {
    const target = member(b.targetPath, `t${i}`);
    let selector = `.${target}`;
    if (b.sourcePath) {
      const sourceMarker = member(b.sourcePath, `s${i}`);
      selector = childRules.includes(b.rule)
        ? `${`.${sourceMarker}`.repeat(b.sourcePath.length)} > .${target}`
        : `.${sourceMarker}${renderAttributeCondition(b.rule.nodes[b.sourceIndex].attributes[0])} ${`.${target}`.repeat(b.rule.nodes.length - 1)}`;
    }
    const block = [...(d.fallbacks ?? []), d].map(v => `${d.property}:${v.value}${d.important ? '!important' : ''};`).join('');
    return { css: `${selector}{${block}}`, slot: order.get(d, b)?.orderSlot ?? 0 };
  });
  return { css: rows.sort((a, b) => a.slot - b.slot).map(r => r.css).join('\n'),
    classes: path => members.get(JSON.stringify(path)).join(' ') };
}
