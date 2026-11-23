import type { ParsedStyleRule } from './parsed-stylesheet.js';
import { boundPredicates } from './selector-bindings.js';
import type { OrderOccurrence } from './order-occurrences.js';
import { strictlyRefines } from './plan-structural-relations.js';
import { getOwnershipPath, matchesOwnedTarget } from './ownership-path.js';
import { propertiesMayOverlapForModuleOrder } from './module-order-policy.js';

const context = (target: readonly string[], source?: readonly string[]) => JSON.stringify([target, source]);
const tests = ({ instance }: OrderOccurrence) => boundPredicates({ rule: instance.rule, witnesses: instance.witnesses ?? [] });

/** Only proven ownership/structural relations form semantic edges; authored order is not an edge. */
export function semanticOrderHeights(family: readonly OrderOccurrence[], withinNativeStrength = false): ReadonlyMap<OrderOccurrence, number> {
  const opaque = (rule: ParsedStyleRule) => Boolean(rule.externalTarget || rule.externalCondition || rule.nodes.some((node) => node.hasConditions.length));
  const strength = ({ instance }: OrderOccurrence) => instance.rule.functionalStrength ??
    (instance.witnesses && !opaque(instance.rule) && instance.rule.nodes.every(n => !n.pseudoElement && !n.states.some(s => s.includes('(')))
      ? `0,${instance.specificity},0` : undefined);
  const precedes = (a: OrderOccurrence, b: OrderOccurrence) => {
    // The browser already resolves unequal strengths. Do not carry that edge into an unrelated native tie.
    if (withinNativeStrength) {
      const left = strength(a), right = strength(b);
      if (left !== undefined && right !== undefined && left !== right) return false;
    }
    if (opaque(a.instance.rule) || opaque(b.instance.rule) ||
      !propertiesMayOverlapForModuleOrder(a.declaration.property, b.declaration.property) ||
      context(a.instance.targetPath) !== context(b.instance.targetPath)) return false;
    // A target predicate cannot erase the broader authored ownership requirement.
    if (matchesOwnedTarget(getOwnershipPath(a.instance.rule.nodes), getOwnershipPath(b.instance.rule.nodes)) && strictlyRefines(b.instance, a.instance)) return true;
    // Equivalent predicates retain the owned-resolution specificity proof.
    return !strictlyRefines(a.instance, b.instance) &&
      a.instance.rule.relations.every((relation) => relation === 'descendant') &&
      b.instance.rule.relations.every((relation) => relation === 'descendant') &&
      context(a.instance.targetPath, a.instance.sourcePath) === context(b.instance.targetPath, b.instance.sourcePath) &&
      JSON.stringify(tests(a)) === JSON.stringify(tests(b)) &&
      a.instance.specificity < b.instance.specificity;
  };
  const heights = new Map<OrderOccurrence, number>();
  const visiting = new Set<OrderOccurrence>();
  const height = (occurrence: OrderOccurrence): number => {
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
  for (const occurrence of family) height(occurrence);
  return heights;
}
