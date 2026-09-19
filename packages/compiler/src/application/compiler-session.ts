import selectorParser from 'postcss-selector-parser';
import valueParser from 'postcss-value-parser';
import {
  createReadableAtomicName,
  createReadableContextMarker,
  createReadableHasSubjectMarker,
  createReadableKeyframesName,
  createReadableObservedMarker,
  createReadableSourceMarker,
  createReadableScopeMarker,
  createReadableTargetMarker,
  type ContextualRelationIdentity,
  type ObservedRelationIdentity,
  type PureDeclarationIdentity
} from '../domain/readable-name.js';
import { isRegisteredPropertyEffect } from '../domain/property-effects.js';
import { resolveTargetDeclarations } from '../domain/resolve-target-declarations.js';
import { compareRuleOrder } from '../domain/rule-order-planner.js';
import { validateDeclarationSequences } from '../domain/validate-declarations.js';
import { validateLogicalPhysicalConflicts } from '../domain/validate-logical-physical-conflicts.js';
import { validateStateAmbiguity } from '../domain/validate-state-ambiguity.js';
import {
  parseStylesheet,
  type ParsedAttributeCondition,
  type ParsedCondition,
  type ParsedFontFaceResource,
  type ParsedGlobalResource,
  type ParsedKeyframesRegistration,
  type ParsedPropertyRegistration,
  type ParsedStylesheet,
  type ParsedStyleRule
} from '../infrastructure/postcss-stylesheet-parser.js';
import type {
  FinalizedGssSnapshot,
  GssCompilerConfig,
  GssCompilerSession,
  GssDiagnostic,
  ReplaceStylesheetInput,
  ScopeNodeSchema,
  StyleModuleArtifact
} from '../public-types.js';

type ContextualDeclarationIdentity = ContextualRelationIdentity & {
  property: string;
  value: string;
  important: boolean;
};

type ObservedDeclarationIdentity = ObservedRelationIdentity & {
  property: string;
  value: string;
  important: boolean;
};

type PlannedDeclaration = {
  kind: 'pure-atom' | 'contextual-atom';
  identity: PureDeclarationIdentity | ContextualDeclarationIdentity | ObservedDeclarationIdentity;
  className: string;
  selector: string;
  wrappers?: readonly ParsedCondition[];
  layer?: string;
};

type PlannedResource = {
  kind: 'property' | 'keyframes' | 'font-face';
  name: string;
  conflictKey?: string;
  identity: string;
  css: string;
};

type PlannedPreservedBlock = {
  moduleId: string;
  css: string;
};

type ModuleContribution = {
  artifact: StyleModuleArtifact;
  rules: readonly PlannedDeclaration[];
  preservedBlocks: readonly PlannedPreservedBlock[];
  resources: readonly PlannedResource[];
  diagnostics: readonly GssDiagnostic[];
};

type MutableScopeNode = {
  classNames: Set<string>;
  targets: Map<string, MutableScopeNode>;
};

export function createGssCompilerSession(config: GssCompilerConfig): GssCompilerSession {
  const modules = new Map<string, ModuleContribution>();
  let generation = 0;

  return {
    replaceStylesheet(input) {
      const prepared = prepareContribution(config, input);
      if (!('artifact' in prepared)) {
        return {
          id: input.id,
          committed: false,
          generation,
          diagnostics: prepared.diagnostics
        };
      }

      const conflictingResource = findConflictingResource(modules, input.id, prepared.resources);
      if (conflictingResource) {
        return {
          id: input.id,
          committed: false,
          generation,
          diagnostics: [{
            code: 'GSS1301',
            severity: 'error',
            phase: 'registry',
            message: `Global resource ${conflictingResource} has incompatible registrations.`,
            id: input.id,
            reason: 'conflicting-global-resource',
            suggestion: 'Keep one project-wide registration with identical descriptors.'
          }]
        };
      }

      modules.set(input.id, prepared);
      generation += 1;
      return {
        id: input.id,
        committed: true,
        generation,
        module: prepared.artifact,
        diagnostics: prepared.diagnostics
      };
    },

    invalidate(moduleId) {
      const changed = modules.delete(moduleId);
      if (changed) generation += 1;
      return { id: moduleId, changed, generation };
    },

    getScopeSchema(moduleId) {
      return modules.get(moduleId)?.artifact.scopeSchema;
    },

    finalize() {
      return finalizeSnapshot(modules, generation, config);
    }
  };
}

