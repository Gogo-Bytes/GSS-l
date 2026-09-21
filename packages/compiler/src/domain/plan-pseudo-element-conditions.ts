import { planDescendantConditions, type DescendantInstance, type DescendantRule } from './plan-descendant-conditions.js';

type PseudoRule = DescendantRule & {
  relations: readonly string[];
  pseudoElements: readonly (string | null)[];
};

/** Pseudo subjects share descendant predicate resolution, but never each other's candidates.
 * A declared runtime path supplies a terminal name, not proof of descendant ancestry. */
export function planPseudoElementConditions<R extends PseudoRule>(
  semanticRules: readonly R[]
): { instances: DescendantInstance<R>[]; ambiguity?: string } {
  const groups = new Map<string, R[]>();
  for (const rule of semanticRules) {
    const subject = rule.pseudoElements.at(-1);
    if (!subject) continue;
    const key = JSON.stringify([rule.layer, rule.conditions, subject]);
    groups.set(key, [...(groups.get(key) ?? []), rule]);
  }
  const instances: DescendantInstance<R>[] = [];
  for (const groupedRules of groups.values()) {
    const first = groupedRules[0]!;
    const targets = new Map<string, { path: readonly string[]; ownership: boolean }>();
    for (const rule of semanticRules) {
      if (rule.layer !== first.layer || JSON.stringify(rule.conditions) !== JSON.stringify(first.conditions)) continue;
      rule.path.forEach((_, index) => {
        const path = rule.path.slice(0, index + 1);
        const key = JSON.stringify(path);
        const ownership = rule.relations.slice(0, index).every((relation) => relation === 'descendant');
        targets.set(key, { path, ownership: ownership || (targets.get(key)?.ownership ?? false) });
      });
    }
    for (const { path, ownership } of targets.values()) {
      const candidates = ownership ? groupedRules : groupedRules.filter((rule) => rule.path.length === 1);
      const planned = planDescendantConditions(candidates, [path]);
      if (planned.ambiguity) return { instances: [], ambiguity: `${planned.ambiguity} Subject ::${first.pseudoElements.at(-1)}.` };
      instances.push(...planned.instances);
    }
  }
  return { instances };
}
