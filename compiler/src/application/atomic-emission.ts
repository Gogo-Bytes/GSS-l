import type { PhysicalDeclaration } from '../infrastructure/lightning-compatibility-transformer.js';
import type { ParsedCondition, ParsedDeclaration, ParsedHasCondition, ParsedStyleRule, SourceSpan } from '../domain/parsed-stylesheet.js';
import type { ContextualRelationIdentity, ObservedRelationIdentity, PureDeclarationIdentity } from '../domain/readable-name.js';
import type { GssDiagnostic } from '../public-types.js';
import type { OrderBinding } from '../domain/order-occurrences.js';
import { planFixedModuleOrder } from '../domain/fixed-module-ranks.js';
import { collectModuleOrderCandidates, type planModuleRelations } from '../domain/plan-module-relations.js';
import { resolveTargetDeclarations } from '../domain/resolve-target-declarations.js';
import { classifyPropertyEffect } from '../domain/property-effects.js';
import { isPseudoElementRule } from '../domain/rule-classification.js';
import { identifyAssetValue, type AssetBindings } from './asset-values.js';
import { canonicalCondition, groupRulesByCondition } from './condition-context.js';
import { renderObservedCombinator, canonicalAttributeCondition, renderAttributeCondition, renderStateSuffix, renderNativeSelector, renderRelationCombinator } from './selector-rendering.js';
import { ensureScopePath, type MutableScopeNode } from './scope-exports.js';
import type { NameAllocatorPort } from './name-allocator.js';

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

/** Emit already-admitted atomic rules. Callers select fallback and perform
 * compatibility checks before entering; relation proofs remain in planners. */
export function emitAtomicRules(input: {
  id: string;
  moduleId: string;
  semanticRules: readonly ParsedStyleRule[];
  localRules: readonly ParsedStyleRule[];
  sameNodeRules: readonly ParsedStyleRule[];
  externalRules: readonly ParsedStyleRule[];
  relationPlan: NonNullable<ReturnType<typeof planModuleRelations>['plan']>;
  bindings: AssetBindings;
  nameAllocator: NameAllocatorPort;
  roots: Map<string, MutableScopeNode>;
}): { rules: PlannedDeclaration[] } | { diagnostics: readonly GssDiagnostic[] } {
  const { moduleId, semanticRules, localRules, sameNodeRules, externalRules, bindings, nameAllocator, roots } = input;
  const { ownershipRules, hasRules, hasDescendantConditions, plannedDescendants, plannedStructural, plannedPseudos } = input.relationPlan;
  const rules: PlannedDeclaration[] = [];
  const moduleOrder = planFixedModuleOrder(semanticRules,
    collectModuleOrderCandidates(input.relationPlan, sameNodeRules, externalRules));
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

  return { rules };
}
