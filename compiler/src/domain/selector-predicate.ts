import type { ParsedSelectorNode } from './parsed-stylesheet.js';

/** Read state and attribute conditions at the same authored node position.
 * This is a view of parser nodes, not a DOM or implication proof.
 * Missing positions remain missing so each planner retains its own invariants. */
export function selectorPredicateAt(rule: {
  nodes: readonly Pick<ParsedSelectorNode, 'states' | 'attributes'>[];
}, index: number) {
  const node = rule.nodes[index];
  return { states: node?.states, attributes: node?.attributes };
}
