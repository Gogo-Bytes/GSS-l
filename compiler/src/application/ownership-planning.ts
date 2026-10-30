import { getOwnershipPath } from '../domain/ownership-path.js';
import { resolveTargetDeclarations, type ResolvedTarget } from '../domain/resolve-target-declarations.js';
import type { ParsedCondition, ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import { canonicalCondition, groupRulesByCondition } from './condition-context.js';

export type PlannedOwnershipGroup = {
  wrappers: readonly ParsedCondition[];
  condition: string;
  layer: string;
  targets: readonly ResolvedTarget<ParsedStyleRule>[];
};

/** Plan pure ownership output after fallback selection. Keep all declared local
 * prefixes, including empty winners; these are not the pre-pruning order candidates. */
export function planOwnershipTargets(
  ownershipRules: readonly ParsedStyleRule[], localRules: readonly ParsedStyleRule[]
): readonly PlannedOwnershipGroup[] {
  return [...groupRulesByCondition(ownershipRules).values()].map((groupedRules) => {
    const wrappers = groupedRules[0]!.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = groupedRules[0]!.layer;
    const declaredPaths = localRules
      .filter((rule) => rule.layer === layer && canonicalCondition(rule.conditions) === condition)
      .flatMap(({ nodes }) => {
        const path = getOwnershipPath(nodes);
        return path.map((_, index) => path.slice(0, index + 1));
      });
    return { wrappers, condition, layer, targets: resolveTargetDeclarations(groupedRules, declaredPaths) };
  });
}
