import type { ParsedStyleRule } from './parsed-stylesheet.js';
import { effectsOfProperty } from './property-effects.js';
import { matchesOwnedTarget } from './ownership-path.js';

/** Admission envelope only, not a general cascade model. Called on all module rules,
 * before pruning, so an opaque competing declaration cannot escape rank closure.
 * Existing accepted inputs never depend on this opt-in check. */
export function supportsCurrentBackgroundRanks(rules: readonly ParsedStyleRule[], target: readonly string[]): boolean {
  // An external residual selects a browser descendant, not the owned anchor in
  // rule.path. It may match this target under any anchor; no disjointness proof
  // exists here, so competing external effects must be checked module-wide.
  return rules.filter((rule) => rule.externalTarget !== undefined || matchesOwnedTarget(rule.path, target)).every((rule) => {
    const competing = rule.declarations.filter((declaration) => effectsOfProperty(declaration.property).includes('background-color'));
    if (!competing.length) return true;
    return rule.layer === 'unlayered' && rule.conditions.length === 0 &&
      !rule.externalTarget && !rule.externalCondition &&
      rule.relations.every((relation) => relation === 'descendant') &&
      rule.observations.every((observations) => observations.length === 0) &&
      rule.pseudoElements.every((pseudo) => pseudo === null) &&
      competing.every((declaration) => declaration.property === 'background-color') &&
      rule.states.every((states, index) => states.length === 0 ||
        (index === rule.path.length - 1 && states.length === 1 && (states[0] === 'hover' || states[0] === 'focus'))) &&
      rule.attributes.every((attributes, index) => attributes.length === 0 ||
        (index === rule.path.length - 1 && attributes.length === 1));
  });
}
