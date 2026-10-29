import selectorParser from 'postcss-selector-parser';
import type { CompatibilityTransformer } from '../infrastructure/lightning-compatibility-transformer.js';
import { type AssetUrlResolver } from './asset-values.js';
import { collectAssetDependencies } from './stylesheet-assets.js';
import { toLogicalModuleId } from './module-identity.js';
import { emitAtomicRules, type PlannedDeclaration } from './atomic-emission.js';
import { analyzeCompatibility } from './compatibility-analysis.js';
import { preparePreservedContribution } from './preserved-contribution.js';
import { validateRegisteredConditions } from './condition-context.js';
import { findAmbiguousKeyframeInShorthand, rewriteKeyframeReferences, planResource, type PlannedResource } from './resource-planning.js';
import { toScopeSchema, renderModuleCode, renderDeclarationCode, type MutableScopeNode } from './scope-exports.js';
import type { NameAllocatorPort } from './name-allocator.js';
import { classifyPropertyEffect, isRegisteredPropertyEffect } from '../domain/property-effects.js';
import { planModuleRelations } from '../domain/plan-module-relations.js';
import { discardInvalidStaticPadding, expandSafeBoxRules } from '../domain/expand-safe-box.js';
import { isAncestorStateRule, isAncestorAttributeRule, isObservedRule, isStructuralRuntimeRule, isCurrentAttributeRule, isPseudoElementRule, isCurrentStateRule, isPureOwnershipRule } from '../domain/rule-classification.js';
import { disjointKeyframeWidthBounds } from '../domain/keyframe-condition-exclusivity.js';
import { validateDeclarationSequences } from '../domain/validate-declarations.js';
import { validateLogicalPhysicalConflicts } from '../domain/validate-logical-physical-conflicts.js';
import type {
  ParsedKeyframesRegistration,
  SourceSpan
} from '../domain/parsed-stylesheet.js';
import type { CssParserPort } from './css-parser-port.js';
import type {
  GssCompilerConfig,
  GssDiagnostic,
  ReplaceStylesheetInput,
  StyleModuleArtifact
} from '../public-types.js';

type PlannedPreservedBlock = {
  moduleId: string;
  source: SourceSpan;
  declarationOffsets: readonly number[];
  css: string;
  renderCss?: (resolve: AssetUrlResolver) => string;
};

export type ModuleContribution = {
  artifact: StyleModuleArtifact;
  rules: readonly PlannedDeclaration[];
  preservedBlocks: readonly PlannedPreservedBlock[];
  resources: readonly PlannedResource[];
  diagnostics: readonly GssDiagnostic[];
  sourceText: string;
};

