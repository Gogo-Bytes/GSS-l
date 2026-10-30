import type { ParsedStyleRule } from './parsed-stylesheet.js';
import { effectsOfProperty } from './property-effects.js';
import { getOwnershipPath, matchesOwnedTarget } from './ownership-path.js';

/** Admission envelope only, not a general cascade model. Called on all module rules,
 * before pruning, so an opaque competing declaration cannot escape rank closure.
 * Existing accepted inputs never depend on this opt-in check. */
export function supportsCurrentBackgroundRanks(rules: readonly ParsedStyleRule[], target: readonly string[]): boolean {
  // An external residual selects a browser descendant, not the owned anchor in
  // the authored nodes. It may match this target under any anchor; no disjointness proof
  // exists here, so competing external effects must be checked module-wide.
  return rules.filter((rule) => rule.externalTarget !== undefined || matchesOwnedTarget(getOwnershipPath(rule.nodes), target)).every((rule) => {
    const competing = rule.declarations.filter((declaration) => effectsOfProperty(declaration.property).includes('background-color'));
    if (!competing.length) return true;
    return rule.layer === 'unlayered' && rule.conditions.length === 0 &&
      !rule.externalTarget && !rule.externalCondition &&
      rule.relations.every((relation) => relation === 'descendant') &&
      rule.nodes.every((node) => node.observations.length === 0) &&
      rule.nodes.every((node) => node.pseudoElement === null) &&
      competing.every((declaration) => declaration.property === 'background-color') &&
      rule.nodes.every(({ states }, index) => states.length === 0 ||
        (index === rule.nodes.length - 1 && states.length === 1 && (states[0] === 'hover' || states[0] === 'focus'))) &&
      rule.nodes.every(({ attributes }, index) => attributes.length === 0 ||
        (index === rule.nodes.length - 1 && attributes.length === 1));
  });
}