function prepareContribution(
  config: GssCompilerConfig,
  input: ReplaceStylesheetInput
): ModuleContribution | { diagnostics: readonly GssDiagnostic[] } {
  const parsed = parseStylesheet(input.id, input.source);
  if (parsed.diagnostics.some(({ severity }) => severity === 'error')) {
    return { diagnostics: parsed.diagnostics };
  }
  const moduleId = toLogicalModuleId(config.projectRoot, input.id);
  const keyframeNames = new Map(
    parsed.resources
      .filter((resource): resource is ParsedKeyframesRegistration => resource.kind === 'keyframes')
      .map((resource) => [resource.name, createReadableKeyframesName(moduleId, resource.name)])
  );
  const semanticRules = rewriteKeyframeReferences(parsed.rules, keyframeNames);
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
  const declarationDiagnostics = validateDeclarationSequences(input.id, parsed.rules);
  if (declarationDiagnostics.some(({ severity }) => severity === 'error')) {
    return { diagnostics: declarationDiagnostics };
  }
  const logicalPhysicalDiagnostics = validateLogicalPhysicalConflicts(input.id, parsed.rules);
  if (logicalPhysicalDiagnostics.some(({ severity }) => severity === 'error')) {
    return { diagnostics: logicalPhysicalDiagnostics };
  }
  const stateDiagnostics = validateStateAmbiguity(input.id, parsed.rules);
  if (stateDiagnostics.some(({ severity }) => severity === 'error')) {
    return { diagnostics: stateDiagnostics };
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
  const ownershipRules = semanticRules.filter(isPureOwnershipRule);
  const stateRules = semanticRules.filter(isCurrentStateRule);
  const ancestorStateRules = semanticRules.filter(({ relations, states }) =>
    relations.every((relation) => relation === 'descendant') &&
    states.slice(0, -1).some((state) => state.length > 0)
  );
  const attributeRules = semanticRules.filter(({ relations, attributes }) =>
    relations.every((relation) => relation === 'descendant') &&
    attributes.at(-1)?.length
  );
  const ancestorAttributeRules = semanticRules.filter(({ relations, attributes }) =>
    relations.every((relation) => relation === 'descendant') &&
    attributes.slice(0, -1).some((conditions) => conditions.length > 0)
  );
  const hasRules = semanticRules.filter(({ observations }) =>
    observations.at(-1)?.length
  );
  const pseudoElementRules = semanticRules.filter(({ pseudoElements }) =>
    pseudoElements.at(-1)
  );
  const contextualRules = semanticRules.filter(({ relations }) =>
    relations.some((relation) => relation !== 'descendant')
  );
  const unsupportedRelation = contextualRules.find(({ relations }) => {
    const firstRuntimeRelation = relations.findIndex((relation) => relation !== 'descendant');
    return relations.slice(firstRuntimeRelation).some((relation) => relation === 'descendant');
  });
  if (unsupportedRelation) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'Ownership relations must precede the runtime-relation suffix.',
        id: input.id,
        reason: 'capability-not-registered'
      }]
    };
  }

  const unsupportedProperty = semanticRules
    .flatMap(({ declarations }) => declarations)
    .find(({ property }) => !isRegisteredPropertyEffect(property));
  if (unsupportedProperty) {
    if (config.atomizationFallback === 'error') {
      return {
        diagnostics: [{
          code: 'GSS1101',
          severity: 'error',
          phase: 'validate',
          message: `Property effect ${unsupportedProperty.property} is not registered.`,
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
      fallbackProperty: unsupportedProperty.property
    });
  }

  const ownershipGroups = groupRulesByCondition(ownershipRules);
  for (const groupedRules of ownershipGroups.values()) {
    const wrappers = groupedRules[0]!.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = groupedRules[0]!.layer;
    const declaredPaths = semanticRules
      .filter((rule) =>
        rule.layer === layer && canonicalCondition(rule.conditions) === condition
      )
      .map(({ path }) => path);
    for (const target of resolveTargetDeclarations(groupedRules, declaredPaths)) {
      const scope = ensureScopePath(roots, target.path);
      for (const declaration of target.declarations) {
        const identity: PureDeclarationIdentity = {
          layer,
          condition,
          state: 'self',
          property: declaration.property,
          value: declaration.value,
          important: declaration.important
        };
        const className = createReadableAtomicName(identity);
        scope.classNames.add(className);
        rules.push({
          kind: 'pure-atom',
          identity,
          className,
          selector: `.${className}`,
          wrappers,
          layer
        });
      }
    }
  }

  const stateGroups = new Map<string, typeof stateRules>();
  for (const rule of stateRules) {
    const state = rule.states.at(-1)!.join(':');
    const key = `${rule.layer}\0${canonicalCondition(rule.conditions)}\0${state}`;
    stateGroups.set(key, [...(stateGroups.get(key) ?? []), rule]);
  }
  for (const groupedRules of stateGroups.values()) {
    const state = groupedRules[0]!.states.at(-1)!.join(':');
    const wrappers = groupedRules[0]!.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = groupedRules[0]!.layer;
    for (const target of resolveTargetDeclarations(
      groupedRules,
      groupedRules.map(({ path }) => path)
    )) {
      const scope = ensureScopePath(roots, target.path);
      for (const declaration of target.declarations) {
        const identity: PureDeclarationIdentity = {
          layer,
          condition,
          state,
          property: declaration.property,
          value: declaration.value,
          important: declaration.important
        };
        const className = createReadableAtomicName(identity);
        scope.classNames.add(className);
        rules.push({
          kind: 'contextual-atom',
          identity,
          className,
          selector: `.${className}:${state}`,
          wrappers,
          layer
        });
      }
    }
  }

  const pseudoElementGroups = new Map<string, typeof pseudoElementRules>();
  for (const rule of pseudoElementRules) {
    const pseudoElement = rule.pseudoElements.at(-1);
    if (!pseudoElement) throw new Error('GSS invariant: pseudo-element rule lost its target.');
    const state = rule.states.at(-1)!.join(':') || 'self';
    const key = `${rule.layer}\0${canonicalCondition(rule.conditions)}\0${pseudoElement}\0${state}`;
    pseudoElementGroups.set(key, [...(pseudoElementGroups.get(key) ?? []), rule]);
  }
  for (const groupedRules of pseudoElementGroups.values()) {
    const pseudoElement = groupedRules[0]!.pseudoElements.at(-1);
    if (!pseudoElement) throw new Error('GSS invariant: pseudo-element group lost its target.');
    const state = groupedRules[0]!.states.at(-1)!.join(':') || 'self';
    const wrappers = groupedRules[0]!.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = groupedRules[0]!.layer;
    for (const target of resolveTargetDeclarations(
      groupedRules,
      groupedRules.map(({ path }) => path)
    )) {
      const scope = ensureScopePath(roots, target.path);
      for (const declaration of target.declarations) {
        const identity: PureDeclarationIdentity = {
          layer,
          condition,
          state,
          pseudoElement,
          property: declaration.property,
          value: declaration.value,
          important: declaration.important
        };
        const className = createReadableAtomicName(identity);
        scope.classNames.add(className);
        rules.push({
          kind: state === 'self' ? 'pure-atom' : 'contextual-atom',
          identity,
          className,
          selector: `.${className}${state === 'self' ? '' : `:${state}`}::${pseudoElement}`,
          wrappers,
          layer
        });
      }
    }
  }

  for (const rule of hasRules) {
    const wrappers = rule.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = rule.layer;
    for (const observation of rule.observations.at(-1)!) {
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
      const subjectMarker = createReadableHasSubjectMarker(relationIdentity);
      ensureScopePath(roots, rule.path).classNames.add(subjectMarker);
      const observedSelector = observation.observedClass
        ? (() => {
          const observedMarker = createReadableObservedMarker(relationIdentity);
          ensureScopePath(roots, [observation.observedClass]).classNames.add(observedMarker);
          return `.${observedMarker}${observation.observedState ? `:${observation.observedState}` : ''}`;
        })()
        : observation.observedResidual!;
      const observedCombinator = renderObservedCombinator(observation.relation);
      const selector = `.${subjectMarker}:has(${observedCombinator}${observedSelector})`;

      for (const declaration of rule.declarations) {
        const identity: ObservedDeclarationIdentity = {
          ...relationIdentity,
          property: declaration.property,
          value: declaration.value,
          important: declaration.important
        };
        rules.push({
          kind: 'contextual-atom',
          identity,
          className: subjectMarker,
          selector,
          wrappers,
          layer
        });
      }
    }
  }

  const attributeGroups = new Map<string, typeof attributeRules>();
  for (const rule of attributeRules) {
    const condition = rule.attributes.at(-1)![0]!;
    const key = `${rule.layer}\0${canonicalCondition(rule.conditions)}\0${canonicalAttributeCondition(condition)}`;
    attributeGroups.set(key, [...(attributeGroups.get(key) ?? []), rule]);
  }
  for (const groupedRules of attributeGroups.values()) {
    const attributeCondition = groupedRules[0]!.attributes.at(-1)![0]!;
    const state = canonicalAttributeCondition(attributeCondition);
    const wrappers = groupedRules[0]!.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = groupedRules[0]!.layer;
    for (const target of resolveTargetDeclarations(
      groupedRules,
      groupedRules.map(({ path }) => path)
    )) {
      const scope = ensureScopePath(roots, target.path);
      for (const declaration of target.declarations) {
        const identity: PureDeclarationIdentity = {
          layer,
          condition,
          state,
          property: declaration.property,
          value: declaration.value,
          important: declaration.important
        };
        const className = createReadableAtomicName(identity);
        scope.classNames.add(className);
        rules.push({
          kind: 'contextual-atom',
          identity,
          className,
          selector: `.${className}${renderAttributeCondition(attributeCondition)}`,
          wrappers,
          layer
        });
      }
    }
  }

  for (const rule of ancestorAttributeRules) {
    const wrappers = rule.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = rule.layer;
    const sourceIndex = rule.attributes.findIndex((conditions) => conditions.length > 0);
    const sourceCondition = rule.attributes[sourceIndex]![0]!;
    const sourceAttribute = canonicalAttributeCondition(sourceCondition);
    const sourcePath = rule.path.slice(0, sourceIndex + 1);
    const sourceMarker = createReadableSourceMarker(moduleId, sourcePath, condition, layer);
    const relationIdentity: ContextualRelationIdentity = {
      moduleId,
      layer,
      condition,
      relations: rule.relations.slice(sourceIndex),
      sourceAttribute,
      sourcePath,
      targetPath: rule.path
    };
    const targetMarker = createReadableTargetMarker(relationIdentity);
    ensureScopePath(roots, sourcePath).classNames.add(sourceMarker);
    ensureScopePath(roots, rule.path).classNames.add(targetMarker);
    const selector = `.${sourceMarker}${renderAttributeCondition(sourceCondition)} .${targetMarker}`;

    for (const declaration of rule.declarations) {
      const identity: ContextualDeclarationIdentity = {
        ...relationIdentity,
        property: declaration.property,
        value: declaration.value,
        important: declaration.important
      };
      rules.push({
        kind: 'contextual-atom',
        identity,
        className: targetMarker,
        selector,
        wrappers,
        layer
      });
    }
  }

  for (const rule of ancestorStateRules) {
    const wrappers = rule.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = rule.layer;
    const sourceIndex = rule.states.findIndex((state) => state.length > 0);
    const sourceState = rule.states[sourceIndex]!.join(':');
    const sourcePath = rule.path.slice(0, sourceIndex + 1);
    const sourceMarker = createReadableSourceMarker(moduleId, sourcePath, condition, layer);
    const relationIdentity: ContextualRelationIdentity = {
      moduleId,
      layer,
      condition,
      relations: rule.relations.slice(sourceIndex),
      sourceState,
      sourcePath,
      targetPath: rule.path
    };
    const targetMarker = createReadableTargetMarker(relationIdentity);
    ensureScopePath(roots, sourcePath).classNames.add(sourceMarker);
    ensureScopePath(roots, rule.path).classNames.add(targetMarker);
    const selector = `.${sourceMarker}:${sourceState} .${targetMarker}`;

    for (const declaration of rule.declarations) {
      const identity: ContextualDeclarationIdentity = {
        ...relationIdentity,
        property: declaration.property,
        value: declaration.value,
        important: declaration.important
      };
      rules.push({
        kind: 'contextual-atom',
        identity,
        className: targetMarker,
        selector,
        wrappers,
        layer
      });
    }
  }

  for (const rule of contextualRules) {
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
    const sourceMarker = createReadableSourceMarker(moduleId, sourcePath, condition, layer);
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
    const targetMarker = createReadableTargetMarker(relationIdentity);
    const markers = runtimePaths.map((_, index) => {
      const path = rule.path.slice(0, firstRuntimeRelation + index + 1);
      const marker = index === 0
        ? sourceMarker
        : index === runtimePaths.length - 1
          ? targetMarker
          : createReadableContextMarker(relationIdentity, index, path);
      ensureScopePath(roots, path).classNames.add(marker);
      return marker;
    });
    const selector = markers.map((marker, index) =>
      index === 0
        ? `.${marker}${sourceState ? `:${sourceState}` : ''}${
          sourceAttributeCondition ? renderAttributeCondition(sourceAttributeCondition) : ''
        }`
        : ` ${renderRelationCombinator(runtimeRelations[index - 1]!)} .${marker}`
    ).join('');

    for (const declaration of rule.declarations) {
      const identity: ContextualDeclarationIdentity = {
        ...relationIdentity,
        property: declaration.property,
        value: declaration.value,
        important: declaration.important
      };
      rules.push({
        kind: 'contextual-atom',
        identity,
        className: targetMarker,
        selector,
        wrappers,
        layer
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

  const resources = parsed.resources.map((resource) => planResource(resource, moduleId));
  return {
    artifact,
    rules,
    preservedBlocks: [],
    resources,
    diagnostics: conditionDiagnostics
  };
}

function preparePreservedContribution(input: {
  input: ReplaceStylesheetInput;
  moduleId: string;
  parsed: ParsedStylesheet;
  rules: readonly ParsedStyleRule[];
  conditionDiagnostics: readonly GssDiagnostic[];
  fallbackProperty: string;
}): ModuleContribution {
  const roots = new Map<string, MutableScopeNode>();
  for (const rule of input.rules) {
    for (let index = 0; index < rule.path.length; index += 1) {
      const path = rule.path.slice(0, index + 1);
      ensureScopePath(roots, path).classNames.add(createReadableScopeMarker(input.moduleId, path));
    }
    for (const observation of rule.observations.flat()) {
      if (!observation.observedClass) continue;
      const path = [observation.observedClass];
      ensureScopePath(roots, path).classNames.add(createReadableScopeMarker(input.moduleId, path));
    }
  }

  const exports = Object.fromEntries(
    [...roots.entries()].map(([name, scope]) => [name, toScopeSchema(scope)])
  );
  const css = [...input.rules]
    .sort((left, right) => left.sourceOrdinal - right.sourceOrdinal)
    .map((rule) => renderPreservedRule(rule, input.moduleId))
    .join('\n\n');
  const fallbackReason = {
    property: input.fallbackProperty,
    reason: 'property-effect-not-registered' as const
  };
  const scopeSchema = { moduleId: input.moduleId, exports };
  const artifact: StyleModuleArtifact = {
    id: input.input.id,
    scopeSchema,
    moduleCode: renderModuleCode(exports),
    declarationCode: renderDeclarationCode(exports),
    dependencies: collectAssetDependencies(input.parsed),
    compilationMode: 'preserved',
    fallbackReasons: [fallbackReason]
  };
  const resources = input.parsed.resources.map((resource) =>
    planResource(resource, input.moduleId)
  );
  return {
    artifact,
    rules: [],
    preservedBlocks: [{ moduleId: input.moduleId, css }],
    resources,
    diagnostics: [
      ...input.conditionDiagnostics,
      {
        code: 'GSS1104',
        severity: 'warning',
        phase: 'plan',
        message: `Module was preserved because property effect ${input.fallbackProperty} is not registered.`,
        id: input.input.id,
        reason: 'module-preserved-fallback',
        suggestion: 'Verify the property name or register its complete effect family.'
      }
    ]
  };
}

function renderPreservedRule(rule: ParsedStyleRule, moduleId: string): string {
  const selector = selectorParser((root) => {
    for (const branch of root.nodes) {
      let pathIndex = 0;
      for (const node of branch.nodes) {
        if (node.type === 'class') {
          pathIndex += 1;
          node.value = createReadableScopeMarker(moduleId, rule.path.slice(0, pathIndex));
          continue;
        }
        if (node.type !== 'pseudo' || node.value !== ':has') continue;
        node.walkClasses((observed) => {
          observed.value = createReadableScopeMarker(moduleId, [observed.value]);
        });
      }
    }
  }).processSync(rule.selector);
  const declarations = rule.declarations
    .map(({ property, value, important }) =>
      `  ${property}: ${value}${important ? ' !important' : ''};`
    )
    .join('\n');
  let css = `${selector} {\n${declarations}\n}`;
  for (const condition of [...rule.conditions].reverse()) {
    css = `@${condition.kind} ${condition.query} {\n${indentCss(css)}\n}`;
  }
  if (rule.layer !== 'unlayered') {
    css = `@layer ${rule.layer} {\n${indentCss(css)}\n}`;
  }
  return css;
}

function rewriteKeyframeReferences(
  rules: readonly ParsedStyleRule[],
  keyframeNames: ReadonlyMap<string, string>
): readonly ParsedStyleRule[] {
  return rules.map((rule) => ({
    ...rule,
    declarations: rule.declarations.map((declaration) => {
      if (declaration.property !== 'animation-name' && declaration.property !== 'animation') {
        return declaration;
      }
      const parsedValue = valueParser(declaration.value);
      for (const node of parsedValue.nodes) {
        if (node.type !== 'word') continue;
        const generatedName = keyframeNames.get(node.value);
        if (generatedName) node.value = generatedName;
      }
      return { ...declaration, value: parsedValue.toString() };
    })
  }));
}

function planResource(resource: ParsedGlobalResource, moduleId: string): PlannedResource {
  if (resource.kind === 'property') return planPropertyRegistration(resource);
  if (resource.kind === 'keyframes') return planKeyframesRegistration(resource, moduleId);
  return planFontFaceResource(resource);
}

function planPropertyRegistration(resource: ParsedPropertyRegistration): PlannedResource {
  const declarations = resource.declarations
    .map(({ property, value }) => `  ${property}: ${value};`)
    .join('\n');
  return {
    kind: resource.kind,
    name: resource.name,
    conflictKey: `property:${resource.name}`,
    identity: JSON.stringify([
      resource.kind,
      resource.name,
      resource.declarations.map(({ property, value }) => [property, value])
    ]),
    css: `@property ${resource.name} {\n${declarations}\n}`
  };
}

function planFontFaceResource(resource: ParsedFontFaceResource): PlannedResource {
  const descriptor = (name: string, fallback: string): string =>
    resource.declarations.find(({ property }) => property === name)?.value ?? fallback;
  const signature = [
    descriptor('font-family', ''),
    descriptor('font-style', 'normal'),
    descriptor('font-weight', 'normal'),
    descriptor('font-stretch', 'normal'),
    descriptor('unicode-range', 'all')
  ].join('|');
  const declarations = resource.declarations
    .map(({ property, value }) => `  ${property}: ${value};`)
    .join('\n');
  return {
    kind: resource.kind,
    name: signature,
    conflictKey: `font-face:${signature}`,
    identity: JSON.stringify([
      resource.kind,
      resource.declarations.map(({ property, value }) => [property, value])
    ]),
    css: `@font-face {\n${declarations}\n}`
  };
}

function collectAssetDependencies(parsed: ParsedStylesheet): readonly string[] {
  const values = [
    ...parsed.rules.flatMap((rule) => rule.declarations.map(({ value }) => value)),
    ...parsed.resources.flatMap((resource) => {
      if (resource.kind === 'keyframes') {
        return resource.frames.flatMap((frame) =>
          frame.declarations.map(({ value }) => value)
        );
      }
      return resource.declarations.map(({ value }) => value);
    })
  ];
  const dependencies = new Set<string>();
  for (const value of values) {
    valueParser(value).walk((node) => {
      if (node.type !== 'function' || node.value.toLowerCase() !== 'url') return;
      const url = valueParser.stringify(node.nodes).trim().replace(/^(['"])(.*)\1$/, '$2');
      if (url) dependencies.add(url);
    });
  }
  return [...dependencies];
}

function planKeyframesRegistration(
  resource: ParsedKeyframesRegistration,
  moduleId: string
): PlannedResource {
  const generatedName = createReadableKeyframesName(moduleId, resource.name);
  const frames = resource.frames.map((frame) => {
    const declarations = frame.declarations
      .map(({ property, value }) => `    ${property}: ${value};`)
      .join('\n');
    return `  ${frame.selector} {\n${declarations}\n  }`;
  }).join('\n');
  let css = `@keyframes ${generatedName} {\n${frames}\n}`;
  for (const condition of [...resource.conditions].reverse()) {
    css = `@${condition.kind} ${condition.query} {\n${indentCss(css)}\n}`;
  }
  if (resource.layer !== 'unlayered') {
    css = `@layer ${resource.layer} {\n${indentCss(css)}\n}`;
  }
  return {
    kind: resource.kind,
    name: generatedName,
    identity: JSON.stringify([
      resource.kind,
      moduleId,
      resource.name,
      resource.layer,
      resource.conditions,
      resource.frames
    ]),
    css
  };
}

function findConflictingResource(
  modules: ReadonlyMap<string, ModuleContribution>,
  replacingId: string,
  incoming: readonly PlannedResource[]
): string | undefined {
  const incomingByName = new Map<string, string>();
  for (const resource of incoming) {
    if (!resource.conflictKey) continue;
    const previous = incomingByName.get(resource.conflictKey);
    if (previous && previous !== resource.identity) return resource.name;
    incomingByName.set(resource.conflictKey, resource.identity);
    for (const [moduleId, contribution] of modules) {
      if (moduleId === replacingId) continue;
      const conflict = contribution.resources.find((registered) =>
        registered.conflictKey === resource.conflictKey &&
        registered.identity !== resource.identity
      );
      if (conflict) return resource.name;
    }
  }
  return undefined;
}

function isAncestorStateRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.states.slice(0, -1).some((state) => state.length > 0);
}

function isAncestorAttributeRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.attributes.slice(0, -1).some((conditions) => conditions.length > 0);
}

function isObservedRule(rule: ParsedStyleRule): boolean {
  return rule.observations.at(-1)!.length > 0;
}

function isStructuralRuntimeRule(rule: ParsedStyleRule): boolean {
  return rule.relations.some((relation) => relation !== 'descendant') &&
    rule.observations.every((conditions) => conditions.length === 0) &&
    rule.pseudoElements.every((pseudoElement) => pseudoElement === null);
}

function isCurrentAttributeRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.attributes.at(-1)!.length === 1 &&
    rule.attributes.slice(0, -1).every((conditions) => conditions.length === 0) &&
    rule.states.every((state) => state.length === 0) &&
    rule.observations.every((conditions) => conditions.length === 0) &&
    rule.pseudoElements.every((pseudoElement) => pseudoElement === null);
}

function isPseudoElementRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    Boolean(rule.pseudoElements.at(-1)) &&
    rule.pseudoElements.slice(0, -1).every((pseudoElement) => pseudoElement === null) &&
    rule.states.slice(0, -1).every((state) => state.length === 0) &&
    rule.attributes.every((conditions) => conditions.length === 0) &&
    rule.observations.every((conditions) => conditions.length === 0);
}

function isCurrentStateRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.states.at(-1)!.length > 0 &&
    rule.states.slice(0, -1).every((state) => state.length === 0) &&
    rule.attributes.every((conditions) => conditions.length === 0) &&
    rule.observations.every((conditions) => conditions.length === 0) &&
    rule.pseudoElements.every((pseudoElement) => pseudoElement === null);
}

function isPureOwnershipRule(rule: ParsedStyleRule): boolean {
  return rule.relations.every((relation) => relation === 'descendant') &&
    rule.states.every((state) => state.length === 0) &&
    rule.attributes.every((conditions) => conditions.length === 0) &&
    rule.observations.every((conditions) => conditions.length === 0) &&
    rule.pseudoElements.every((pseudoElement) => pseudoElement === null);
}

function validateRegisteredConditions(
  config: GssCompilerConfig,
  id: string,
  rules: readonly ParsedStyleRule[],
  resources: readonly ParsedGlobalResource[]
): readonly GssDiagnostic[] {
  const unregistered = new Map<string, ParsedCondition>();
  const conditionContexts = [
    ...rules.map(({ conditions }) => conditions),
    ...resources.flatMap((resource) =>
      resource.kind === 'keyframes' ? [resource.conditions] : []
    )
  ];
  for (const conditions of conditionContexts) {
    for (const condition of conditions) {
      const registered = new Set(config.conditions?.[condition.kind] ?? []);
      if (!registered.has(condition.query)) {
        unregistered.set(`${condition.kind}\0${condition.query}`, condition);
      }
    }
  }
  const conditionDiagnostics: GssDiagnostic[] = [...unregistered.values()]
    .sort((left, right) =>
      `${left.kind}\0${left.query}`.localeCompare(`${right.kind}\0${right.query}`)
    )
    .map(({ kind, query }) => ({
      code: 'GSS1102',
      severity: 'warning',
      phase: 'validate',
      message: `@${kind} ${query} is not registered; its relative precedence is not guaranteed.`,
      id,
      reason: 'condition-not-registered',
      suggestion: `Add the exact query to compiler conditions.${kind} in project precedence order.`
    }));

  const registeredLayers = new Set(config.layers ?? []);
  const resourceLayers = resources.flatMap((resource) =>
    resource.kind === 'keyframes' ? [resource.layer] : []
  );
  const unregisteredLayers = new Set(
    [...rules.map(({ layer }) => layer), ...resourceLayers].filter((layer) =>
      layer !== 'unlayered' && !registeredLayers.has(layer)
    )
  );
  const layerDiagnostics: GssDiagnostic[] = [...unregisteredLayers].sort().map((layer) => ({
    code: 'GSS1103',
    severity: 'warning',
    phase: 'validate',
    message: `@layer ${layer} is not registered; its relative precedence is not guaranteed.`,
    id,
    reason: 'layer-not-registered',
    suggestion: 'Add the canonical layer name to compiler layers in project precedence order.'
  }));

  return [...conditionDiagnostics, ...layerDiagnostics];
}

function groupRulesByCondition(
  rules: readonly ParsedStyleRule[]
): ReadonlyMap<string, readonly ParsedStyleRule[]> {
  const groups = new Map<string, ParsedStyleRule[]>();
  for (const rule of rules) {
    const key = `${rule.layer}\0${canonicalCondition(rule.conditions)}`;
    groups.set(key, [...(groups.get(key) ?? []), rule]);
  }
  return groups;
}

function canonicalCondition(conditions: readonly ParsedCondition[]): string {
  return conditions.length === 0
    ? 'base'
    : conditions.map(({ kind, query }) => `${kind}:${query}`).join('&&');
}

function ensureScopePath(
  roots: Map<string, MutableScopeNode>,
  path: readonly string[]
): MutableScopeNode {
  let siblings = roots;
  let current: MutableScopeNode | undefined;
  for (const name of path) {
    current = siblings.get(name) ?? { classNames: new Set(), targets: new Map() };
    siblings.set(name, current);
    siblings = current.targets;
  }
  if (!current) throw new Error('GSS invariant: selector path must not be empty.');
  return current;
}

function toScopeSchema(scope: MutableScopeNode): ScopeNodeSchema {
  return {
    selfClassName: [...scope.classNames].sort().join(' '),
    targets: Object.fromEntries(
      [...scope.targets.entries()].map(([name, target]) => [name, toScopeSchema(target)])
    )
  };
}

function finalizeSnapshot(
  modules: ReadonlyMap<string, ModuleContribution>,
  generation: number,
  config: GssCompilerConfig
): FinalizedGssSnapshot {
  const uniqueResources = new Map<string, {
    resource: PlannedResource;
    sources: Set<string>;
  }>();
  for (const contribution of modules.values()) {
    for (const resource of contribution.resources) {
      const registered = uniqueResources.get(resource.identity) ?? {
        resource,
        sources: new Set<string>()
      };
      registered.sources.add(contribution.artifact.scopeSchema.moduleId);
      uniqueResources.set(resource.identity, registered);
    }
  }
  const orderedResources = [...uniqueResources.values()]
    .sort((left, right) => left.resource.identity.localeCompare(right.resource.identity));
  const renderedResources = orderedResources
    .map(({ resource }) => resource.css)
    .join('\n\n');

  const uniqueRules = new Map<string, {
    rule: PlannedDeclaration;
    sources: Set<string>;
  }>();
  for (const contribution of modules.values()) {
    for (const rule of contribution.rules) {
      const key = serializeIdentity(rule.identity);
      const registered = uniqueRules.get(key) ?? { rule, sources: new Set<string>() };
      registered.sources.add(contribution.artifact.scopeSchema.moduleId);
      uniqueRules.set(key, registered);
    }
  }

  const orderedRules = [...uniqueRules.values()].sort((left, right) =>
    compareRuleOrder(left.rule, right.rule, config)
  );
  const renderedRules = orderedRules.map(({ rule }) => renderRule(rule)).join('\n\n');
  const orderedPreservedBlocks = [...modules.values()]
    .flatMap(({ preservedBlocks }) => preservedBlocks)
    .sort((left, right) => left.moduleId.localeCompare(right.moduleId));
  const renderedPreservedBlocks = orderedPreservedBlocks
    .map(({ css }) => css)
    .join('\n\n');
  const layerPrelude = config.layers?.length
    ? `@layer ${config.layers.join(', ')};`
    : '';
  return {
    generation,
    css: [layerPrelude, renderedResources, renderedPreservedBlocks, renderedRules]
      .filter(Boolean)
      .join('\n\n'),
    manifest: {
      modules: [...modules.keys()].sort(),
      moduleDetails: [...modules.values()]
        .map(({ artifact }) => ({
          id: artifact.scopeSchema.moduleId,
          compilationMode: artifact.compilationMode,
          fallbackReasons: artifact.fallbackReasons
        }))
        .sort((left, right) => left.id.localeCompare(right.id)),
      resources: orderedResources.map(({ resource, sources }) => ({
        kind: resource.kind,
        name: resource.name,
        sources: [...sources].sort()
      })),
      rules: orderedRules.map(({ rule: { kind, className, selector, identity }, sources }) => ({
        kind,
        className,
        selector,
        property: identity.property,
        value: identity.value,
        important: identity.important,
        sources: [...sources].sort()
      }))
    },
    report: {
      modules: modules.size,
      rules: orderedRules.length,
      resources: orderedResources.length,
      atomicModules: [...modules.values()].filter(({ artifact }) =>
        artifact.compilationMode === 'atomic'
      ).length,
      preservedModules: orderedPreservedBlocks.length,
      atomicCoverage: modules.size === 0
        ? 1
        : [...modules.values()].filter(({ artifact }) =>
            artifact.compilationMode === 'atomic'
          ).length / modules.size
    }
  };
}

function renderObservedCombinator(
  relation: ObservedRelationIdentity['relation']
): '' | '> ' | '+ ' | '~ ' {
  if (relation === 'child') return '> ';
  if (relation === 'adjacent') return '+ ';
  if (relation === 'general-sibling') return '~ ';
  return '';
}

function canonicalAttributeCondition(condition: ParsedAttributeCondition): string {
  return `attribute:${condition.attribute}=${condition.value}`;
}

function renderAttributeCondition(condition: ParsedAttributeCondition): string {
  return `[${condition.attribute}=${JSON.stringify(condition.value)}]`;
}

function renderRelationCombinator(
  relation: ContextualRelationIdentity['relations'][number]
): '>' | '+' | '~' | '' {
  if (relation === 'child') return '>';
  if (relation === 'adjacent') return '+';
  if (relation === 'general-sibling') return '~';
  return '';
}

function renderRule(rule: PlannedDeclaration): string {
  const { property, value, important } = rule.identity;
  let css = `${rule.selector} {\n  ${property}: ${value}${important ? ' !important' : ''};\n}`;
  for (const wrapper of [...(rule.wrappers ?? [])].reverse()) {
    css = `@${wrapper.kind} ${wrapper.query} {\n${indentCss(css)}\n}`;
  }
  if (rule.layer && rule.layer !== 'unlayered') {
    css = `@layer ${rule.layer} {\n${indentCss(css)}\n}`;
  }
  return css;
}

function indentCss(css: string): string {
  return css.split('\n').map((line) => `  ${line}`).join('\n');
}

function renderModuleCode(exports: Readonly<Record<string, ScopeNodeSchema>>): string {
  const names = Object.keys(exports).sort();
  const declarations = names.map((name) =>
    `const ${name} = ${renderScopeObject(exports[name]!)};`
  );
  declarations.push(`export default { ${names.join(', ')} };`);
  return `${declarations.join('\n')}\n`;
}

function renderScopeObject(scope: ScopeNodeSchema): string {
  const fields = [`self: ${JSON.stringify(scope.selfClassName)}`];
  for (const name of Object.keys(scope.targets).sort()) {
    fields.push(`${JSON.stringify(name)}: ${renderScopeObject(scope.targets[name]!)}`);
  }
  return `{ ${fields.join(', ')} }`;
}

function renderDeclarationCode(exports: Readonly<Record<string, ScopeNodeSchema>>): string {
  const fields = Object.keys(exports).sort().map((name) =>
    `  readonly ${JSON.stringify(name)}: ${renderScopeType(exports[name]!)};`
  );
  return [
    'declare const GSS_SCOPE: unique symbol;',
    'type GssScope<T> = string & T & { readonly self: string; readonly [GSS_SCOPE]: true };',
    'declare const styles: {',
    ...fields,
    '};',
    'export default styles;',
    ''
  ].join('\n');
}

function renderScopeType(scope: ScopeNodeSchema): string {
  const targets = Object.keys(scope.targets).sort().map((name) =>
    `readonly ${JSON.stringify(name)}: ${renderScopeType(scope.targets[name]!)}`
  );
  return `GssScope<{ ${targets.join('; ')}${targets.length > 0 ? ';' : ''} }>`;
}

function serializeIdentity(identity: PlannedDeclaration['identity']): string {
  if ('subjectPath' in identity) {
    return JSON.stringify([
      'observed',
      identity.moduleId,
      identity.layer,
      identity.condition,
      identity.subjectPath,
      identity.relation,
      identity.observedClass,
      identity.observedState,
      identity.observedResidual,
      identity.property,
      identity.value,
      identity.important
    ]);
  }
  if ('relations' in identity) {
    return JSON.stringify([
      'contextual',
      identity.moduleId,
      identity.layer,
      identity.condition,
      identity.relations,
      identity.sourceState,
      identity.sourceAttribute,
      identity.sourcePath,
      identity.targetPath,
      identity.property,
      identity.value,
      identity.important
    ]);
  }
  return JSON.stringify([
    'pure',
    identity.layer,
    identity.condition,
    identity.state,
    identity.pseudoElement,
    identity.property,
    identity.value,
    identity.important
  ]);
}

function toLogicalModuleId(projectRoot: string, id: string): string {
  const root = normalizePath(projectRoot).replace(/\/$/, '');
  const normalizedId = normalizePath(id);
  const prefix = `${root}/`;
  return normalizedId.startsWith(prefix) ? normalizedId.slice(prefix.length) : normalizedId;
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/');
}
