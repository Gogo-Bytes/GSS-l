import { effectsOfProperty } from './property-effects.js';

export type DescendantRule = {
  path: readonly string[];
  states: readonly (readonly string[])[];
  attributes: readonly (readonly { attribute: string; operator: '='; value: string }[])[];
  conditions: readonly { kind: string; query: string }[];
  layer: string;
  sourceOrdinal: number;
  declarations: readonly { property: string; value: string; important: boolean }[];
};

export type DescendantInstance<R extends DescendantRule> = {
  rule: R;
  targetPath: readonly string[];
  sourcePath?: readonly string[];
  sourceIndex: number;
  specificity: number;
  relationRank: number;
  declarations: R['declarations'];
};

/** Bind only condition positions with a proven prefix AND a suffix ending at the target.
 * Do not enumerate equivalent embeddings of the unconditional nodes (exponential for repeated names). */
function conditionSourcePositions(path: readonly string[], target: readonly string[], sourceIndex: number): number[] {
  if (!matchesTarget(path, target)) return [];
  if (sourceIndex < 0) return [-1];
  if (sourceIndex === path.length - 1) return [target.length - 1];
  return target.flatMap((name, position) =>
    name === path[sourceIndex] &&
    isSubsequence(path.slice(0, sourceIndex), target.slice(0, position)) &&
    matchesTarget(path.slice(sourceIndex + 1), target.slice(position + 1)) ? [position] : []
  );
}
function matchesTarget(path: readonly string[], target: readonly string[]): boolean {
  return path.length <= target.length && path.at(-1) === target.at(-1) &&
    isSubsequence(path.slice(0, -1), target.slice(0, -1));
}
function isSubsequence(path: readonly string[], target: readonly string[]): boolean {
  let next = 0;
  for (const name of target) if (name === path[next]) next++;
  return next === path.length;
}

function predicate<R extends DescendantRule>(instance: DescendantInstance<R>): string[] {
  if (instance.sourceIndex < 0) return [];
  const rule = instance.rule;
  return [
    ...rule.states[instance.sourceIndex]!,
    ...rule.attributes[instance.sourceIndex]!.map((attribute) => JSON.stringify(attribute))
  ];
}
function sameNode<R extends DescendantRule>(a: DescendantInstance<R>, b: DescendantInstance<R>) {
  return JSON.stringify(a.sourcePath) === JSON.stringify(b.sourcePath);
}
function implies<R extends DescendantRule>(a: DescendantInstance<R>, b: DescendantInstance<R>) {
  const required = predicate(b);
  return required.length === 0 || (sameNode(a, b) && required.every((part) => predicate(a).includes(part)));
}
function exclusive<R extends DescendantRule>(a: DescendantInstance<R>, b: DescendantInstance<R>) {
  if (!sameNode(a, b)) return false;
  const left = predicate(a);
  const right = predicate(b);
  if (left.some((part) => right.includes(`not(:${part})`)) || right.some((part) => left.includes(`not(:${part})`))) return true;
  const aa = a.rule.attributes[a.sourceIndex]?.[0];
  const ba = b.rule.attributes[b.sourceIndex]?.[0];
  return aa !== undefined && ba !== undefined && aa.attribute === ba.attribute && aa.value !== ba.value;
}

/** Authored ordinal is used ONLY inside one target / wrapper / layer / bound-predicate set.
 * Different live predicates never receive an authored-order tiebreaker. */
export function planDescendantConditions<R extends DescendantRule>(
  rules: readonly R[], declaredPaths: readonly (readonly string[])[]
): { instances: DescendantInstance<R>[]; ambiguity?: string } {
  const paths = new Map(declaredPaths.map((path) => [JSON.stringify(path), path]));
  const instances: DescendantInstance<R>[] = [];
  for (const targetPath of paths.values()) {
    const candidates: DescendantInstance<R>[] = [];
    for (const rule of rules) {
      const sourceIndex = rule.path.findIndex((_, index) => rule.states[index]!.length > 0 || rule.attributes[index]!.length > 0);
      for (const position of conditionSourcePositions(rule.path, targetPath, sourceIndex)) {
        const sourcePath = sourceIndex < 0 ? undefined : targetPath.slice(0, position + 1);
        const states = sourceIndex < 0 ? [] : rule.states[sourceIndex]!;
        const attributes = sourceIndex < 0 ? [] : rule.attributes[sourceIndex]!;
        candidates.push({ rule, targetPath, ...(sourcePath ? { sourcePath } : {}), sourceIndex,
          specificity: rule.path.length + states.filter((state) => !state.startsWith('where(')).length + attributes.length,
          relationRank: states.length + attributes.length, declarations: rule.declarations });
      }
    }
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
    for (let i = 0; i < retained.length; i++) {
      const left = retained[i]!;
      for (const right of retained.slice(i + 1)) {
        if (left.rule.layer !== right.rule.layer || JSON.stringify(left.rule.conditions) !== JSON.stringify(right.rule.conditions) ||
          left.specificity !== right.specificity || implies(left, right) || implies(right, left) || exclusive(left, right)) continue;
        for (const a of left.declarations) for (const b of right.declarations) {
          if (a.important !== b.important || (a.property === b.property && a.value === b.value)) continue;
          for (const effect of effectsOfProperty(a.property).filter((effect) => effectsOfProperty(b.property).includes(effect))) {
            const intersection = retained.some((candidate) => candidate.rule.layer === left.rule.layer &&
              JSON.stringify(candidate.rule.conditions) === JSON.stringify(left.rule.conditions) &&
              implies(candidate, left) && implies(candidate, right) &&
              candidate.specificity > left.specificity && candidate.declarations.some((declaration) =>
                declaration.important === a.important && effectsOfProperty(declaration.property).includes(effect)));
            if (!intersection) return { instances: [], ambiguity: `Coactive descendant conditions assign ambiguous ${effect} on ${targetPath.join('.')}.` };
          }
        }
      }
    }
    instances.push(...retained);
  }
  return { instances };
}

function compare<R extends DescendantRule>(a: DescendantInstance<R>, ai: number, b: DescendantInstance<R>, bi: number) {
  return Number(a.declarations[ai]!.important) - Number(b.declarations[bi]!.important) ||
    a.specificity - b.specificity || a.rule.sourceOrdinal - b.rule.sourceOrdinal || ai - bi;
}
