import selectorParser from 'postcss-selector-parser';
import type { ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { GssDiagnostic } from '../public-types.js';
import { classifyPropertyEffect } from '../domain/property-effects.js';
import { isAncestorStateRule, isAncestorAttributeRule, isObservedRule, isStructuralRuntimeRule, isCurrentAttributeRule, isPseudoElementRule, isCurrentStateRule, isPureOwnershipRule } from '../domain/rule-classification.js';

/** Preserve the existing external admission checks before later condition,
 * declaration, relation and fallback validation. */
export function prepareSelectorContexts(id: string, semanticRules: readonly ParsedStyleRule[]):
  { context: { externalRules: ParsedStyleRule[]; sameNodeRules: ParsedStyleRule[]; localRules: ParsedStyleRule[]; hasExplicitGlobal: boolean } } |
  { diagnostics: readonly GssDiagnostic[] } {
  const externalRules = semanticRules.filter((rule) => rule.externalTarget !== undefined);
  const sameNodeRules = semanticRules.filter((rule) => rule.externalCondition !== undefined);
  const hasExplicitGlobal = semanticRules.some((rule) => {
    let found = false;
    selectorParser((root) => root.walkPseudos((pseudo) => {
      if (pseudo.value === ':global') found = true;
    })).processSync(rule.selector);
    return found;
  });
  const localRules = semanticRules.filter((rule) =>
    rule.externalTarget === undefined && rule.externalCondition === undefined
  );
  // External descendants require a pure owned path of descendant relations;
  // other placements/compositions remain fail-closed.
  if (externalRules.some((rule) => rule.relations.some((relation) => relation !== 'descendant') ||
    rule.nodes.some((node) => node.states.length > 0) ||
    rule.nodes.some((node) => node.attributes.length > 0) ||
    rule.nodes.some((node) => node.observations.length > 0) ||
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
  const sameNode = sameNodeRules[0];
  const base = localRules[0];
  const simpleBaseRefinement = sameNode !== undefined && base !== undefined &&
    semanticRules.length === 2 && localRules.length === 1 && externalRules.length === 0 &&
    sameNode.path.length === 1 && base.path.length === 1 && base.path[0] === sameNode.path[0] &&
    isPureOwnershipRule(base) && base.conditions.length === 0 && base.layer === 'unlayered' &&
    base.declarations.length === 1 && sameNode.declarations.length === 1 &&
    base.declarations[0]!.property === sameNode.declarations[0]!.property &&
    classifyPropertyEffect(base.declarations[0]!.property).kind === 'longhand' &&
    !base.declarations[0]!.important && !sameNode.declarations[0]!.important;
  if (sameNodeRules.length > 0 && (sameNodeRules.length !== 1 ||
    (semanticRules.length !== 1 && !simpleBaseRefinement) ||
    sameNode!.conditions.length > 0 || sameNode!.layer !== 'unlayered' ||
    sameNode!.relations.some((relation) => relation !== 'descendant') ||
    sameNode!.nodes.some((node) => node.states.length > 0) ||
    sameNode!.nodes.some((node) => node.attributes.length > 0) ||
    sameNode!.nodes.some((node) => node.observations.length > 0) ||
    sameNode!.nodes.some((node) => node.pseudoElement !== null))) {
    return { diagnostics: [{
      code: 'GSS1101', severity: 'error', phase: 'validate', id,
      reason: 'capability-not-registered',
      message: 'A same-node external condition requires one pure owned rule or a proven single-property base refinement.'
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
    path,
    relations,
    nodes
  }) => {
    const pseudoElementIndexes = nodes.flatMap((node, index) =>
      node.pseudoElement ? [index] : []
    );
    return pseudoElementIndexes.length > 0 && (
      pseudoElementIndexes.length !== 1 ||
      pseudoElementIndexes[0] !== path.length - 1 ||
      relations.some((relation) => relation !== 'descendant') ||
      nodes.slice(0, -1).some((node) => node.states.length > 0) ||
      nodes.some((node) => node.attributes.length > 0) ||
      nodes.some((node) => node.observations.length > 0)
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
    path,
    relations,
    nodes
  }) => {
    const observationIndexes = nodes.flatMap((node, index) =>
      node.observations.length > 0 ? [index] : []
    );
    return observationIndexes.length > 0 && (
      observationIndexes.length !== 1 ||
      observationIndexes[0] !== path.length - 1 ||
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

  const unsupportedAttribute = rules.find(({ path, relations, nodes }) => {
    const attributeIndexes = nodes.flatMap((node, index) =>
      node.attributes.length > 0 ? [index] : []
    );
    const firstRuntimeRelation = relations.findIndex((relation) => relation !== 'descendant');
    return attributeIndexes.length > 0 && (
      attributeIndexes.length !== 1 ||
      nodes[attributeIndexes[0]!]!.attributes.length !== 1 ||
      path.length === 0 ||
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
        message: 'A selector may contain one equality attribute on its current or runtime-source node.',
        id: id,
        reason: 'capability-not-registered'
      }]
    };
  }

  const unsupportedState = rules.find(({ path, relations, nodes }) => {
    const stateIndexes = nodes.flatMap((node, index) => node.states.length > 0 ? [index] : []);
    const firstRuntimeRelation = relations.findIndex((relation) => relation !== 'descendant');
    return stateIndexes.length > 0 && (
      stateIndexes.length !== 1 ||
      path.length === 0 ||
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
