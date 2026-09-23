import selectorParser from 'postcss-selector-parser';
import { bindCssAssets, identifyAssetValue, renderAssetValue, type AssetBindings, type AssetUrlResolver } from './asset-values.js';
import { collectAssetDependencies } from './stylesheet-assets.js';
import { toLogicalModuleId } from './module-identity.js';
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
import { planDescendantConditions } from '../domain/plan-descendant-conditions.js';
import { planStructuralRelations } from '../domain/plan-structural-relations.js';
import { resolveTargetDeclarations } from '../domain/resolve-target-declarations.js';
import { compareRuleOrder } from '../domain/rule-order-planner.js';
import { validateDeclarationSequences } from '../domain/validate-declarations.js';
import { validateLogicalPhysicalConflicts } from '../domain/validate-logical-physical-conflicts.js';
import { planPseudoElementConditions } from '../domain/plan-pseudo-element-conditions.js';
import type {
  ParsedAttributeCondition,
  ParsedCondition,
  ParsedFontFaceResource,
  ParsedGlobalResource,
  ParsedHasCondition,
  ParsedKeyframesRegistration,
  ParsedPropertyRegistration,
  ParsedStyleRule
} from '../domain/parsed-stylesheet.js';
import type { CssParserPort, ParsedStylesheet } from './css-parser-port.js';
import type {
  FinalizedGssSnapshot,
  FinalizeGssOptions,
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
  assetValue?: true;
  important: boolean;
};

type ObservedDeclarationIdentity = ObservedRelationIdentity & {
  property: string;
  value: string;
  assetValue?: true;
  important: boolean;
};

type PlannedDeclaration = {
  kind: 'pure-atom' | 'contextual-atom';
  identity: PureDeclarationIdentity | ContextualDeclarationIdentity | ObservedDeclarationIdentity;
  className: string;
  selector: string;
  wrappers?: readonly ParsedCondition[];
  layer?: string;
  relationRank?: number;
};

type PlannedResource = {
  kind: 'property' | 'keyframes' | 'font-face';
  name: string;
  conflictKey?: string;
  identity: string;
  css: string;
  renderCss?: (resolve: AssetUrlResolver) => string;
};

