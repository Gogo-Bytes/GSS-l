import { hasRegisteredConditions, type RuleOrderConfig } from '../domain/rule-order-planner.js';
import { scopeClassField } from './scope-exports.js';
import type { ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { GssDiagnostic } from '../public-types.js';
import { isLocalElementRule, isOwnedCurrentSubject, isAncestorStateRule, isAncestorAttributeRule, isObservedRule, isStructuralRuntimeRule, isCurrentAttributeRule, isPseudoElementRule, isCurrentStateRule, isPureOwnershipRule } from '../domain/rule-classification.js';

/** Preserve the existing external admission checks before later condition,
 * declaration, relation and fallback validation. */
export function prepareSelectorContexts(id: string, semanticRules: readonly ParsedStyleRule[], order: RuleOrderConfig, flatMixed: boolean):
  { context: { externalRules: ParsedStyleRule[]; sameNodeRules: ParsedStyleRule[]; localRules: ParsedStyleRule[]; hasExplicitGlobal: boolean } } |
  { diagnostics: readonly GssDiagnostic[] } {
  const collision = semanticRules.find(rule =>
    rule.nodes.some((node, index) => index > 0 && node.name === scopeClassField)
  );
  if (collision) {
    const { start, end } = collision.source;
    return { diagnostics: [{
      code: 'GSS1105', severity: 'error', phase: 'validate', id, range: { start, end },
      reason: 'reserved-scope-target',
      message: `Nested scope name ${scopeClassField} is reserved for the generated class string.`,
      suggestion: 'Rename this child scope.'
    }] };
  }
  const externalRules = semanticRules.filter((rule) => rule.externalTarget !== undefined);
  const sameNodeRules = semanticRules.filter((rule) => rule.externalCondition !== undefined);
  const hasExplicitGlobal = semanticRules.some(rule => rule.hasExplicitGlobal);
  const localRules = semanticRules.filter((rule) =>
    rule.externalTarget === undefined && rule.externalCondition === undefined
  );
  // External descendants require a pure owned path of descendant relations;
  // other placements/compositions remain fail-closed.
  if (externalRules.some((rule) => rule.relations.some((relation) => relation !== 'descendant') ||
    rule.nodes.some((node) => node.states.length > 0) ||
    rule.nodes.some((node) => node.attributes.length > 0) ||
    rule.nodes.some((node) => node.hasConditions.length > 0) ||
    rule.nodes.some((node) => node.pseudoElement !== null))) {
    return { diagnostics: [{
      code: 'GSS1101', severity: 'error', phase: 'validate', id,
      reason: 'capability-not-registered',
      message: 'External targets currently require a pure owned descendant path and an external class descendant.'
    }] };
  }
  // A same-node external class is a condition on the owned target, not a
  // separate ownership path. Mixed declarations need a proof of precedence
  // against that target before admission; reject the whole replacement on failure.
  const nativeExternalGroup = !localRules.length && semanticRules.every(rule => hasRegisteredConditions(rule.conditions, order) &&
    (rule.layer === null || order.layers?.includes(rule.layer)));
  if (sameNodeRules.length > 0 && ((!nativeExternalGroup && !flatMixed) ||
    sameNodeRules.some(rule => !isPureOwnershipRule(rule)))) {
    return { diagnostics: [{
      code: 'GSS1101', severity: 'error', phase: 'validate', id,
      reason: 'capability-not-registered',
      message: 'A same-node external condition requires pure external branches with registered conditions and layers, or registered writes on flat local and externally qualified elements.'
    }] };
  }
  return { context: { externalRules, sameNodeRules, localRules, hasExplicitGlobal } };
}

/** Kept separate because declaration and logical/physical checks run between
 * conditional admission and the remaining selector-shape checks. */
export function validateConditionalSelectorShapes(id: string, rules: readonly ParsedStyleRule[]):
  { diagnostics: readonly GssDiagnostic[] } | undefined {
  const unsupportedConditionCombination = rules.find((rule) =>
    rule.conditions.length > 0 &&
    !isPureOwnershipRule(rule) &&
    !isCurrentStateRule(rule) &&
    !isPseudoElementRule(rule) &&
    !isCurrentAttributeRule(rule) &&
    !isStructuralRuntimeRule(rule) &&
    !isObservedRule(rule) &&
    !isAncestorStateRule(rule) &&
    !isAncestorAttributeRule(rule)
  );
  if (unsupportedConditionCombination) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'Conditions currently support pure ownership declarations only.',
        id: id,
        reason: 'capability-not-registered'
      }]
    };
  }
  return undefined;
}

