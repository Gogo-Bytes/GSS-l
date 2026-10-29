import selectorParser from 'postcss-selector-parser';
import type { CompatibilityTransformer, PhysicalDeclaration } from '../infrastructure/lightning-compatibility-transformer.js';
import { identifyAssetValue, type AssetUrlResolver } from './asset-values.js';
import { assetOccurrences, collectAssetDependencies } from './stylesheet-assets.js';
import { toLogicalModuleId } from './module-identity.js';
import { preparePreservedContribution } from './preserved-contribution.js';
import { validateRegisteredConditions, groupRulesByCondition, canonicalCondition } from './condition-context.js';
import { renderObservedCombinator, canonicalAttributeCondition, renderAttributeCondition, renderStateSuffix, renderNativeSelector, renderRelationCombinator } from './selector-rendering.js';
import { findAmbiguousKeyframeInShorthand, rewriteKeyframeReferences, planResource, type PlannedResource } from './resource-planning.js';
import { ensureScopePath, toScopeSchema, renderModuleCode, renderDeclarationCode, type MutableScopeNode } from './scope-exports.js';
import {
  type ContextualRelationIdentity,
  type ObservedRelationIdentity,
  type PureDeclarationIdentity
} from '../domain/readable-name.js';
import type { NameAllocatorPort } from './name-allocator.js';
import { classifyPropertyEffect, isRegisteredPropertyEffect } from '../domain/property-effects.js';
import { planModuleRelations, collectModuleOrderCandidates } from '../domain/plan-module-relations.js';
import { planFixedModuleOrder } from '../domain/fixed-module-ranks.js';
import type { OrderBinding } from '../domain/order-occurrences.js';
import { discardInvalidStaticPadding, expandSafeBoxRules } from '../domain/expand-safe-box.js';
import { isAncestorStateRule, isAncestorAttributeRule, isObservedRule, isStructuralRuntimeRule, isCurrentAttributeRule, isPseudoElementRule, isCurrentStateRule, isPureOwnershipRule } from '../domain/rule-classification.js';
import { resolveTargetDeclarations } from '../domain/resolve-target-declarations.js';
import { disjointKeyframeWidthBounds } from '../domain/keyframe-condition-exclusivity.js';
import { validateDeclarationSequences } from '../domain/validate-declarations.js';
import { validateLogicalPhysicalConflicts } from '../domain/validate-logical-physical-conflicts.js';
import type {
  ParsedCondition,
  ParsedDeclaration,
  ParsedHasCondition,
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

type ContextualDeclarationIdentity = ContextualRelationIdentity & {
  property: string;
  value: string;
  assetValue?: true;
  important: boolean;
  atomRank?: number;
  orderSlot?: number;
};

type ObservedDeclarationIdentity = ObservedRelationIdentity & {
  property: string;
  value: string;
  assetValue?: true;
  important: boolean;
  atomRank?: number;
  orderSlot?: number;
};

export type PlannedDeclaration = {
  kind: 'pure-atom' | 'contextual-atom';
  identity: PureDeclarationIdentity | ContextualDeclarationIdentity | ObservedDeclarationIdentity;
  className: string;
  selector: string;
  wrappers?: readonly ParsedCondition[];
  layer?: string;
  relationRank?: number;
  physicalDeclarations?: readonly PhysicalDeclaration[];
  source: SourceSpan;
};

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
  const rules: PlannedDeclaration[] = [];
  const relationPlanning = planModuleRelations(localRules, semanticRules);
  if ('ambiguity' in relationPlanning) return { diagnostics: [{
    code: 'GSS1205', severity: 'error', phase: 'resolve', id: input.id,
    reason: 'ambiguous-coactive-state-conflict', message: relationPlanning.ambiguity
  }] };
  const { ownershipRules, hasRules, hasDescendantConditions, plannedDescendants, plannedStructural, plannedPseudos } = relationPlanning.plan;

  const physicalDeclarations = semanticRules.flatMap((rule) => rule.declarations.map((declaration) => ({
    declaration, physical: compatibility?.expand(declaration)
  })));
  if (compatibility && physicalDeclarations.some(({ declaration, physical }) =>
    physical === undefined || !physicalAssetsPreserved(declaration.value, physical))) {
    const preservedConflicts = validateLogicalPhysicalConflicts(input.id, parsed.rules, false);
    if (preservedConflicts.length) return { diagnostics: preservedConflicts };
    return { diagnostics: [{ code: 'GSS1101', severity: 'error', phase: 'validate', id: input.id,
      reason: 'capability-not-registered', message: 'Compatibility transformation cannot preserve this declaration shape.' }] };
  }
  if (compatibility && physicalDeclarations.some(({ declaration, physical }) =>
    physical?.some((entry) => entry.important !== declaration.important))) {
    const preservedConflicts = validateLogicalPhysicalConflicts(input.id, parsed.rules, false);
    if (preservedConflicts.length) return { diagnostics: preservedConflicts };
    return { diagnostics: [{ code: 'GSS1101', severity: 'error', phase: 'validate', id: input.id,
      reason: 'capability-not-registered', message: 'Compatibility transformation changed declaration importance.' }] };
  }
  const physicalByDeclaration = new Map(physicalDeclarations.filter(({ physical }) => physical !== undefined)
    .map(({ declaration, physical }) => {
      const identified = identifyAssetValue(declaration.value, bindings);
      return [JSON.stringify([declaration.property, identified.value, identified.assetValue === true, declaration.important]),
        physical!.map((entry) => ({ ...entry, ...identifyAssetValue(entry.value, bindings) }))] as const;
    }));
  const compatibilityFallback = [...new Set(physicalDeclarations.filter(({ declaration, physical }) =>
    physical?.some((entry) => entry.property !== declaration.property))
    .map(({ declaration }) => declaration.property))].sort();
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

  const moduleOrder = planFixedModuleOrder(semanticRules,
    collectModuleOrderCandidates(relationPlanning.plan, sameNodeRules, externalRules));
  const orderIdentity = (declaration: ParsedDeclaration, binding: OrderBinding) => {
    return moduleOrder.get(declaration, binding) ?? {};
  };

  if (plannedDescendants) {
    for (const rule of localRules) ensureScopePath(roots, rule.path);
    for (const instance of plannedStructural.descendants) {
      const { rule, targetPath, sourcePath, sourceIndex, relationRank } = instance;
      const wrappers = rule.conditions;
      const condition = canonicalCondition(wrappers);
      const layer = rule.layer;
      const states = sourceIndex < 0 ? [] : rule.states[sourceIndex]!;
      const attribute = sourceIndex < 0 ? undefined : rule.attributes[sourceIndex]![0];
      const suffix = attribute ? renderAttributeCondition(attribute) : renderStateSuffix(states, moduleId, nameAllocator, roots);
      const ancestor = sourcePath !== undefined && sourcePath.length < targetPath.length;
      const scope = ensureScopePath(roots, targetPath);
      if (ancestor) {
        const sourceMarker = nameAllocator.createSourceMarker(moduleId, sourcePath, condition, layer);
        const relationIdentity: ContextualRelationIdentity = {
          moduleId, layer, condition, sourcePath, targetPath,
          relations: rule.relations.slice(sourceIndex),
          ...(attribute ? { sourceAttribute: canonicalAttributeCondition(attribute) } : { sourceState: states.join(':') }),
          ...(JSON.stringify(rule.path) !== JSON.stringify(targetPath) ? { authoredPath: rule.path } : {})
        };
        const targetMarker = nameAllocator.createTargetMarker(relationIdentity);
        ensureScopePath(roots, sourcePath).classNames.add(sourceMarker);
        scope.classNames.add(targetMarker);
        // Repeat an existing marker, rather than inventing ancestors, to retain authored specificity.
        const selector = `.${sourceMarker}${suffix} ${`.${targetMarker}`.repeat(rule.path.length - 1)}`;
        for (const declaration of instance.declarations) rules.push({
          kind: 'contextual-atom', className: targetMarker, selector, wrappers, layer, relationRank,
          source: declaration.source, identity: { ...relationIdentity, ...orderIdentity(declaration, instance), property: declaration.property,
            ...identifyAssetValue(declaration.value, bindings), important: declaration.important }
        });
      } else {
        for (const declaration of instance.declarations) {
          const identity: PureDeclarationIdentity = {
            layer, condition, state: attribute ? canonicalAttributeCondition(attribute) : states.join(':') || 'self',
            ...orderIdentity(declaration, instance),
            property: declaration.property, ...identifyAssetValue(declaration.value, bindings), important: declaration.important,
            ...(rule.path.length > 1 ? { ownership: { moduleId, path: targetPath, specificity: rule.path.length } } : {})
          };
          const className = nameAllocator.createAtomicName(identity);
          scope.classNames.add(className);
          rules.push({ kind: sourceIndex < 0 ? 'pure-atom' : 'contextual-atom', identity, className,
            selector: `${`.${className}`.repeat(rule.path.length)}${suffix}`, wrappers, layer, relationRank,
            source: declaration.source });
        }
      }
    }
  }

  const ownershipGroups = groupRulesByCondition(hasDescendantConditions ? [] : ownershipRules);
  for (const groupedRules of ownershipGroups.values()) {
    const wrappers = groupedRules[0]!.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = groupedRules[0]!.layer;
    const declaredPaths = localRules
      .filter((rule) =>
        rule.layer === layer && canonicalCondition(rule.conditions) === condition
      )
      .flatMap(({ path }) => path.map((_, index) => path.slice(0, index + 1)));
    for (const target of resolveTargetDeclarations(groupedRules, declaredPaths)) {
      const scope = ensureScopePath(roots, target.path);
      for (const { rule, declaration } of target.occurrences) {
        const identity: PureDeclarationIdentity = {
          layer,
          condition,
          state: 'self',
          ...orderIdentity(declaration, { rule, targetPath: target.path }),
          property: declaration.property,
          ...identifyAssetValue(declaration.value, bindings),
          important: declaration.important
        };
        const className = nameAllocator.createAtomicName(identity);
        scope.classNames.add(className);
        rules.push({
          kind: 'pure-atom',
          identity,
          className,
          selector: `.${className}`,
          wrappers,
          layer,
          source: declaration.source
        });
      }
    }
  }

  // Declared pseudo paths remain public scopes even when no declarations survive planning.
  for (const rule of localRules) {
    if (isPseudoElementRule(rule)) ensureScopePath(roots, rule.path);
  }
  for (const instance of plannedPseudos.instances) {
    const { rule, targetPath, declarations, relationRank } = instance;
    const pseudoElement = rule.pseudoElements.at(-1)!;
    const state = rule.states.at(-1)!.join(':') || 'self';
    const wrappers = rule.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = rule.layer;
    const scope = ensureScopePath(roots, targetPath);
    for (const declaration of declarations) {
      const identity: PureDeclarationIdentity = {
        layer, condition, state, pseudoElement,
        ...orderIdentity(declaration, instance),
        property: declaration.property,
        ...identifyAssetValue(declaration.value, bindings),
        important: declaration.important,
        ...(rule.path.length > 1 ? { ownership: { moduleId, path: targetPath, specificity: rule.path.length } } : {})
      };
      const className = nameAllocator.createAtomicName(identity);
      scope.classNames.add(className);
      rules.push({
        kind: state === 'self' ? 'pure-atom' : 'contextual-atom',
        identity, className,
        // Keep authored class specificity on this target-qualified atom, not a shared weaker atom.
        selector: `${`.${className}`.repeat(rule.path.length)}${renderStateSuffix([state], moduleId, nameAllocator, roots)}::${pseudoElement}`,
        wrappers, layer, relationRank, source: declaration.source
      });
    }
  }

  for (const rule of hasRules) {
    const wrappers = rule.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = rule.layer;
    const observations = rule.observations.at(-1)!;
    const nativeSpecificity = observations.some((observation) => observation.nativeSpecificity);
    const observedSpecificity = (observation: ParsedHasCondition) => observation.observedClass
      ? 1 + Number(Boolean(observation.observedState))
      : observation.observedResidualClassCount ??
        (observation.observedResidual?.startsWith(':') || observation.observedResidual?.startsWith('[') ? 1 : 0);
    const selectorListSpecificity = observations.length > 1
      ? Math.max(...observations.map(observedSpecificity))
      : undefined;
    const branches = observations.map((observation) => {
      const relationIdentity: ObservedRelationIdentity = {
        moduleId,
        layer,
        condition,
        subjectPath: rule.path,
        relation: observation.relation,
        ...(observation.observedClass ? { observedClass: observation.observedClass } : {}),
        ...(observation.observedState ? { observedState: observation.observedState } : {}),
        ...(observation.observedResidual
          ? { observedResidual: observation.observedResidual }
          : {})
      };
      const subjectMarker = nameAllocator.createHasSubjectMarker(relationIdentity);
      ensureScopePath(roots, rule.path).classNames.add(subjectMarker);
      const observedSelector = observation.observedClass
        ? (() => {
          const observedMarker = nameAllocator.createObservedMarker(relationIdentity);
          ensureScopePath(roots, [observation.observedClass]).classNames.add(observedMarker);
          return `.${observedMarker}${observation.observedState ? `:${observation.observedState}` : ''}`;
        })()
        : renderNativeSelector(observation.observedResidual!, moduleId, nameAllocator, roots);
      const observedCombinator = renderObservedCombinator(observation.relation);
      return { observation, relationIdentity, subjectMarker, observedSelector, observedCombinator };
    });
    const nativeList = branches.map(({ observedCombinator, observedSelector }) => `${observedCombinator}${observedSelector}`).join(',');
    for (const { observation, relationIdentity, subjectMarker, observedSelector, observedCombinator } of branches) {
      const normalizedObservedSelector = selectorListSpecificity !== undefined && selectorListSpecificity > 0
        ? `:where(${observedSelector})`
        : observedSelector;
      const subjectSpecificity = rule.path.length + (selectorListSpecificity ?? 0);
      // A native complex list supplies its own maximum; zero-strength witnesses retain branch identity.
      // Simple lists keep the existing target-qualified scalar lowering.
      const selector = nativeSpecificity
        ? `${`.${subjectMarker}`.repeat(rule.path.length)}:has(${nativeList})${observations.length > 1
          ? `:where(:has(${observedCombinator}${observedSelector}))` : ''}`
        : `${`.${subjectMarker}`.repeat(subjectSpecificity)}:has(${observedCombinator}${normalizedObservedSelector})`;

      for (const declaration of rule.declarations) {
        const identity: ObservedDeclarationIdentity = {
          ...relationIdentity,
          ...orderIdentity(declaration, { rule, targetPath: rule.path, observation }),
          property: declaration.property,
          ...identifyAssetValue(declaration.value, bindings),
          important: declaration.important
        };
        rules.push({
          kind: 'contextual-atom',
          identity,
          className: subjectMarker,
          selector,
          wrappers,
          layer,
          source: declaration.source
        });
      }
    }
  }

  for (const instance of plannedStructural.instances) {
    const { rule, declarations, relationRank } = instance;
    const wrappers = rule.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = rule.layer;
    const firstRuntimeRelation = rule.relations.findIndex(
      (relation) => relation !== 'descendant'
    );
    const runtimeRelations = rule.relations.slice(firstRuntimeRelation);
    const sourcePath = rule.path.slice(0, firstRuntimeRelation + 1);
    const runtimePaths = rule.path.slice(firstRuntimeRelation);
    const sourceState = rule.states[firstRuntimeRelation]?.join(':') || undefined;
    const sourceAttributeCondition = rule.attributes[firstRuntimeRelation]?.[0];
    const sourceAttribute = sourceAttributeCondition
      ? canonicalAttributeCondition(sourceAttributeCondition)
      : undefined;
    const sourceMarker = nameAllocator.createSourceMarker(moduleId, sourcePath, condition, layer);
    const relationIdentity: ContextualRelationIdentity = {
      moduleId,
      layer,
      condition,
      relations: runtimeRelations,
      ...(sourceState ? { sourceState } : {}),
      ...(sourceAttribute ? { sourceAttribute } : {}),
      sourcePath,
      targetPath: rule.path
    };
    const targetMarker = nameAllocator.createTargetMarker(relationIdentity);
    const markers = runtimePaths.map((_, index) => {
      const path = rule.path.slice(0, firstRuntimeRelation + index + 1);
      const marker = index === 0
        ? sourceMarker
        : index === runtimePaths.length - 1
          ? targetMarker
          : nameAllocator.createContextMarker(relationIdentity, index, path);
      ensureScopePath(roots, path).classNames.add(marker);
      return marker;
    });
    const selector = markers.map((marker, index) => {
      if (index === 0) {
        // The source marker represents the whole ownership prefix, not one authored class.
        return `${`.${marker}`.repeat(sourcePath.length)}${renderStateSuffix(rule.states[firstRuntimeRelation] ?? [], moduleId, nameAllocator, roots)}${
          sourceAttributeCondition ? renderAttributeCondition(sourceAttributeCondition) : ''
        }`;
      }
      const combinator = renderRelationCombinator(runtimeRelations[index - 1]!);
      return `${combinator ? ` ${combinator} ` : ' '}.${marker}`;
    }).join('');

    for (const declaration of declarations) {
      const identity: ContextualDeclarationIdentity = {
        ...relationIdentity,
        ...orderIdentity(declaration, instance),
        property: declaration.property,
        ...identifyAssetValue(declaration.value, bindings),
        important: declaration.important
      };
      rules.push({
        kind: 'contextual-atom',
        identity,
        className: targetMarker,
        selector,
        wrappers,
        layer,
        relationRank,
        source: declaration.source
      });
    }
  }

  for (const rule of sameNodeRules) {
    const scope = ensureScopePath(roots, rule.path);
    const ancestorMarkers = rule.path.slice(0, -1).map((_, index) => {
      const path = rule.path.slice(0, index + 1);
      const marker = nameAllocator.createScopeMarker(moduleId, path);
      ensureScopePath(roots, path).classNames.add(marker);
      return marker;
    });
    const effects = new Set<string>();
    for (const declaration of rule.declarations) {
      const declarationEffects = classifyPropertyEffect(declaration.property).effects;
      if (declarationEffects.some((effect) => effects.has(effect))) {
        return { diagnostics: [{
          code: 'GSS1205', severity: 'error', phase: 'resolve', id: input.id,
          reason: 'ambiguous-coactive-state-conflict',
          message: 'Same-node external condition declarations have overlapping property effects.'
        }] };
      }
      declarationEffects.forEach((effect) => effects.add(effect));
      const identity: PureDeclarationIdentity = {
        layer: rule.layer, condition: canonicalCondition(rule.conditions),
        state: `external-condition:${rule.externalCondition!}`,
        ...orderIdentity(declaration, { rule, targetPath: rule.path }),
        ownership: { moduleId, path: rule.path, specificity: rule.path.length },
        property: declaration.property,
        ...identifyAssetValue(declaration.value, bindings),
        important: declaration.important
      };
      const className = nameAllocator.createAtomicName(identity);
      scope.classNames.add(className);
      const ownedSelector = [...ancestorMarkers, className].map((marker) => `.${marker}`).join(' ');
      rules.push({
        kind: 'contextual-atom', identity, className,
        selector: `${ownedSelector}${rule.externalCondition}`,
        wrappers: rule.conditions, layer: rule.layer, source: declaration.source
      });
    }
  }

  // External descendants receive CSS but no exported scope or generated DOM class.
  // Keep overlapping effect families fail-closed until the contextual cascade
  // planner can prove a winner across external selector branches.
  const externalEffects = new Set<string>();
  for (const rule of externalRules) {
    const scope = ensureScopePath(roots, rule.path);
    const ancestorMarkers = rule.path.slice(0, -1).map((_, index) => {
      const path = rule.path.slice(0, index + 1);
      const marker = nameAllocator.createScopeMarker(moduleId, path);
      ensureScopePath(roots, path).classNames.add(marker);
      return marker;
    });
    for (const declaration of rule.declarations) {
      const effects = classifyPropertyEffect(declaration.property).effects;
      if (effects.some((effect) => externalEffects.has(effect))) {
        return { diagnostics: [{
          code: 'GSS1205', severity: 'error', phase: 'resolve', id: input.id,
          reason: 'ambiguous-coactive-state-conflict',
          message: 'External target declarations have overlapping property effects.'
        }] };
      }
      effects.forEach((effect) => externalEffects.add(effect));
      const identity: PureDeclarationIdentity = {
        layer: rule.layer, condition: canonicalCondition(rule.conditions),
        state: `external:${rule.externalTarget!}`,
        ...orderIdentity(declaration, { rule, targetPath: rule.path }),
        ownership: { moduleId, path: rule.path, specificity: rule.path.length },
        property: declaration.property,
        ...identifyAssetValue(declaration.value, bindings),
        important: declaration.important
      };
      const className = nameAllocator.createAtomicName(identity);
      scope.classNames.add(className);
      rules.push({
        kind: 'contextual-atom', identity, className,
        selector: `${[...ancestorMarkers, className].map((marker) => `.${marker}`).join(' ')} ${rule.externalTarget}`,
        wrappers: rule.conditions, layer: rule.layer, source: declaration.source
      });
    }
  }

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

function physicalAssetsPreserved(
  authored: string, physical: readonly PhysicalDeclaration[]
): boolean {
  const original = new Set(assetOccurrences(authored).map(({ url }) => url));
  const transformed = new Set(physical.flatMap(({ value }) => assetOccurrences(value).map(({ url }) => url)));
  return original.size === transformed.size && [...original].every((url) => transformed.has(url));
}
