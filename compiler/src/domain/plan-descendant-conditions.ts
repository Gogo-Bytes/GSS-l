import { effectsOfProperty } from './property-effects.js';
import { boundPredicates as predicate, exclusiveWitnesses, type BoundDescendantTarget, type ConditionBinding, type DescendantRule } from './selector-bindings.js';
import { isStructuralPseudoState } from './pseudo-state-capabilities.js';

export type DescendantInstance<R extends DescendantRule> = ConditionBinding<R> & {
  relationRank: number;
  declarations: R['declarations'];
};

function sameNode<R extends DescendantRule>(a: DescendantInstance<R>, b: DescendantInstance<R>) {
  return JSON.stringify(a.sourcePath) === JSON.stringify(b.sourcePath);
}
function implies<R extends DescendantRule>(a: DescendantInstance<R>, b: DescendantInstance<R>) {
  const required = predicate(b);
  return required.length === 0 || (sameNode(a, b) && required.every((part) => predicate(a).includes(part)));
}

/** Distinct local conditions survive; only other subject kinds require the legacy conflict guard. */
export function planDescendantConditions<R extends DescendantRule>(
  targets: readonly BoundDescendantTarget<R>[],
  canUseNativeCascade?: (target: readonly string[], effect: string) => boolean
): { instances: DescendantInstance<R>[]; candidates: DescendantInstance<R>[]; ambiguity?: string } {
  const allCandidates: DescendantInstance<R>[] = [];
  const instances: DescendantInstance<R>[] = [];
  for (const { targetPath, bindings } of targets) {
    const candidates: DescendantInstance<R>[] = bindings.map(binding => ({ ...binding,
      relationRank: predicate(binding).length, declarations: binding.rule.declarations }));
    allCandidates.push(...candidates);
    const groups = new Map<string, DescendantInstance<R>[]>();
    for (const candidate of candidates) {
      const key = JSON.stringify([candidate.rule.layer, candidate.rule.conditions, candidate.sourcePath, predicate(candidate)]);
      groups.set(key, [...groups.get(key) ?? [], candidate]);
    }
    const retained: DescendantInstance<R>[] = [];
    for (const group of groups.values()) {
      const winners = new Map<string, { instance: DescendantInstance<R>; index: number }>();
      for (const instance of group) {
        instance.declarations.forEach((declaration, index) => {
          for (const effect of effectsOfProperty(declaration.property)) {
            const current = winners.get(effect);
            if (!current || compare(instance, index, current.instance, current.index) > 0) winners.set(effect, { instance, index });
          }
        });
      }
      for (const instance of group) {
        const declarations = instance.declarations.filter((_, index) => [...winners.values()].some((winner) => winner.instance === instance && winner.index === index));
        if (declarations.length) retained.push({ ...instance, declarations });
      }
    }
    instances.push(...retained);
    if (!canUseNativeCascade) continue;
    for (let i = 0; i < retained.length; i++) {
      const left = retained[i]!;
      for (const right of retained.slice(i + 1)) {
        if (left.rule.nodes.some((node) => node.states.some(isStructuralPseudoState)) ||
          right.rule.nodes.some((node) => node.states.some(isStructuralPseudoState))) continue;
        if (left.rule.layer !== right.rule.layer || JSON.stringify(left.rule.conditions) !== JSON.stringify(right.rule.conditions) ||
          left.specificity !== right.specificity || implies(left, right) || implies(right, left) || exclusiveWitnesses(left, right)) continue;
        for (const a of left.declarations) for (const b of right.declarations) {
          if (a.important !== b.important || (a.property === b.property && a.value === b.value)) continue;
          for (const effect of effectsOfProperty(a.property).filter((effect) => effectsOfProperty(b.property).includes(effect))) {
            if (canUseNativeCascade(targetPath, effect)) continue;
            const intersection = retained.some((candidate) => candidate.rule.layer === left.rule.layer &&
              JSON.stringify(candidate.rule.conditions) === JSON.stringify(left.rule.conditions) &&
              implies(candidate, left) && implies(candidate, right) &&
              (implies(left, candidate) || implies(right, candidate) || (candidate.witnesses.length === 1 &&
                predicate(candidate).every(test => predicate(left).includes(test) || predicate(right).includes(test)))) &&
              candidate.declarations.some((declaration) =>
                effectsOfProperty(declaration.property).includes(effect) &&
                (Number(declaration.important) > Number(a.important) ||
                  (declaration.important === a.important && candidate.specificity > left.specificity))));
            if (!intersection) return { instances: [], candidates: [], ambiguity: `Coactive descendant conditions assign ambiguous ${effect} on ${targetPath.join('.')}.` };
          }
        }
      }
    }
  }
  return { instances, candidates: allCandidates };
}

function compare<R extends DescendantRule>(a: DescendantInstance<R>, ai: number, b: DescendantInstance<R>, bi: number) {
  return Number(a.declarations[ai]!.important) - Number(b.declarations[bi]!.important) ||
    a.specificity - b.specificity || a.rule.sourceOrdinal - b.rule.sourceOrdinal || ai - bi;
}