export function validateSelectorShapes(id: string, rules: readonly ParsedStyleRule[]):
  { diagnostics: readonly GssDiagnostic[] } | undefined {
  const unsupportedPseudoElement = rules.find(({
    relations,
    nodes
  }) => {
    const pseudoElementIndexes = nodes.flatMap((node, index) =>
      node.pseudoElement ? [index] : []
    );
    return pseudoElementIndexes.length > 0 && (
      pseudoElementIndexes.length !== 1 ||
      pseudoElementIndexes[0] !== nodes.length - 1 ||
      relations.some((relation) => relation !== 'descendant') ||
      nodes.slice(0, -1).some((node) => node.states.length > 0) ||
      nodes.some((node) => node.attributes.length > 0) ||
      nodes.some((node) => node.hasConditions.length > 0)
    );
  });
  if (unsupportedPseudoElement) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'A pseudo-element must terminate an ownership selector path.',
        id: id,
        reason: 'capability-not-registered'
      }]
    };
  }

  const unsupportedObservation = rules.find(({
    relations,
    nodes
  }) => {
    const observationIndexes = nodes.flatMap((node, index) =>
      node.hasConditions.length > 0 ? [index] : []
    );
    return observationIndexes.length > 0 && (
      observationIndexes.length !== 1 ||
      observationIndexes[0] !== nodes.length - 1 ||
      relations.some((relation) => relation !== 'descendant') ||
      nodes.some((node) => node.states.length > 0) ||
      nodes.some((node) => node.attributes.length > 0)
    );
  });
  if (unsupportedObservation) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'The initial :has() capability requires one simple observed local class.',
        id: id,
        reason: 'capability-not-registered'
      }]
    };
  }

  const unsupportedAttribute = rules.find(rule => {
    const { relations, nodes } = rule;
    if (isOwnedCurrentSubject(rule) || isLocalElementRule(rule)) return false;
    if (nodes.length === 1 && !nodes[0]!.pseudoElement && !nodes[0]!.hasConditions.length) return false;
    if (nodes.some(node => node.attributes.some(attr => attr.operator === 'native'))) return true;
    const attributeIndexes = nodes.flatMap((node, index) =>
      node.attributes.length > 0 ? [index] : []
    );
    const firstRuntimeRelation = relations.findIndex((relation) => relation !== 'descendant');
    return attributeIndexes.length > 0 && (
      attributeIndexes.length !== 1 ||
      nodes[attributeIndexes[0]!]!.attributes.length !== 1 ||
      nodes.length === 0 ||
      (firstRuntimeRelation >= 0 && attributeIndexes[0] !== firstRuntimeRelation) ||
      nodes.some((node) => node.states.length > 0)
    );
  });
  if (unsupportedAttribute) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'A selector may contain one presence or equality attribute on its current or runtime-source node.',
        id: id,
        reason: 'capability-not-registered'
      }]
    };
  }

  const unsupportedState = rules.find(rule => {
    if (isLocalElementRule(rule)) return false;
    const { relations, nodes } = rule;
    const stateIndexes = nodes.flatMap((node, index) => node.states.length > 0 ? [index] : []);
    const firstRuntimeRelation = relations.findIndex((relation) => relation !== 'descendant');
    return stateIndexes.length > 0 && (
      stateIndexes.length !== 1 ||
      nodes.length === 0 ||
      (firstRuntimeRelation >= 0 && stateIndexes[0] !== firstRuntimeRelation)
    );
  });
  if (unsupportedState) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'A runtime chain requires its single state to be on the chain source.',
        id: id,
        reason: 'capability-not-registered'
      }]
    };
  }

  return undefined;
}
