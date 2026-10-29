import type { ParsedStyleRule } from './parsed-stylesheet.js';

type OwnershipShape = {
  relations: readonly string[];
  states: readonly (readonly unknown[])[];
  attributes: readonly (readonly unknown[])[];
  observations: readonly (readonly unknown[])[];
  pseudoElements: readonly (string | null)[];
};

// These predicates can overlap. Callers retain their own admission, external
// target and planner routing checks; none implies a browser DOM relationship.
export function isAncestorStateRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.states.slice(0, -1).some((state) => state.length > 0);
}

export function isAncestorAttributeRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.attributes.slice(0, -1).some((conditions) => conditions.length > 0);
}

export function isObservedRule(rule: ParsedStyleRule): boolean {
  return rule.observations.at(-1)!.length > 0;
}

export function isStructuralRuntimeRule(rule: ParsedStyleRule): boolean {
  return rule.relations.some((relation) => relation !== 'descendant') &&
    rule.observations.every((conditions) => conditions.length === 0) &&
    rule.pseudoElements.every((pseudoElement) => pseudoElement === null);
}

export function isCurrentAttributeRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.attributes.at(-1)!.length === 1 &&
    rule.attributes.slice(0, -1).every((conditions) => conditions.length === 0) &&
    rule.states.every((state) => state.length === 0) &&
    rule.observations.every((conditions) => conditions.length === 0) &&
    rule.pseudoElements.every((pseudoElement) => pseudoElement === null);
}

export function isPseudoElementRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    Boolean(rule.pseudoElements.at(-1)) &&
    rule.pseudoElements.slice(0, -1).every((pseudoElement) => pseudoElement === null) &&
    rule.states.slice(0, -1).every((state) => state.length === 0) &&
    rule.attributes.every((conditions) => conditions.length === 0) &&
    rule.observations.every((conditions) => conditions.length === 0);
}

export function isCurrentStateRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.states.at(-1)!.length > 0 &&
    rule.states.slice(0, -1).every((state) => state.length === 0) &&
    rule.attributes.every((conditions) => conditions.length === 0) &&
    rule.observations.every((conditions) => conditions.length === 0) &&
    rule.pseudoElements.every((pseudoElement) => pseudoElement === null);
}

export function isPureOwnershipRule(rule: OwnershipShape): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.states.every((state) => state.length === 0) &&
    rule.attributes.every((conditions) => conditions.length === 0) &&
    rule.observations.every((conditions) => conditions.length === 0) &&
    rule.pseudoElements.every((pseudoElement) => pseudoElement === null);
}

