import type { ParsedStyleRule } from './parsed-stylesheet.js';

type OwnershipShape = {
  relations: readonly string[];
  nodes: readonly { states: readonly unknown[]; attributes: readonly unknown[];
    hasConditions: readonly unknown[]; pseudoElement: string | null }[];
};

// These predicates can overlap. Callers retain their own admission, external
// target and planner routing checks; none implies a browser DOM relationship.
export function isAncestorStateRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.nodes.slice(0, -1).some((node) => node.states.length > 0);
}

export function isAncestorAttributeRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.nodes.slice(0, -1).some((node) => node.attributes.length > 0);
}

export function isObservedRule(rule: ParsedStyleRule): boolean {
  return rule.nodes.at(-1)!.hasConditions.length > 0;
}

export function isStructuralRuntimeRule(rule: ParsedStyleRule): boolean {
  return rule.relations.some((relation) => relation !== 'descendant') &&
    rule.nodes.every((node) => node.hasConditions.length === 0) &&
    rule.nodes.every((node) => node.pseudoElement === null);
}

/** Two owned endpoints, one real parent, no function-specific strength or name binding. */
export function isConditionedChildRule(rule: ParsedStyleRule): boolean {
  const target = rule.nodes[1];
  return rule.relations.length === 1 && rule.relations[0] === 'child' && !!target &&
    (target.states.length > 0 || target.attributes.length > 0) && rule.nodes[0]!.attributes.length <= 1 &&
    !rule.externalTarget && !rule.externalCondition && rule.nodes.every(node => !node.pseudoElement &&
      !node.hasConditions.length && node.states.every(state => !state.includes('(')));
}

/** An ownership prefix selects a scope; it is not a second DOM witness. */
export function isOwnedCurrentSubject(rule: ParsedStyleRule): boolean {
  return !rule.externalTarget && !rule.externalCondition && rule.relations.every(r => r === 'descendant') &&
    rule.nodes.every((node, index) => !node.pseudoElement && !node.hasConditions.length &&
      (index === rule.nodes.length - 1 ? node.states.every(state => !state.includes('(')) :
        !node.states.length && !node.attributes.length));
}

export function isCurrentAttributeRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.nodes.at(-1)!.attributes.length > 0 &&
    rule.nodes.slice(0, -1).every((node) => node.attributes.length === 0 && node.states.length === 0) &&
    rule.nodes.every((node) => node.hasConditions.length === 0) &&
    rule.nodes.every((node) => node.pseudoElement === null);
}

export function isPseudoElementRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    Boolean(rule.nodes.at(-1)?.pseudoElement) &&
    rule.nodes.slice(0, -1).every((node) => node.pseudoElement === null) &&
    rule.nodes.slice(0, -1).every((node) => node.states.length === 0) &&
    rule.nodes.every((node) => node.attributes.length === 0) &&
    rule.nodes.every((node) => node.hasConditions.length === 0);
}

export function isCurrentStateRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.nodes.at(-1)!.states.length > 0 &&
    rule.nodes.slice(0, -1).every((node) => node.states.length === 0) &&
    rule.nodes.every((node) => node.attributes.length === 0) &&
    rule.nodes.every((node) => node.hasConditions.length === 0) &&
    rule.nodes.every((node) => node.pseudoElement === null);
}

export function isPureOwnershipRule(rule: OwnershipShape): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.nodes.every((node) => node.states.length === 0) &&
    rule.nodes.every((node) => node.attributes.length === 0) &&
    rule.nodes.every((node) => node.hasConditions.length === 0) &&
    rule.nodes.every((node) => node.pseudoElement === null);
}

