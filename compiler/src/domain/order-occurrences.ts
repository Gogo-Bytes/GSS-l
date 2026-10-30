import type { ParsedDeclaration, ParsedHasCondition, ParsedStyleRule } from './parsed-stylesheet.js';
import type { DescendantInstance } from './plan-descendant-conditions.js';

/** A selector branch bound to its concrete emission paths, before atom reuse. */
export type OrderBinding = Pick<DescendantInstance<ParsedStyleRule>, 'rule' | 'targetPath' | 'sourcePath'> & {
  observation?: ParsedHasCondition;
};

/** An owned target shared by ordering and emission; not a DOM witness. */
export type OwnedTargetBinding = Pick<OrderBinding, 'rule' | 'targetPath'>;

export type OrderInstance = DescendantInstance<ParsedStyleRule> & OrderBinding;
export type OrderOccurrence = { instance: OrderInstance; declaration: ParsedDeclaration; index: number; key: string };

/** Identity is local to this preparation, not a generated class name. Selector-list
 * branches share declarations but retain separate rule identities. Bindings use
 * path/observation values because planners and emitters may rebuild those objects.
 */
export function collectOrderOccurrences(rules: readonly ParsedStyleRule[], instances: readonly OrderInstance[]) {
  const declarationIds = new Map([...new Set(rules.flatMap((rule) => rule.declarations))].map((declaration, index) => [declaration, index]));
  const branchIds = new Map(rules.map((rule, index) => [rule, index]));
  const key = (declaration: ParsedDeclaration, { rule, targetPath, sourcePath, observation }: OrderBinding) =>
    JSON.stringify([declarationIds.get(declaration), branchIds.get(rule), targetPath, sourcePath, observation]);
  const occurrences = [...new Map(instances.flatMap((instance) =>
    // Use the semantic rule's declarations/indices, not the surviving subset on
    // an instance: pruning must not erase a competitor or shift its ordinal.
    instance.rule.declarations.map((declaration, index) => {
      const occurrence: OrderOccurrence = { instance, declaration, index, key: key(declaration, instance) };
      return [occurrence.key, occurrence] as const;
    })
  )).values()];
  return { occurrences, key };
}
