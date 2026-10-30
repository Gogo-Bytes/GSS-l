import { getOwnershipPath } from './ownership-path.js';
import { effectsOfProperty } from './property-effects.js';
import type { DescendantInstance } from './plan-descendant-conditions.js';
import type { ParsedHasCondition, ParsedStyleRule, SelectorRelation } from './parsed-stylesheet.js';

// Ownership identifies the exported target. Runtime edges constrain DOM witnesses;
// ownership-prefix segments are never interpreted as runtime ancestry here.
type Constraint = {
  targetPath: readonly string[];
  sourcePath?: readonly string[];
  predicates: readonly string[];
  runtime?: { edges: readonly SelectorRelation[] };
  observation?: ParsedHasCondition;
};
export type StructuralInstance = DescendantInstance<ParsedStyleRule>;
/** Runtime structural outputs always bind a source; inherited descendant
 * instances may be unconditional and keep the broader shared shape. */
export type RuntimeStructuralInstance = StructuralInstance & { sourcePath: readonly string[] };
type Candidate<I extends StructuralInstance = StructuralInstance> = {
  instance: I; constraint: Constraint; typeSpecificity?: number;
};

function samePath(a: readonly string[] | undefined, b: readonly string[] | undefined) {
  return JSON.stringify(a) === JSON.stringify(b);
}
function predicates(rule: ParsedStyleRule, index: number): string[] {
  if (index < 0) return [];
  const { states, attributes } = rule.nodes[index]!;
  return [
    ...states!.map((state) => `:${state}`),
    ...attributes!.map((attribute) => JSON.stringify(attribute))
  ];
}
function implies(a: Constraint, b: Constraint): boolean {
  if (!samePath(a.targetPath, b.targetPath)) return false;
  if (b.observation && JSON.stringify(a.observation) !== JSON.stringify(b.observation)) return false;
  if (b.runtime) {
    if (!a.runtime || a.runtime.edges.length < b.runtime.edges.length) return false;
    // Both are suffixes of the same owned path. Extra earlier runtime edges may
    // be forgotten; an ownership prefix never supplies a missing runtime edge.
    const aligned = a.runtime.edges.slice(a.runtime.edges.length - b.runtime.edges.length);
    if (!aligned.every((edge, index) => edge === b.runtime!.edges[index] ||
      (edge === 'adjacent' && b.runtime!.edges[index] === 'general-sibling'))) return false;
  }
  if (!b.predicates.length) return true;
  if (!samePath(a.sourcePath, b.sourcePath) || !b.predicates.every((part) => a.predicates.includes(part))) return false;
  // A sibling witness is not an ancestor, even if its exported path is a prefix.
  return Boolean(b.runtime) || !a.runtime || a.runtime.edges.every((edge) => edge === 'child');
}
function constraintForInstance(instance: StructuralInstance): Constraint {
  const firstRuntime = instance.rule.relations.findIndex((relation) => relation !== 'descendant');
  return { targetPath: instance.targetPath,
    ...(instance.sourcePath ? { sourcePath: instance.sourcePath } : {}),
    predicates: predicates(instance.rule, instance.sourceIndex),
    ...(firstRuntime >= 0 ? { runtime: {
      edges: instance.rule.relations.slice(firstRuntime).filter((relation) => relation !== 'descendant')
    } } : {}) };
}

/** Strict implication at one emission context. Numeric relationRank is deliberately
 * not used: it is a target-local projection, not a transferable semantic proof. */
export function strictlyRefines(a: StructuralInstance, b: StructuralInstance): boolean {
  return sameContext(a, b) && implies(constraintForInstance(a), constraintForInstance(b)) &&
    !implies(constraintForInstance(b), constraintForInstance(a));
}

function sameContext(a: StructuralInstance, b: StructuralInstance) {
  return samePath(a.targetPath, b.targetPath) && a.rule.layer === b.rule.layer &&
    JSON.stringify(a.rule.conditions) === JSON.stringify(b.rule.conditions);
}

function compareSpecificity(a: Candidate, b: Candidate): number {
  return a.instance.specificity - b.instance.specificity || (a.typeSpecificity ?? 0) - (b.typeSpecificity ?? 0);
}

