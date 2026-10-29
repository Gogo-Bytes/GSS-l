import type { ParsedAttributeCondition } from './parsed-stylesheet.js';

/** Read state and attribute conditions at the same authored path position.
 * This is a view of the existing parser arrays, not a DOM or implication proof.
 * Missing positions remain missing so each planner retains its own invariants. */
export function selectorPredicateAt(rule: {
  states: readonly (readonly string[])[];
  attributes: readonly (readonly ParsedAttributeCondition[])[];
}, index: number) {
  return { states: rule.states[index], attributes: rule.attributes[index] };
}
