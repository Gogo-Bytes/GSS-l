import { getOwnershipPath, isSubsequence, matchesOwnedTarget } from './ownership-path.js';
import type { ParsedStyleRule } from './parsed-stylesheet.js';

export type DescendantRule = Pick<ParsedStyleRule, 'nodes'> & {
  conditions: readonly { kind: string; query: string }[];
  layer: string | null;
  sourceOrdinal: number;
  declarations: readonly { property: string; value: string; important: boolean }[];
};

/** Authored declarations remain on rule; only the later plan owns a surviving subset. */
export type DescendantBinding<R extends DescendantRule> = {
  readonly rule: Readonly<R>;
  readonly targetPath: readonly string[];
  readonly sourcePath?: readonly string[];
  readonly sourceIndex: number;
  readonly specificity: number;
};

export type BoundDescendantTarget<R extends DescendantRule> = {
  readonly targetPath: readonly string[];
  readonly bindings: readonly DescendantBinding<R>[];
};

export function bindDescendantConditions<R extends DescendantRule>(
  rules: readonly R[], declaredPaths: readonly (readonly string[])[]
): readonly BoundDescendantTarget<R>[] {
  const paths = new Map(declaredPaths.map(path => [JSON.stringify(path), path]));
  return [...paths.values()].map(targetPath => ({ targetPath,
    bindings: rules.flatMap(rule => {
      const sourceIndex = rule.nodes.findIndex(({ states, attributes }) => states.length > 0 || attributes.length > 0);
      const predicate = sourceIndex < 0 ? undefined : rule.nodes[sourceIndex];
      const states = predicate?.states ?? [];
      const attributes = predicate?.attributes ?? [];
      return conditionSourcePositions(getOwnershipPath(rule.nodes), targetPath, sourceIndex).map(position => ({
        rule, targetPath, sourceIndex,
        ...(sourceIndex < 0 ? {} : { sourcePath: targetPath.slice(0, position + 1) }),
        specificity: rule.nodes.length + states.filter(state => !state.startsWith('where(')).length + attributes.length
      }));
    })
  }));
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