type PlannedPreservedBlock = {
  moduleId: string;
  css: string;
  renderCss?: (resolve: AssetUrlResolver) => string;
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

export function createCompilerSession(config: GssCompilerConfig, cssParser: CssParserPort): GssCompilerSession {
  const modules = new Map<string, ModuleContribution>();
  let generation = 0;

  return {
    replaceStylesheet(input) {
      const prepared = prepareContribution(config, input, cssParser);
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

    finalize(options) {
      return finalizeSnapshot(modules, generation, config, options);
    }
  };
}

function prepareContribution(
  config: GssCompilerConfig,
  input: ReplaceStylesheetInput,
  cssParser: CssParserPort
): ModuleContribution | { diagnostics: readonly GssDiagnostic[] } {
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
  const hasRules = semanticRules.filter(({ observations }) =>
    observations.at(-1)?.length
  );
  const contextualRules = semanticRules.filter(({ relations }) =>
    relations.some((relation) => relation !== 'descendant')
  );
  const unsupportedRelation = contextualRules.find(({ path, relations }) => {
    const firstRuntimeRelation = relations.findIndex((relation) => relation !== 'descendant');
    const hasOwnershipSuffix = relations.slice(firstRuntimeRelation).includes('descendant');
    return hasOwnershipSuffix && !(
      firstRuntimeRelation === 0 && path.length === 3 && relations.length === 2 &&
      relations[0] === 'adjacent' && relations[1] === 'descendant'
    );
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

  const descendantRules = semanticRules.filter((rule) =>
    isPureOwnershipRule(rule) || isCurrentStateRule(rule) || isCurrentAttributeRule(rule) ||
    isAncestorStateRule(rule) || isAncestorAttributeRule(rule)
  );
  const hasDescendantConditions = contextualRules.length > 0 || descendantRules.some((rule) => !isPureOwnershipRule(rule));
  const declaredPaths = semanticRules.flatMap(({ path }) => path.map((_, index) => path.slice(0, index + 1)));
  const plannedDescendants = hasDescendantConditions ? planDescendantConditions(descendantRules, declaredPaths) : undefined;
  if (plannedDescendants?.ambiguity) return { diagnostics: [{
      code: 'GSS1205', severity: 'error', phase: 'resolve', id: input.id,
      reason: 'ambiguous-coactive-state-conflict', message: plannedDescendants.ambiguity
    }] };

  const plannedStructural = planStructuralRelations(contextualRules, plannedDescendants?.instances ?? [], hasRules);
  if (plannedStructural.ambiguity) return { diagnostics: [{
    code: 'GSS1205', severity: 'error', phase: 'resolve', id: input.id,
    reason: 'ambiguous-coactive-state-conflict', message: plannedStructural.ambiguity
  }] };

  const plannedPseudos = planPseudoElementConditions(semanticRules);
  if (plannedPseudos.ambiguity) return { diagnostics: [{
    code: 'GSS1205', severity: 'error', phase: 'resolve', id: input.id,
    reason: 'ambiguous-coactive-state-conflict', message: plannedPseudos.ambiguity
  }] };

  const unsupportedProperties = [...new Set(
    semanticRules
      .flatMap(({ declarations }) => declarations.map(({ property }) => property))
      .filter((property) => !isRegisteredPropertyEffect(property))
  )].sort();
  if (unsupportedProperties.length > 0) {
    if (config.atomizationFallback === 'error') {
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
      fallbackProperties: unsupportedProperties
    });
  }

  if (plannedDescendants) {
    for (const rule of semanticRules) ensureScopePath(roots, rule.path);
    for (const instance of plannedStructural.descendants) {
      const { rule, targetPath, sourcePath, sourceIndex, relationRank } = instance;
      const wrappers = rule.conditions;
      const condition = canonicalCondition(wrappers);
      const layer = rule.layer;
      const states = sourceIndex < 0 ? [] : rule.states[sourceIndex]!;
      const attribute = sourceIndex < 0 ? undefined : rule.attributes[sourceIndex]![0];
      const suffix = attribute ? renderAttributeCondition(attribute) : states.map((state) => `:${state}`).join('');
      const ancestor = sourcePath !== undefined && sourcePath.length < targetPath.length;
      const scope = ensureScopePath(roots, targetPath);
      if (ancestor) {
        const sourceMarker = createReadableSourceMarker(moduleId, sourcePath, condition, layer);
        const relationIdentity: ContextualRelationIdentity = {
          moduleId, layer, condition, sourcePath, targetPath,
          relations: rule.relations.slice(sourceIndex),
          ...(attribute ? { sourceAttribute: canonicalAttributeCondition(attribute) } : { sourceState: states.join(':') }),
          ...(JSON.stringify(rule.path) !== JSON.stringify(targetPath) ? { authoredPath: rule.path } : {})
        };
        const targetMarker = createReadableTargetMarker(relationIdentity);
        ensureScopePath(roots, sourcePath).classNames.add(sourceMarker);
        scope.classNames.add(targetMarker);
        // Repeat an existing marker, rather than inventing ancestors, to retain authored specificity.
        const selector = `.${sourceMarker}${suffix} ${`.${targetMarker}`.repeat(rule.path.length - 1)}`;
        for (const declaration of instance.declarations) rules.push({
          kind: 'contextual-atom', className: targetMarker, selector, wrappers, layer, relationRank,
          identity: { ...relationIdentity, property: declaration.property,
            ...identifyAssetValue(declaration.value, bindings), important: declaration.important }
        });
      } else {
        for (const declaration of instance.declarations) {
          const identity: PureDeclarationIdentity = {
            layer, condition, state: attribute ? canonicalAttributeCondition(attribute) : states.join(':') || 'self',
            property: declaration.property, ...identifyAssetValue(declaration.value, bindings), important: declaration.important,
            ...(rule.path.length > 1 ? { ownership: { moduleId, path: targetPath, specificity: rule.path.length } } : {})
          };
          const className = createReadableAtomicName(identity);
          scope.classNames.add(className);
          rules.push({ kind: sourceIndex < 0 ? 'pure-atom' : 'contextual-atom', identity, className,
            selector: `${`.${className}`.repeat(rule.path.length)}${suffix}`, wrappers, layer, relationRank });
        }
      }
    }
  }

  const ownershipGroups = groupRulesByCondition(hasDescendantConditions ? [] : ownershipRules);
  for (const groupedRules of ownershipGroups.values()) {
    const wrappers = groupedRules[0]!.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = groupedRules[0]!.layer;
    const declaredPaths = semanticRules
      .filter((rule) =>
        rule.layer === layer && canonicalCondition(rule.conditions) === condition
      )
      .flatMap(({ path }) => path.map((_, index) => path.slice(0, index + 1)));
    for (const target of resolveTargetDeclarations(groupedRules, declaredPaths)) {
      const scope = ensureScopePath(roots, target.path);
      for (const declaration of target.declarations) {
        const identity: PureDeclarationIdentity = {
          layer,
          condition,
          state: 'self',
          property: declaration.property,
          ...identifyAssetValue(declaration.value, bindings),
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

  // Declared pseudo paths remain public scopes even when no declarations survive planning.
  for (const rule of semanticRules) {
    if (isPseudoElementRule(rule)) ensureScopePath(roots, rule.path);
  }
  for (const { rule, targetPath, declarations, relationRank } of plannedPseudos.instances) {
    const pseudoElement = rule.pseudoElements.at(-1)!;
    const state = rule.states.at(-1)!.join(':') || 'self';
    const wrappers = rule.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = rule.layer;
    const scope = ensureScopePath(roots, targetPath);
    for (const declaration of declarations) {
      const identity: PureDeclarationIdentity = {
        layer, condition, state, pseudoElement,
        property: declaration.property,
        ...identifyAssetValue(declaration.value, bindings),
        important: declaration.important,
        ...(rule.path.length > 1 ? { ownership: { moduleId, path: targetPath, specificity: rule.path.length } } : {})
      };
      const className = createReadableAtomicName(identity);
      scope.classNames.add(className);
      rules.push({
        kind: state === 'self' ? 'pure-atom' : 'contextual-atom',
        identity, className,
        // Keep authored class specificity on this target-qualified atom, not a shared weaker atom.
        selector: `${`.${className}`.repeat(rule.path.length)}${state === 'self' ? '' : `:${state}`}::${pseudoElement}`,
        wrappers, layer, relationRank
      });
    }
  }

  for (const rule of hasRules) {
    const wrappers = rule.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = rule.layer;
    const observations = rule.observations.at(-1)!;
    const observedSpecificity = (observation: ParsedHasCondition) => observation.observedClass
      ? 1 + Number(Boolean(observation.observedState))
      : observation.observedResidual?.startsWith(':') || observation.observedResidual?.startsWith('[')
        ? 1
        : 0;
    const selectorListSpecificity = observations.length > 1
      ? Math.max(...observations.map(observedSpecificity))
      : undefined;
    for (const observation of observations) {
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
      const normalizedObservedSelector = selectorListSpecificity !== undefined && selectorListSpecificity > 0
        ? `:where(${observedSelector})`
        : observedSelector;
      const subjectSpecificity = rule.path.length + (selectorListSpecificity ?? 0);
      // Selector-list branches stay separately observable, but share native list-maximum
      // specificity through repeated target-qualified markers; weaker reusable atoms stay pure.
      const selector = `${`.${subjectMarker}`.repeat(subjectSpecificity)}:has(${observedCombinator}${normalizedObservedSelector})`;

      for (const declaration of rule.declarations) {
        const identity: ObservedDeclarationIdentity = {
          ...relationIdentity,
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
          layer
        });
      }
    }
  }

  for (const { rule, declarations, relationRank } of plannedStructural.instances) {
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
    const selector = markers.map((marker, index) => {
      if (index === 0) {
        // The source marker represents the whole ownership prefix, not one authored class.
        return `${`.${marker}`.repeat(sourcePath.length)}${sourceState ? `:${sourceState}` : ''}${
          sourceAttributeCondition ? renderAttributeCondition(sourceAttributeCondition) : ''
        }`;
      }
      const combinator = renderRelationCombinator(runtimeRelations[index - 1]!);
      return `${combinator ? ` ${combinator} ` : ' '}.${marker}`;
    }).join('');

    for (const declaration of declarations) {
      const identity: ContextualDeclarationIdentity = {
        ...relationIdentity,
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
        relationRank
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

  const resources = parsed.resources.map((resource) => planResource(resource, moduleId, bindings));
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
  fallbackProperties: readonly string[];
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
  const fallbackReasons = input.fallbackProperties.map((property) => ({
    property,
    reason: 'property-effect-not-registered' as const
  }));
  const scopeSchema = { moduleId: input.moduleId, exports };
  const artifact: StyleModuleArtifact = {
    id: input.input.id,
    scopeSchema,
    moduleCode: renderModuleCode(exports),
    declarationCode: renderDeclarationCode(exports),
    dependencies: collectAssetDependencies(input.parsed),
    compilationMode: 'preserved',
    fallbackReasons
  };
  const bindings = new Map((input.input.assetReferences ?? []).map(({ url, identity }) => [url, identity]));
  const resources = input.parsed.resources.map((resource) =>
    planResource(resource, input.moduleId, bindings)
  );
  return {
    artifact,
    rules: [],
    preservedBlocks: [{ moduleId: input.moduleId, css, ...bindCssAssets(css, bindings) }],
    resources,
    diagnostics: [
      ...input.conditionDiagnostics,
      {
        code: 'GSS1104',
        severity: 'warning',
        phase: 'plan',
        message: `Module was preserved because property effects are not registered: ${input.fallbackProperties.join(', ')}.`,
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

function planResource(resource: ParsedGlobalResource, moduleId: string, bindings: AssetBindings): PlannedResource {
  const planned = resource.kind === 'property' ? planPropertyRegistration(resource)
    : resource.kind === 'keyframes' ? planKeyframesRegistration(resource, moduleId)
    : planFontFaceResource(resource);
  const assets = bindCssAssets(planned.css, bindings);
  return assets.assetIdentity && assets.renderCss
    ? { ...planned, identity: assets.assetIdentity, renderCss: assets.renderCss }
    : planned;
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
      resource.frames.map(({ selector, declarations }) => ({
        selector,
        declarations: declarations.map(({ property, value, important }) => ({ property, value, important }))
      }))
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
  config: GssCompilerConfig,
  options?: FinalizeGssOptions
): FinalizedGssSnapshot {
  const urls = new Map<string, string>();
  const resolve: AssetUrlResolver = (identity) => {
    if (urls.has(identity)) return urls.get(identity)!;
    const url = options?.resolveAssetUrl?.(identity);
    if (typeof url !== 'string' || url.length === 0) throw new Error(`Missing output URL for GSS Asset ${identity}.`);
    urls.set(identity, url);
    return url;
  };
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
    .map(({ resource }) => resource.renderCss?.(resolve) ?? resource.css)
    .join('\n\n');

  const uniqueRules = new Map<string, {
    rule: PlannedDeclaration;
    sources: Set<string>;
  }>();
  for (const contribution of modules.values()) {
    for (const rule of contribution.rules) {
      const identity = serializeIdentity(rule.identity);
      // Observed declaration identity captures the relation and value, but different authored
      // selector-list maxima can give that same branch distinct emitted selector specificity.
      const key = 'subjectPath' in rule.identity
        ? JSON.stringify([identity, rule.selector])
        : identity;
      const registered = uniqueRules.get(key) ?? { rule, sources: new Set<string>() };
      registered.sources.add(contribution.artifact.scopeSchema.moduleId);
      uniqueRules.set(key, registered);
    }
  }

  const orderedRules = [...uniqueRules.values()].sort((left, right) =>
    compareRuleOrder(left.rule, right.rule, config)
  );
  const renderedRules = orderedRules.map(({ rule }) => renderRule(rule, resolve)).join('\n\n');
  const orderedPreservedBlocks = [...modules.values()]
    .flatMap(({ preservedBlocks }) => preservedBlocks)
    .sort((left, right) => left.moduleId.localeCompare(right.moduleId));
  const renderedPreservedBlocks = orderedPreservedBlocks
    .map(({ css, renderCss }) => renderCss?.(resolve) ?? css)
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
      modules: [...modules.values()].map(({ artifact }) => artifact.scopeSchema.moduleId).sort(),
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
        value: renderAssetValue(identity, resolve),
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

function renderRule(rule: PlannedDeclaration, resolve: AssetUrlResolver): string {
  const { property, important } = rule.identity;
  const value = renderAssetValue(rule.identity, resolve);
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
    "import type { GssScope } from '@gss-l/types';",
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
  return targets.length === 0
    ? 'GssScope<{}>'
    : `GssScope<{ ${targets.join('; ')}; }>`;
}

function serializeIdentity(identity: PlannedDeclaration['identity']): string {
  if (identity.assetValue) {
    const plain = { ...identity };
    delete plain.assetValue;
    return JSON.stringify(['asset-identity', serializeIdentity(plain)]);
  }
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
      identity.authoredPath,
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
    identity.ownership,
    identity.property,
    identity.value,
    identity.important
  ]);
}
