import { describe, expect, it } from 'vitest';
import { bindDescendantConditions, bindStructuralRelations } from '../src/domain/selector-bindings.js';
import { planDescendantConditions } from '../src/domain/plan-descendant-conditions.js';
import { planStructuralRelations } from '../src/domain/plan-structural-relations.js';
import { collectOrderOccurrences } from '../src/domain/order-occurrences.js';
import { groupAdjacentDeclarations } from '../src/domain/validate-declarations.js';
import { parseStylesheet } from '../src/infrastructure/postcss-stylesheet-parser.js';

function rules(source: string) {
  const parsed = parseStylesheet('/project/Case.gss', source);
  expect(parsed.diagnostics).toEqual([]);
  return groupAdjacentDeclarations(parsed.rules);
}

describe('structural binding before optimization', () => {
  it.each(['>', '+', '~'])('keeps ownership prefix/tail distinct from the %s witness', relation => {
    const input = rules(`.group .source:hover ${relation} .target .leaf { color:red }`);
    const [binding] = bindStructuralRelations(input);
    expect(binding).toMatchObject({ targetPath: ['group', 'source', 'target', 'leaf'],
      sourcePath: ['group', 'source'], sourceIndex: 1, specificity: 5 });
    expect(binding!.rule).toBe(input[0]);
    expect(binding!.rule.relations).toEqual(['descendant', { '>': 'child', '+': 'adjacent', '~': 'general-sibling' }[relation], 'descendant']);
  });

  it('cannot reinterpret a pure ownership path as a runtime relation', () => {
    expect(() => bindStructuralRelations(rules('.root .item { color:red }')))
      .toThrow('Structural binding requires a runtime relation.');
  });

  it('lets ordering see every authored competitor after partial coverage', () => {
    const input = rules('.root > .item { color:red; width:1px } .root > .item { color:blue }');
    const bindings = bindStructuralRelations(input);
    const before = JSON.stringify(bindings);
    for (const binding of bindings) {
      Object.freeze(binding.rule.declarations);
      Object.freeze(binding.rule);
      Object.freeze(binding);
    }
    Object.freeze(bindings);
    const planned = planStructuralRelations(bindings, [], []);
    expect(planned.ambiguity).toBeUndefined();
    expect(planned.instances.map(instance => instance.declarations.map(declaration => declaration.property)))
      .toEqual([['width'], ['color']]);
    const { occurrences } = collectOrderOccurrences(input, planned.instances);
    expect(occurrences.map(({ declaration, index }) => [declaration.property, declaration.value, index]))
      .toEqual([['color', 'red', 0], ['width', '1px', 1], ['color', 'blue', 0]]);
    expect(JSON.stringify(bindings)).toBe(before);
  });

  it('preserves declaration groups and binding facts even when all their declarations lose', () => {
    const input = rules('.root > .item { display:block; display:flex } .root > .item { display:inline; display:flex }');
    const bindings = bindStructuralRelations(input);
    const before = JSON.stringify(bindings);
    const planned = planStructuralRelations(bindings, [], []);
    expect(planned.instances[0]!.declarations).toEqual([]);
    const { occurrences } = collectOrderOccurrences(input, planned.instances);
    expect(occurrences.map(({ declaration }) => declaration.fallbacks?.[0]?.value)).toEqual(['block', 'inline']);
    expect(new Set(occurrences.map(occurrence => occurrence.key)).size).toBe(2);
    expect(JSON.stringify(bindings)).toBe(before);
  });

  it('does not confuse successful binding with a permitted coactive conflict', () => {
    const bindings = bindStructuralRelations(rules('.root:hover > .item { color:red } .root:focus > .item { color:blue }'));
    const before = JSON.stringify(bindings);
    expect(bindings).toHaveLength(2);
    expect(planStructuralRelations(bindings, [], []).ambiguity).toContain('ambiguous color');
    expect(JSON.stringify(bindings)).toBe(before);
  });

  it('preserves descendant ranks when projecting a stronger child relation', () => {
    const input = rules('.root:hover .item { color:red } .root:hover > .item { color:red }');
    const descendant = planDescendantConditions(bindDescendantConditions([input[0]!], [['root', 'item']])).instances;
    const before = JSON.stringify(descendant);
    Object.freeze(descendant[0]);
    const planned = planStructuralRelations(bindStructuralRelations([input[1]!]), descendant, []);
    expect(planned.ambiguity).toBeUndefined();
    expect(planned.descendants[0]!.relationRank).toBe(1);
    expect(planned.instances[0]!.relationRank).toBe(2);
    expect(JSON.stringify(descendant)).toBe(before);
  });
});
