import type { ParsedStyleRule } from './parsed-stylesheet.js';
import { classifyPropertyEffect } from './property-effects.js';
import { getOwnershipPath, matchesOwnedTarget } from './ownership-path.js';
import { propertiesMayOverlapForModuleOrder } from './module-order-policy.js';
import { isOwnedCurrentSubject } from './rule-classification.js';

export function supportsCurrentSubjectRanks(rules: readonly ParsedStyleRule[], target: readonly string[], effect: string): boolean {
  return classifyPropertyEffect(effect).kind === 'longhand' && rules.every(rule => {
    // External descendants can match this target even under an unrelated anchor.
    if (!rule.externalTarget && !matchesOwnedTarget(getOwnershipPath(rule.nodes), target)) return true;
    return rule.declarations.every(d => !propertiesMayOverlapForModuleOrder(effect, d.property) ||
      (d.property === effect && isOwnedCurrentSubject(rule)));
  });
}
