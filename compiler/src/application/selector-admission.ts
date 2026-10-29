import selectorParser from 'postcss-selector-parser';
import type { ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { GssDiagnostic } from '../public-types.js';
import { classifyPropertyEffect } from '../domain/property-effects.js';
import { isPureOwnershipRule } from '../domain/rule-classification.js';

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
    rule.states.some((states) => states.length > 0) ||
    rule.attributes.some((attributes) => attributes.length > 0) ||
    rule.observations.some((observations) => observations.length > 0) ||
    rule.pseudoElements.some((pseudo) => pseudo !== null))) {
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
    sameNode!.states.some((states) => states.length > 0) ||
    sameNode!.attributes.some((attributes) => attributes.length > 0) ||
    sameNode!.observations.some((observations) => observations.length > 0) ||
    sameNode!.pseudoElements.some((pseudo) => pseudo !== null))) {
    return { diagnostics: [{
      code: 'GSS1101', severity: 'error', phase: 'validate', id,
      reason: 'capability-not-registered',
      message: 'A same-node external condition requires one pure owned rule or a proven single-property base refinement.'
    }] };
  }
  return { context: { externalRules, sameNodeRules, localRules, hasExplicitGlobal } };
}