function sameUniqueWitness(a: Constraint, b: Constraint): boolean {
  return Boolean(a.runtime && b.runtime && samePath(a.sourcePath, b.sourcePath) &&
    samePath(a.runtime.edges, b.runtime.edges) &&
    a.runtime.edges.every((edge) => edge === 'child' || edge === 'adjacent'));
}
function exclusive(a: Candidate, b: Candidate): boolean {
  if (!sameUniqueWitness(a.constraint, b.constraint)) return false;
  const left = a.constraint.predicates;
  const right = b.constraint.predicates;
  if (left.some((part) => right.includes(`:not(${part})`)) || right.some((part) => left.includes(`:not(${part})`))) return true;
  const aa = a.instance.rule.nodes[a.instance.sourceIndex]?.attributes[0];
  const ba = b.instance.rule.nodes[b.instance.sourceIndex]?.attributes[0];
  return aa !== undefined && ba !== undefined && aa.attribute === ba.attribute && aa.value !== ba.value;
}
function resolveEquivalentGroups(candidates: readonly Candidate[]): void {
  const pending = new Set(candidates);
  for (const first of candidates) {
    if (!pending.has(first)) continue;
    const group = [...pending].filter((candidate) => sameContext(first.instance, candidate.instance) &&
      implies(first.constraint, candidate.constraint) && implies(candidate.constraint, first.constraint));
    const winners = new Map<string, { candidate: Candidate; index: number }>();
    for (const candidate of group) {
      pending.delete(candidate);
      candidate.instance.declarations.forEach((declaration, index) => {
        for (const effect of effectsOfProperty(declaration.property)) {
          const current = winners.get(effect);
          if (!current || Number(declaration.important) - Number(current.candidate.instance.declarations[current.index]!.important) > 0 ||
            (declaration.important === current.candidate.instance.declarations[current.index]!.important &&
              (candidate.instance.specificity - current.candidate.instance.specificity ||
                candidate.instance.rule.sourceOrdinal - current.candidate.instance.rule.sourceOrdinal || index - current.index) > 0)) {
            winners.set(effect, { candidate, index });
          }
        }
      });
    }
    for (const candidate of group) candidate.instance.declarations = candidate.instance.declarations.filter((_, index) =>
      [...winners.values()].some((winner) => winner.candidate === candidate && winner.index === index));
  }
}
function ambiguity(candidates: readonly Candidate[]): string | undefined {
  for (let index = 0; index < candidates.length; index++) {
    const left = candidates[index]!;
    for (const right of candidates.slice(index + 1)) {
      if ((!left.constraint.runtime && !right.constraint.runtime) || !sameContext(left.instance, right.instance) ||
        compareSpecificity(left, right) !== 0 || implies(left.constraint, right.constraint) ||
        implies(right.constraint, left.constraint) || exclusive(left, right)) continue;
      for (const a of left.instance.declarations) for (const b of right.instance.declarations) {
        if (a.important !== b.important || (a.property === b.property && a.value === b.value)) continue;
        for (const effect of effectsOfProperty(a.property).filter((effect) => effectsOfProperty(b.property).includes(effect))) {
          // An intersection must cover *every* coactive match, not just exhibit one
          // common witness. Repeated source nodes defeat general-sibling intersections.
          const intersection = candidates.some((candidate) =>
            sameContext(candidate.instance, left.instance) &&
            (implies(left.constraint, candidate.constraint) || implies(right.constraint, candidate.constraint) ||
              (sameUniqueWitness(left.constraint, right.constraint) && sameUniqueWitness(candidate.constraint, left.constraint) &&
                implies(candidate.constraint, left.constraint) && implies(candidate.constraint, right.constraint) &&
                candidate.constraint.predicates.every((part) => left.constraint.predicates.includes(part) || right.constraint.predicates.includes(part)))) &&
            candidate.instance.declarations.some((declaration) => effectsOfProperty(declaration.property).includes(effect) &&
              (Number(declaration.important) > Number(a.important) ||
                (declaration.important === a.important && (compareSpecificity(candidate, left) > 0 ||
                  (compareSpecificity(candidate, left) === 0 &&
                    implies(candidate.constraint, left.constraint) && !implies(left.constraint, candidate.constraint) &&
                    implies(candidate.constraint, right.constraint) && !implies(right.constraint, candidate.constraint)))))));
          if (!intersection) return `Coactive structural relations assign ambiguous ${effect} on ${left.instance.targetPath.join('.')}.`;
        }
      }
    }
  }
  return undefined;
}

