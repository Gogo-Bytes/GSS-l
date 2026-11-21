import { getOwnershipPath, isSubsequence, matchesOwnedTarget } from './ownership-path.js';
import type { ParsedStyleRule, SelectorRelation } from './parsed-stylesheet.js';

export type DescendantRule = Pick<ParsedStyleRule, 'nodes'> & {
  conditions: readonly { kind: string; query: string }[];
  layer: string | null;
  sourceOrdinal: number;
  declarations: readonly { property: string; value: string; important: boolean }[];
};

export type DomWitness = {
  readonly nodeIndex: number;
  readonly path: readonly string[];
  readonly incoming: SelectorRelation | null;
  /** Authored class strength carried by this marker, not its concrete scope depth. */
  readonly classWeight: number;
};

/** Authored declarations remain on rule; only the later plan owns a surviving subset. */
export type ConditionBinding<R extends DescendantRule> = {
  readonly rule: Readonly<R>;
  readonly witnesses: readonly DomWitness[];
  readonly targetPath: readonly string[];
  readonly sourcePath?: readonly string[];
  readonly sourceIndex: number;
  readonly specificity: number;
};

export type BoundDescendantTarget<R extends DescendantRule> = {
  readonly targetPath: readonly string[];
  readonly bindings: readonly ConditionBinding<R>[];
};

export function bindDescendantConditions<R extends DescendantRule>(
  rules: readonly R[], declaredPaths: readonly (readonly string[])[]
): readonly BoundDescendantTarget<R>[] {
  const paths = new Map(declaredPaths.map(path => [JSON.stringify(path), path]));
  return [...paths.values()].map(targetPath => ({ targetPath,
    bindings: rules.flatMap(rule => {
      const sourceIndex = rule.nodes.findIndex(({ states, attributes }) => states.length > 0 || attributes.length > 0);
      return conditionSourcePositions(getOwnershipPath(rule.nodes), targetPath, sourceIndex).map(position => {
        const last = rule.nodes.length - 1;
        const sourcePath = position < 0 ? undefined : targetPath.slice(0, position + 1);
        const ancestor = sourcePath && sourceIndex !== last;
        const witnesses: DomWitness[] = ancestor ? [
          { nodeIndex: sourceIndex, path: sourcePath, incoming: null, classWeight: 1 },
          { nodeIndex: last, path: targetPath, incoming: 'descendant', classWeight: last }
        ] : [{ nodeIndex: last, path: targetPath, incoming: null, classWeight: rule.nodes.length }];
        return { rule, targetPath, sourceIndex, witnesses, ...(sourcePath ? { sourcePath } : {}),
          specificity: conditionSpecificity(rule, sourceIndex) };
      });
    })
  }));
}

export type StructuralBinding = ConditionBinding<ParsedStyleRule> & { readonly sourcePath: readonly string[] };

/** Callers supply admitted runtime relations; ownership prefixes and tails stay on the rule. */
export function bindStructuralRelations(rules: readonly ParsedStyleRule[]): readonly StructuralBinding[] {
  return rules.map(rule => {
    const targetPath = getOwnershipPath(rule.nodes);
    const sourceIndex = rule.relations.findIndex(relation => relation !== 'descendant');
    if (sourceIndex < 0) throw new Error('Structural binding requires a runtime relation.');
    const witnesses = rule.nodes.slice(sourceIndex).map((_, i) => {
      const nodeIndex = sourceIndex + i;
      return { nodeIndex, path: targetPath.slice(0, nodeIndex + 1),
        incoming: i === 0 ? null : rule.relations[nodeIndex - 1]!, classWeight: i === 0 ? sourceIndex + 1 : 1 };
    });
    return { rule, targetPath, sourceIndex, witnesses, sourcePath: witnesses[0]!.path,
      specificity: conditionSpecificity(rule, sourceIndex) + rule.nodes.at(-1)!.states.length + rule.nodes.at(-1)!.attributes.length };
  });
}

function conditionSpecificity(rule: DescendantRule, sourceIndex: number): number {
  const predicate = sourceIndex < 0 ? undefined : rule.nodes[sourceIndex];
  return rule.nodes.length + (predicate?.states ?? []).filter(state => !state.startsWith('where(')).length +
    (predicate?.attributes.length ?? 0);
}

/** Bind condition witnesses, not every embedding of unconditional ownership nodes. */
function conditionSourcePositions(path: readonly string[], target: readonly string[], sourceIndex: number): number[] {
  if (!matchesOwnedTarget(path, target)) return [];
  if (sourceIndex < 0) return [-1];
  if (sourceIndex === path.length - 1) return [target.length - 1];
  return target.flatMap((name, position) =>
    name === path[sourceIndex] &&
    isSubsequence(path.slice(0, sourceIndex), target.slice(0, position)) &&
    matchesOwnedTarget(path.slice(sourceIndex + 1), target.slice(position + 1)) ? [position] : []
  );
}