export function prepareContribution(
  config: GssCompilerConfig,
  input: ReplaceStylesheetInput,
  cssParser: CssParserPort,
  nameAllocator: NameAllocatorPort,
  compatibility?: CompatibilityTransformer
): ModuleContribution | { diagnostics: readonly GssDiagnostic[] } {
  if (config.compatibilityTargetStages !== undefined && compatibility === undefined) return { diagnostics: [{
    code: 'GSS1101', severity: 'error', phase: 'validate', id: input.id,
    reason: 'invalid-compatibility-target', message: 'Host CSS compatibility targets are invalid or unsupported.'
  }] };
  const parsed = cssParser.parseStylesheet(input.id, input.source);
  if (parsed.diagnostics.some(({ severity }) => severity === 'error')) {
    return { diagnostics: parsed.diagnostics };
  }
  const bindings = new Map<string, string>();
  const urls = new Set(collectAssetDependencies(parsed));
  for (const { url, identity } of input.assetReferences ?? []) {
    if (typeof url !== 'string' || typeof identity !== 'string' || !url || !identity ||
        !urls.has(url) || (bindings.has(url) && bindings.get(url) !== identity)) {
      return { diagnostics: [{
        code: 'GSS1501', severity: 'error', phase: 'validate', id: input.id,
        message: `Invalid or conflicting Asset reference for ${url}.`,
        reason: 'invalid-asset-reference',
        suggestion: 'Bind discovered URLs to non-empty, unambiguous logical identities.'
      }] };
    }
    bindings.set(url, identity);
  }
  const moduleId = toLogicalModuleId(config.projectRoot, input.id);
  if (moduleId === undefined) {
    return { diagnostics: [{
      code: 'GSS1401',
      severity: 'error',
      phase: 'validate',
      id: input.id,
      message: 'Cannot derive a project-relative GSS Module id.',
      reason: 'non-relative-module-identity',
      suggestion: 'Use an absolute projectRoot and a source on the same filesystem root.'
    }] };
  }
  const keyframeNames = new Map(
    parsed.resources
      .filter((resource): resource is ParsedKeyframesRegistration => resource.kind === 'keyframes')
      .map((resource) => [resource.name, nameAllocator.createKeyframesName(moduleId, resource.name)])
  );
  const ambiguousAnimation = findAmbiguousKeyframeInShorthand(parsed.rules, keyframeNames);
  if (ambiguousAnimation) return { diagnostics: [{
    code: 'GSS1101', severity: 'error', phase: 'validate', id: input.id,
    range: { start: ambiguousAnimation.source.start, end: ambiguousAnimation.source.end },
    reason: 'capability-not-registered',
    message: 'An animation shorthand word matches both a local keyframe and an animation component keyword or timeline identifier.',
    suggestion: 'Use animation-name for the local keyframe and separate longhands for other animation components.'
  }] };
  const rewrittenRules = rewriteKeyframeReferences(parsed.rules, keyframeNames);
  // Preserved/compatibility paths must keep authored declarations intact.
  const atomicRules = !compatibility && rewrittenRules.every((rule) =>
    rule.externalTarget === undefined && rule.externalCondition === undefined &&
    rule.declarations.every(({ property }) => isRegisteredPropertyEffect(property)))
    ? discardInvalidStaticPadding(rewrittenRules) : rewrittenRules;
  const semanticRules = atomicRules !== rewrittenRules && atomicRules.every(isPureOwnershipRule)
    ? expandSafeBoxRules(atomicRules) : atomicRules;
  const plannedResources = parsed.resources.map((resource) =>
    planResource(resource, moduleId, bindings, nameAllocator, compatibility));
  if (plannedResources.some((resource) => resource === undefined)) {
    return { diagnostics: [{ code: 'GSS1101', severity: 'error', phase: 'validate', id: input.id,
      reason: 'capability-not-registered', message: 'Compatibility transformation cannot preserve a resource shape or Asset identity.' }] };
  }
  const resources = plannedResources as PlannedResource[];
  const keyframeRegistrations = new Map<string, { identity: string; resource: ParsedKeyframesRegistration }[]>();
  for (const [index, resource] of parsed.resources.entries()) {
    if (resource.kind !== 'keyframes') continue;
    const identity = resources[index]!.identity;
    const previous = keyframeRegistrations.get(resource.name) ?? [];
    if (previous.some((entry) => entry.identity !== identity &&
      !disjointKeyframeWidthBounds(entry.resource, resource, config.conditions?.media ?? []))) {
      return { diagnostics: [{
        code: 'GSS1301', severity: 'error', phase: 'registry', id: input.id,
        reason: 'conflicting-global-resource',
        message: `Keyframe ${resource.name} has incompatible registrations in one Module; authored precedence cannot be preserved.`
      }] };
    }
    previous.push({ identity, resource });
    keyframeRegistrations.set(resource.name, previous);
  }
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
      code: 'GSS1101', severity: 'error', phase: 'validate', id: input.id,
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
      code: 'GSS1101', severity: 'error', phase: 'validate', id: input.id,
      reason: 'capability-not-registered',
      message: 'A same-node external condition requires one pure owned rule or a proven single-property base refinement.'
    }] };
  }
  const conditionDiagnostics = validateRegisteredConditions(
    config,
    input.id,
    parsed.rules,
    parsed.resources
  );
  const unsupportedConditionCombination = parsed.rules.find((rule) =>
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
        id: input.id,
        reason: 'capability-not-registered'
      }]
    };
  }
  const declarationDiagnostics = validateDeclarationSequences(input.id, atomicRules);
  if (declarationDiagnostics.some(({ severity }) => severity === 'error')) {
    return { diagnostics: declarationDiagnostics };
  }
  const logicalPhysicalDiagnostics = validateLogicalPhysicalConflicts(input.id, atomicRules);
  if (logicalPhysicalDiagnostics.some(({ severity }) => severity === 'error')) {
    return { diagnostics: logicalPhysicalDiagnostics };
  }

  const unsupportedPseudoElement = parsed.rules.find(({
    path,
    relations,
    states,
    attributes,
    observations,
    pseudoElements
  }) => {
    const pseudoElementIndexes = pseudoElements.flatMap((pseudoElement, index) =>
      pseudoElement ? [index] : []
    );
    return pseudoElementIndexes.length > 0 && (
      pseudoElementIndexes.length !== 1 ||
      pseudoElementIndexes[0] !== path.length - 1 ||
      relations.some((relation) => relation !== 'descendant') ||
      states.slice(0, -1).some((state) => state.length > 0) ||
      attributes.some((conditions) => conditions.length > 0) ||
      observations.some((conditions) => conditions.length > 0)
    );
  });
  if (unsupportedPseudoElement) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'A pseudo-element must terminate an ownership selector path.',
        id: input.id,
        reason: 'capability-not-registered'
      }]
    };
  }

  const unsupportedObservation = parsed.rules.find(({
    path,
    relations,
    states,
    attributes,
    observations
  }) => {
    const observationIndexes = observations.flatMap((conditions, index) =>
      conditions.length > 0 ? [index] : []
    );
    return observationIndexes.length > 0 && (
      observationIndexes.length !== 1 ||
      observationIndexes[0] !== path.length - 1 ||
      relations.some((relation) => relation !== 'descendant') ||
      states.some((state) => state.length > 0) ||
      attributes.some((conditions) => conditions.length > 0)
    );
  });
  if (unsupportedObservation) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'The initial :has() capability requires one simple observed local class.',
        id: input.id,
        reason: 'capability-not-registered'
      }]
    };
  }

  const unsupportedAttribute = parsed.rules.find(({ path, relations, states, attributes }) => {
    const attributeIndexes = attributes.flatMap((conditions, index) =>
      conditions.length > 0 ? [index] : []
    );
    const firstRuntimeRelation = relations.findIndex((relation) => relation !== 'descendant');
    return attributeIndexes.length > 0 && (
      attributeIndexes.length !== 1 ||
      attributes[attributeIndexes[0]!]!.length !== 1 ||
      path.length === 0 ||
      (firstRuntimeRelation >= 0 && attributeIndexes[0] !== firstRuntimeRelation) ||
      states.some((state) => state.length > 0)
    );
  });
  if (unsupportedAttribute) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'A selector may contain one equality attribute on its current or runtime-source node.',
        id: input.id,
        reason: 'capability-not-registered'
      }]
    };
  }

  const unsupportedState = parsed.rules.find(({ path, relations, states }) => {
    const stateIndexes = states.flatMap((state, index) => state.length > 0 ? [index] : []);
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
        id: input.id,
        reason: 'capability-not-registered'
      }]
    };
  }

  const roots = new Map<string, MutableScopeNode>();
  const relationPlanning = planModuleRelations(localRules, semanticRules);
  if ('ambiguity' in relationPlanning) return { diagnostics: [{
    code: 'GSS1205', severity: 'error', phase: 'resolve', id: input.id,
    reason: 'ambiguous-coactive-state-conflict', message: relationPlanning.ambiguity
  }] };

  const compatibilityAnalysis = analyzeCompatibility(semanticRules, bindings, compatibility);
  if ('error' in compatibilityAnalysis) {
    const preservedConflicts = validateLogicalPhysicalConflicts(input.id, parsed.rules, false);
    if (preservedConflicts.length) return { diagnostics: preservedConflicts };
    return { diagnostics: [{ code: 'GSS1101', severity: 'error', phase: 'validate', id: input.id,
      reason: 'capability-not-registered', message: compatibilityAnalysis.error === 'shape'
        ? 'Compatibility transformation cannot preserve this declaration shape.'
        : 'Compatibility transformation changed declaration importance.' }] };
  }
  const { physicalByDeclaration, compatibilityFallback } = compatibilityAnalysis;
  if (compatibilityFallback.length > 0) {
    // Preserved CSS keeps authored order, so it cannot implement the new fixed
    // logical/physical order. Retain the old conflict guard for this path.
    const preservedConflicts = validateLogicalPhysicalConflicts(input.id, parsed.rules, false);
    if (preservedConflicts.length) return { diagnostics: preservedConflicts };
    if (hasExplicitGlobal || config.atomizationFallback === 'error') {
      return { diagnostics: [{ code: 'GSS1101', severity: 'error', phase: 'validate', id: input.id,
        reason: 'capability-not-registered', message: 'Compatibility sequence cannot be safely atomized.' }] };
    }
    return preparePreservedContribution({ input, moduleId, parsed, rules: semanticRules,
      conditionDiagnostics, fallbackProperties: [], fallbackCompatibilityProperties: compatibilityFallback,
      nameAllocator, compatibility, resources });
  }

  const unsupportedProperties = [...new Set(
    semanticRules
      .flatMap(({ declarations }) => declarations.map(({ property }) => property))
      .filter((property) => !isRegisteredPropertyEffect(property))
  )].sort();
  if (unsupportedProperties.length > 0) {
    const preservedConflicts = validateLogicalPhysicalConflicts(input.id, parsed.rules, false);
    if (preservedConflicts.length) return { diagnostics: preservedConflicts };
    // Preserved-mode selector rewriting cannot safely lower :global() yet.
    if (hasExplicitGlobal || config.atomizationFallback === 'error') {
      return {
        diagnostics: [{
          code: 'GSS1101',
          severity: 'error',
          phase: 'validate',
          message: `Property effects are not registered: ${unsupportedProperties.join(', ')}.`,
          id: input.id,
          reason: 'capability-not-registered',
          suggestion: 'Register its effects or enable whole-Module preserved fallback.'
        }]
      };
    }
    return preparePreservedContribution({
      input,
      moduleId,
      parsed,
      rules: semanticRules,
      conditionDiagnostics,
      fallbackProperties: unsupportedProperties,
      nameAllocator,
      compatibility,
      resources
    });
  }

  const emission = emitAtomicRules({ id: input.id, moduleId, semanticRules, localRules, sameNodeRules,
    externalRules, relationPlan: relationPlanning.plan, bindings, nameAllocator, roots });
  if ('diagnostics' in emission) return emission;
  const { rules } = emission;

  const exports = Object.fromEntries(
    [...roots.entries()].map(([name, scope]) => [name, toScopeSchema(scope)])
  );

  const scopeSchema = { moduleId, exports };
  const artifact: StyleModuleArtifact = {
    id: input.id,
    scopeSchema,
    moduleCode: renderModuleCode(exports),
    declarationCode: renderDeclarationCode(exports),
    dependencies: collectAssetDependencies(parsed),
    compilationMode: 'atomic',
    fallbackReasons: []
  };

  return {
    artifact,
    rules: compatibility ? rules.map((rule) => ({ ...rule,
      physicalDeclarations: physicalByDeclaration.get(JSON.stringify([rule.identity.property,
        rule.identity.value, rule.identity.assetValue === true, rule.identity.important]))! })) : rules,
    preservedBlocks: [],
    resources,
    diagnostics: conditionDiagnostics,
    sourceText: input.source
  };
}
