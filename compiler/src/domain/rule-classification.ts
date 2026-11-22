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

/** Compound conditions require actual bound witnesses, not nodes in the ownership-only prefix. */
export function hasBoundNodeTests(rule: ParsedStyleRule): boolean {
  if (rule.externalTarget || rule.externalCondition) return false;
  let start = rule.relations.findIndex(edge => edge !== 'descendant');
  if (start < 0) {
    const ancestors = rule.nodes.slice(0, -1).flatMap((n, i) => n.states.length || n.attributes.length ? [i] : []);
    if (ancestors.length !== 1) return false;
    start = ancestors[0]!;
  }
  const source = rule.nodes[start]!;
  return rule.nodes.every((n, i) => !n.pseudoElement && !n.hasConditions.length && n.states.every(s => !s.includes('(')) &&
    (i >= start || (!n.states.length && !n.attributes.length))) &&
    (rule.nodes.slice(start + 1).some(n => n.states.length || n.attributes.length) || source.attributes.length > 1 ||
      source.attributes.some(a => a.operator === 'native') || (source.attributes.length > 0 && source.states.length > 0));
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

