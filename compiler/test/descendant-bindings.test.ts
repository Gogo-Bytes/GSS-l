import { describe, expect, it } from 'vitest';
import { bindDescendantConditions } from '../src/domain/selector-bindings.js';
import { planDescendantConditions } from '../src/domain/plan-descendant-conditions.js';
import { groupAdjacentDeclarations } from '../src/domain/validate-declarations.js';
import { parseStylesheet } from '../src/infrastructure/postcss-stylesheet-parser.js';

function bind(source: string, paths: readonly (readonly string[])[]) {
  const parsed = parseStylesheet('/project/Case.gss', source);
  expect(parsed.diagnostics).toEqual([]);
  return bindDescendantConditions(groupAdjacentDeclarations(parsed.rules), paths);
}

describe('descendant binding before optimization', () => {
  it('binds ownership and the condition source without treating extra scopes as DOM witnesses', () => {
    const targets = bind('.root:hover .item { color:red }', [['root', 'middle', 'item'], ['other', 'item']]);
    expect(targets[0]!.bindings).toHaveLength(1);
    expect(targets[0]!.bindings[0]).toMatchObject({
      targetPath: ['root', 'middle', 'item'], sourcePath: ['root'], sourceIndex: 0, specificity: 3,
      witnesses: [
        { nodeIndex: 0, path: ['root'], incoming: null, classWeight: 1 },
        { nodeIndex: 1, path: ['root', 'middle', 'item'], incoming: 'descendant', classWeight: 1 }
      ]
    });
    expect(targets[1]!.bindings).toEqual([]);
  });

  it('retains distinct condition witnesses but does not multiply unconditional embeddings', () => {
    const paths = [['root', 'root', 'item']];
    expect(bind('.root:hover .item { color:red }', paths)[0]!.bindings.map(binding => binding.witnesses[0]!.path))
      .toEqual([['root'], ['root', 'root']]);
    expect(bind('.root .item { color:red }', paths)[0]!.bindings).toHaveLength(1);
  });

  it('keeps full declarations when planning removes a partially shadowed declaration', () => {
    const targets = bind('.item { color:red; width:1px } .item { color:blue }', [['item']]);
    const before = JSON.stringify(targets);
    for (const target of targets) {
      for (const binding of target.bindings) {
        Object.freeze(binding.rule.declarations);
        Object.freeze(binding.rule);
        Object.freeze(binding);
      }
      Object.freeze(target.bindings);
      Object.freeze(target);
    }
    Object.freeze(targets);
    const planned = planDescendantConditions(targets);
    expect(planned.instances.map(instance => instance.declarations.map(declaration => declaration.property)))
      .toEqual([['width'], ['color']]);
    expect(planned.candidates[0]!.declarations.map(declaration => declaration.property)).toEqual(['color', 'width']);
    expect(JSON.stringify(targets)).toBe(before);
  });

  it('separates successful binding from a rejected coactive-color policy', () => {
    const targets = bind('.item:hover { color:red } .item:focus { color:blue }', [['item']]);
    const before = JSON.stringify(targets);
    expect(targets[0]!.bindings).toHaveLength(2);
    const planned = planDescendantConditions(targets);
    expect(planned.ambiguity).toContain('ambiguous color');
    expect(planned.instances).toEqual([]);
    expect(JSON.stringify(targets)).toBe(before);
  });

  it('retains complete fallback sequences and source spans even for shadowed bindings', () => {
    const targets = bind('.item { display:block; display:flex } .item { display:inline; display:flex }', [['item']]);
    const first = targets[0]!.bindings[0]!.rule.declarations[0]!;
    const before = JSON.stringify(targets);
    expect(first.fallbacks?.[0]).toMatchObject({ value: 'block', source: { sourceId: '/project/Case.gss' } });
    const planned = planDescendantConditions(targets);
    expect(planned.instances).toHaveLength(1);
    expect(planned.instances[0]!.declarations[0]!.fallbacks?.[0]?.value).toBe('inline');
    expect(JSON.stringify(targets)).toBe(before);
  });

  it('preserves selector-list branch identity and shared authored declarations', () => {
    const targets = bind('.a, .b { color:red }', [['a'], ['b'], ['a']]);
    expect(targets).toHaveLength(2);
    const a = targets[0]!.bindings[0]!;
    const b = targets[1]!.bindings[0]!;
    expect(a.rule).not.toBe(b.rule);
    expect(a.rule.declarations).toBe(b.rule.declarations);
    expect(a.targetPath).toEqual(['a']);
    expect(b.targetPath).toEqual(['b']);
  });
});
