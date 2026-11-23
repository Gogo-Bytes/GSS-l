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

type WitnessBinding = Pick<ConditionBinding<DescendantRule>, 'witnesses' | 'rule'>;

export function boundPredicates({ witnesses, rule }: WitnessBinding): string[] {
  return witnesses.flatMap(w => {
    const { states, attributes } = rule.nodes[w.nodeIndex]!;
    return [...states, ...attributes].map(test => JSON.stringify([w.path, test]));
  });
}

/** For coactive selectors, start at the same target. Only a matching child/adjacent
 * step backwards guarantees both tests are still on one and the same DOM element. */
export function exclusiveWitnesses(a: WitnessBinding, b: WitnessBinding): boolean {
  for (let i = a.witnesses.length - 1, j = b.witnesses.length - 1; i >= 0 && j >= 0; i--, j--) {
    const aw = a.witnesses[i]!, bw = b.witnesses[j]!;
    const left = a.rule.nodes[aw.nodeIndex]!, right = b.rule.nodes[bw.nodeIndex]!;
    if (left.states.some(s => right.states.includes(`not(:${s})`)) || right.states.some(s => left.states.includes(`not(:${s})`))) return true;
    // HTML may match unflagged enumerated values ASCII-insensitively. Native tests stay opaque.
    if (left.attributes.some(x => x.operator === '=' && right.attributes.some(y => y.operator === '=' &&
      x.attribute === y.attribute && x.value !== y.value &&
      (x.attribute.startsWith('data-') || asciiFold(x.value) !== asciiFold(y.value))))) return true;
    if (aw.incoming !== bw.incoming || (aw.incoming !== 'child' && aw.incoming !== 'adjacent')) break;
  }
  return false;
}

const asciiFold = (value: string) => value.replace(/[A-Z]/g, letter => letter.toLowerCase());

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
      const ancestors = rule.nodes.slice(0, -1).flatMap((n, i) => n.states.length || n.attributes.length ? [i] : []);
      return descendantWitnesses(getOwnershipPath(rule.nodes), targetPath, ancestors).map(witnesses => {
        const sourcePath = sourceIndex < 0 ? undefined : witnesses[0]!.path;
        return { rule, targetPath, sourceIndex, witnesses, ...(sourcePath ? { sourcePath } : {}),
          specificity: witnesses.reduce((sum, w) => sum + nodeStrength(rule, w.nodeIndex), rule.nodes.length) };
      });
    })
  }));
}

export type StructuralBinding = ConditionBinding<ParsedStyleRule> & { readonly sourcePath: readonly string[] };

/** Callers supply admitted runtime relations; ownership prefixes and tails stay on the rule. */
export function bindStructuralRelations(rules: readonly ParsedStyleRule[]): readonly StructuralBinding[] {
  return rules.map(rule => {
    const targetPath = getOwnershipPath(rule.nodes);
    const firstEdge = rule.relations.findIndex(relation => relation !== 'descendant');
    if (firstEdge < 0) throw new Error('Structural binding requires a runtime relation.');
    // Before the structural suffix only tested nodes need actual ancestors; folded names still carry strength.
    const indices = rule.nodes.flatMap((node, i) => i >= firstEdge || node.states.length || node.attributes.length ? [i] : []);
    const sourceIndex = indices[0]!;
    const witnesses = indices.map((nodeIndex, i) => ({ nodeIndex, path: targetPath.slice(0, nodeIndex + 1),
      incoming: i === 0 ? null : rule.relations[nodeIndex - 1]!, classWeight: nodeIndex - (indices[i - 1] ?? -1) }));
    return { rule, targetPath, sourceIndex, witnesses, sourcePath: witnesses[0]!.path,
      specificity: witnesses.reduce((sum, w) => sum + nodeStrength(rule, w.nodeIndex), rule.nodes.length) };
  });
}

function nodeStrength(rule: DescendantRule, index: number): number {
  const { states, attributes } = rule.nodes[index]!;
  return states.filter(state => !state.startsWith('where(')).length + attributes.length;
}

/** Bind condition witnesses, not every embedding of unconditional ownership nodes. */
function descendantWitnesses(path: readonly string[], target: readonly string[], ancestors: readonly number[]): DomWitness[][] {
  if (!matchesOwnedTarget(path, target)) return [];
  const result: DomWitness[][] = [], prefix: DomWitness[] = [];
  function visit(depth: number, authoredStart: number, targetStart: number) {
    const index = ancestors[depth];
    if (index === undefined) {
      result.push([...prefix, { nodeIndex: path.length - 1, path: target, incoming: depth ? 'descendant' : null,
        classWeight: path.length - depth }]);
      return;
    }
    for (let pos = targetStart; pos < target.length - 1; pos++) {
      if (target[pos] !== path[index] || !isSubsequence(path.slice(authoredStart, index), target.slice(targetStart, pos)) ||
        !matchesOwnedTarget(path.slice(index + 1), target.slice(pos + 1))) continue;
      prefix.push({ nodeIndex: index, path: target.slice(0, pos + 1), incoming: depth ? 'descendant' : null, classWeight: 1 });
      visit(depth + 1, index + 1, pos + 1);
      prefix.pop();
    }
  }
  visit(0, 0, 0);
  return result;
}