/** A rank is only a topological projection of proved implication, not its proof.
 * Keep all original rules/declarations (including source spans) as provenance. */
export function planStructuralRelations(
  rules: readonly ParsedStyleRule[], descendants: readonly StructuralInstance[], observed: readonly ParsedStyleRule[]
): { instances: RuntimeStructuralInstance[]; descendants: StructuralInstance[]; ambiguity?: string } {
  if (!rules.length) return { instances: [], descendants: [...descendants] };
  const structural: Candidate<RuntimeStructuralInstance>[] = rules.map((rule) => {
    const targetPath = getOwnershipPath(rule.nodes);
    const sourceIndex = rule.relations.findIndex((relation) => relation !== 'descendant');
    const sourcePath = targetPath.slice(0, sourceIndex + 1);
    // The session admits one or more trailing descendant ownership edges;
    // they remain in the emitted selector but are not runtime implication edges.
    const { states, attributes } = rule.nodes[sourceIndex]!;
    const instance: RuntimeStructuralInstance = { rule, targetPath, sourcePath, sourceIndex,
      specificity: rule.nodes.length + states!.filter((state) => !state.startsWith('where(')).length + attributes!.length,
      relationRank: 0, declarations: rule.declarations };
    return {
      instance,
      constraint: constraintForInstance(instance)
    };
  });
  const inherited: Candidate[] = descendants.map((instance) => ({ instance: { ...instance }, constraint: {
    targetPath: instance.targetPath, ...(instance.sourcePath ? { sourcePath: instance.sourcePath } : {}),
    predicates: predicates(instance.rule, instance.sourceIndex)
  } }));
  resolveEquivalentGroups(structural);
  const candidates = [...inherited, ...structural];
  // Complex residuals retain native list specificity, not an estimated class/type count.
  // They cannot license implication/pruning or scalar equal-strength ambiguity diagnostics.
  const observedCandidates: Candidate[] = observed.filter((rule) =>
    !rule.nodes.at(-1)!.observations.some((observation) => observation.nativeSpecificity)
  ).flatMap((rule) => rule.nodes.at(-1)!.observations.map((observation) => {
    const targetPath = getOwnershipPath(rule.nodes);
    const isTag = observation.observedResidual !== undefined &&
      observation.observedResidualClassCount === undefined &&
      !observation.observedResidual.startsWith(':') && !observation.observedResidual.startsWith('[');
    const argumentClasses = observation.observedClass ? 1 + Number(Boolean(observation.observedState))
      : observation.observedResidualClassCount ?? Number(!isTag);
    return {
      instance: { rule, targetPath, sourceIndex: -1, specificity: rule.nodes.length + argumentClasses,
        relationRank: 0, declarations: rule.declarations },
      constraint: { targetPath, predicates: [], observation },
      typeSpecificity: Number(isTag)
    };
  }));
  const conflict = ambiguity([...candidates, ...observedCandidates]);
  if (conflict) return { instances: [], descendants: [], ambiguity: conflict };
  // Descendant atoms may be shared across targets and Modules. Preserve their
  // context-independent predicate ranks; never attach local graph depth to a
  // shared identity. They cannot imply a runtime constraint, so only structural
  // (already target-qualified) emissions need a new topological projection.
  const ranks = new Map<Candidate, number>(inherited.map((candidate) => [candidate, candidate.instance.relationRank]));
  function rank(candidate: Candidate): number {
    const previous = ranks.get(candidate);
    if (previous !== undefined) return previous;
    const broader = candidates.filter((other) => sameContext(candidate.instance, other.instance) &&
      implies(candidate.constraint, other.constraint) && !implies(other.constraint, candidate.constraint));
    const value = broader.reduce((maximum, other) => Math.max(maximum, rank(other) + 1), 0);
    ranks.set(candidate, value);
    return value;
  }
  for (const candidate of structural) candidate.instance.relationRank = rank(candidate);
  return { instances: structural.map(({ instance }) => instance), descendants: inherited.map(({ instance }) => instance) };
}
