import type { ParsedDeclaration, ParsedHasCondition, ParsedStyleRule } from './parsed-stylesheet.js';
import type { DescendantInstance } from './plan-descendant-conditions.js';
import { strictlyRefines } from './plan-structural-relations.js';
import { matchesOwnedTarget } from './module-local-atom-ranks.js';
import { propertiesMayOverlapForModuleOrder, propertyOrderPriority, isPropertyOrderReuseBarrier } from './module-order-policy.js';

type Instance = DescendantInstance<ParsedStyleRule> & { observation?: ParsedHasCondition };
type Occurrence = { instance: Instance; declaration: ParsedDeclaration; index: number; key: string };
const context = (target: readonly string[], source?: readonly string[]) => JSON.stringify([target, source]);

/** Module-local effect-family order: semantic dependency height, fixed property priority, then original
 * authored occurrence. Source order is never a semantic edge. Contexts remain
 * distinct until their complete (height, occurrence) tuple proves shareable. */
export function planFixedModuleRanks(rules: readonly ParsedStyleRule[], instances: readonly Instance[]) {
  const declarationIds = new Map([...new Set(rules.flatMap((rule) => rule.declarations))].map((declaration, index) => [declaration, index]));
  // Parser selector-list branches share declaration objects. Rule identity preserves
  // the original branch (predicates, runtime relations and pseudo subject); paths
  // distinguish its concrete emission bindings. Never merge those before proofs.
  const branchIds = new Map(rules.map((rule, index) => [rule, index]));
  const key = (declaration: ParsedDeclaration, rule: ParsedStyleRule, target: readonly string[], source?: readonly string[], observation?: ParsedHasCondition) =>
    JSON.stringify([declarationIds.get(declaration), branchIds.get(rule), target, source, observation]);
  const occurrences = [...new Map(instances.flatMap((instance) => instance.rule.declarations.map((declaration, index) => {
    const occurrence = { instance, declaration, index, key: key(declaration, instance.rule, instance.targetPath, instance.sourcePath, instance.observation) };
    return [occurrence.key, occurrence] as const;
  }))).values()];
  const pending = new Set(occurrences);
  const ranks = new Map<string, number>();
  const overlap = (a: Occurrence, b: Occurrence) =>
    propertiesMayOverlapForModuleOrder(a.declaration.property, b.declaration.property);
  const opaque = (rule: ParsedStyleRule) => Boolean(rule.externalTarget || rule.externalCondition || rule.observations.some((parts) => parts.length));
  const precedes = (a: Occurrence, b: Occurrence) => {
    if (opaque(a.instance.rule) || opaque(b.instance.rule) || !overlap(a, b) ||
      context(a.instance.targetPath) !== context(b.instance.targetPath)) return false;
    // Predicate implication at a bound target cannot erase the broader rule's
    // authored ownership requirement. An inherited .button:hover does not prove
    // refinement of .root .button merely because both bind to root.button.
    if (matchesOwnedTarget(a.instance.rule.path, b.instance.rule.path) && strictlyRefines(b.instance, a.instance)) return true;
    // Equivalent predicates retain the owned-resolution specificity proof, including
    // partially surviving shorthands whose emitted pure atom has specificity one.
    return !strictlyRefines(a.instance, b.instance) &&
      a.instance.rule.relations.every((relation) => relation === 'descendant') &&
      b.instance.rule.relations.every((relation) => relation === 'descendant') &&
      context(a.instance.targetPath, a.instance.sourcePath) === context(b.instance.targetPath, b.instance.sourcePath) &&
      JSON.stringify(a.instance.rule.states[a.instance.sourceIndex] ?? []) === JSON.stringify(b.instance.rule.states[b.instance.sourceIndex] ?? []) &&
      JSON.stringify(a.instance.rule.attributes[a.instance.sourceIndex] ?? []) === JSON.stringify(b.instance.rule.attributes[b.instance.sourceIndex] ?? []) &&
      a.instance.specificity < b.instance.specificity;
  };
  for (const first of occurrences) {
    if (!pending.delete(first)) continue;
    const family = [first];
    for (let i = 0; i < family.length; i++) {
      for (const other of pending) {
        if (other.instance.rule.layer !== first.instance.rule.layer ||
          JSON.stringify(other.instance.rule.conditions) !== JSON.stringify(first.instance.rule.conditions) ||
          other.instance.rule.pseudoElements.at(-1) !== first.instance.rule.pseudoElements.at(-1) ||
          other.declaration.important !== first.declaration.important ||
          !overlap(family[i]!, other)) continue;
        pending.delete(other);
        family.push(other);
      }
    }
    if (new Set(family.map(({ declaration }) => declaration)).size < 2) continue;
    const heights = new Map<Occurrence, number>();
    const visiting = new Set<Occurrence>();
    const height = (occurrence: Occurrence): number => {
      const cached = heights.get(occurrence);
      if (cached !== undefined) return cached;
      if (visiting.has(occurrence)) throw new Error('Cyclic module semantic ordering constraints');
      visiting.add(occurrence);
      const value = family.filter((other) => precedes(other, occurrence))
        .reduce((maximum, other) => Math.max(maximum, height(other) + 1), 0);
      visiting.delete(occurrence);
      heights.set(occurrence, value);
      return value;
    };
    const compare = (a: Occurrence, b: Occurrence) => height(a) - height(b) ||
      propertyOrderPriority(a.declaration.property) - propertyOrderPriority(b.declaration.property) ||
      a.instance.rule.sourceOrdinal - b.instance.rule.sourceOrdinal || a.index - b.index;
    family.sort(compare);
    let rank = 0;
    family.forEach((occurrence, index) => {
      if (index === 0 || compare(family[index - 1]!, occurrence) !== 0) rank++;
      ranks.set(occurrence.key, rank);
    });
    reuseContiguousPureRanks(family, heights, ranks);
  }
  return { get(declaration: ParsedDeclaration, rule: ParsedStyleRule, target: readonly string[], source?: readonly string[], observation?: ParsedHasCondition): number | undefined {
    return ranks.get(key(declaration, rule, target, source, observation));
  } };
}

