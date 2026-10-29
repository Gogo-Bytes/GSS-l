import type { ParsedStyleRule } from './parsed-stylesheet.js';
import type { OrderInstance } from './order-occurrences.js';
import { planDescendantConditions } from './plan-descendant-conditions.js';
import { planStructuralRelations } from './plan-structural-relations.js';
import { planPseudoElementConditions } from './plan-pseudo-element-conditions.js';
import { supportsCurrentBackgroundRanks } from './module-local-atom-ranks.js';
import { isPureOwnershipRule, isCurrentStateRule, isCurrentAttributeRule, isAncestorStateRule, isAncestorAttributeRule } from './rule-classification.js';

/** Coordinate existing proofs in their established diagnostic order. The
 * individual planners still own their relation and specificity semantics. */
export function planModuleRelations(localRules: readonly ParsedStyleRule[], semanticRules: readonly ParsedStyleRule[]) {
  const ownershipRules = localRules.filter(isPureOwnershipRule);
  const hasRules = localRules.filter(({ observations }) => observations.at(-1)?.length);
  const contextualRules = localRules.filter(({ relations }) => relations.some((relation) => relation !== 'descendant'));
  const descendantRules = localRules.filter((rule) =>
    isPureOwnershipRule(rule) || isCurrentStateRule(rule) || isCurrentAttributeRule(rule) ||
    isAncestorStateRule(rule) || isAncestorAttributeRule(rule)
  );
  const hasDescendantConditions = contextualRules.length > 0 || descendantRules.some((rule) => !isPureOwnershipRule(rule));
  const declaredPaths = semanticRules.flatMap(({ path }) => path.map((_, index) => path.slice(0, index + 1)));
  const plannedDescendants = hasDescendantConditions ? planDescendantConditions(descendantRules, declaredPaths,
    (target) => supportsCurrentBackgroundRanks(semanticRules, target)) : undefined;
  if (plannedDescendants?.ambiguity) return { ambiguity: plannedDescendants.ambiguity };
  const plannedStructural = planStructuralRelations(contextualRules, plannedDescendants?.instances ?? [], hasRules);
  if (plannedStructural.ambiguity) return { ambiguity: plannedStructural.ambiguity };
  const plannedPseudos = planPseudoElementConditions(localRules);
  if (plannedPseudos.ambiguity) return { ambiguity: plannedPseudos.ambiguity };
  return { plan: { ownershipRules, hasRules, descendantRules, hasDescendantConditions, declaredPaths,
    plannedDescendants, plannedStructural, plannedPseudos } };
}

/** Preserve the planner's candidate/instance choices and their established order.
 * In the pure path, descendant candidates are intentionally collected only when
 * ordering is planned, after compatibility and preserved-fallback decisions. */
export function collectModuleOrderCandidates(
  plan: NonNullable<ReturnType<typeof planModuleRelations>['plan']>,
  sameNodeRules: readonly ParsedStyleRule[],
  externalRules: readonly ParsedStyleRule[]
): OrderInstance[] {
  const { plannedDescendants, descendantRules, declaredPaths, plannedStructural, plannedPseudos, hasRules } = plan;
  return [
    ...(plannedDescendants ?? planDescendantConditions(descendantRules, declaredPaths)).candidates,
    ...plannedStructural.instances,
    ...plannedPseudos.candidates,
    ...[...sameNodeRules, ...externalRules].map((rule) => ({
      rule, targetPath: rule.path, sourceIndex: -1, specificity: rule.path.length,
      relationRank: 0, declarations: rule.declarations
    })),
    ...hasRules.flatMap((rule) => rule.observations.at(-1)!.map((observation) => ({
      rule, observation, targetPath: rule.path, sourceIndex: -1, specificity: rule.path.length,
      relationRank: 0, declarations: rule.declarations
    })))
  ];
}