function reusablePureOccurrence({ instance, declaration }: Occurrence): boolean {
  const rule = instance.rule;
  return rule.conditions.length === 0 && rule.path.length === 1 && instance.targetPath.length === 1 &&
    !instance.sourcePath && instance.sourceIndex === -1 && !instance.observation &&
    !rule.externalTarget && !rule.externalCondition && rule.relations.length === 0 &&
    rule.states.every((parts) => parts.length === 0) && rule.attributes.every((parts) => parts.length === 0) &&
    rule.observations.every((parts) => parts.length === 0) && rule.pseudoElements.every((pseudo) => pseudo === null) &&
    !isPropertyOrderReuseBarrier(declaration.property);
}

/** Only contract adjacent, wholly eligible original buckets with identical writes.
 * Different target names are NOT a disjointness proof: arbitrary same-module
 * subsets can compose. No unlike competitor may be crossed, and no later rank
 * is renumbered. This bounded model relies on the current overlap registry plus
 * the directional exclusion, not a universal proof about browser CSS aliases.
 * Exact value spelling is conservative: asset bindings are stylesheet-wide and
 * emitted identities still retain typed asset, layer, condition and importance.
 */
function reuseContiguousPureRanks(family: readonly Occurrence[], heights: ReadonlyMap<Occurrence, number>, ranks: Map<string, number>) {
  const buckets = new Map<number, Occurrence[]>();
  for (const occurrence of family) {
    const rank = ranks.get(occurrence.key)!;
    const bucket = buckets.get(rank) ?? [];
    bucket.push(occurrence);
    buckets.set(rank, bucket);
  }
  let previous: { semantic: string; rank: number } | undefined;
  const semantic = ({ declaration }: Occurrence) => JSON.stringify([declaration.property, declaration.value, declaration.important]);
  for (const [rank, bucket] of buckets) {
    const value = semantic(bucket[0]!);
    // Selector-list branches share tuples, not necessarily eligibility. Never
    // allow a pure branch to license movement of an ineligible sibling.
    if (!bucket.every((occurrence) => heights.get(occurrence) === 0 && reusablePureOccurrence(occurrence) && semantic(occurrence) === value)) {
      previous = undefined;
      continue;
    }
    const representative = previous?.semantic === value ? previous.rank : rank;
    for (const occurrence of bucket) ranks.set(occurrence.key, representative);
    previous = { semantic: value, rank: representative };
  }
}
