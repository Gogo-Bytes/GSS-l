import type { ParsedDeclaration, ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { PureDeclarationIdentity } from '../domain/readable-name.js';
import type { GssDiagnostic } from '../public-types.js';
import type { OrderBinding } from '../domain/order-occurrences.js';
import { planFixedModuleOrder } from '../domain/fixed-module-ranks.js';
import { collectModuleOrderCandidates, type planModuleRelations } from '../domain/plan-module-relations.js';
import { classifyPropertyEffect } from '../domain/property-effects.js';
import { isPseudoElementRule } from '../domain/rule-classification.js';
import { identifyAssetValue, type AssetBindings } from './asset-values.js';
import { canonicalCondition } from './condition-context.js';
import { renderStateSuffix } from './selector-rendering.js';
import { ensureScopePath, type MutableScopeNode } from './scope-exports.js';
import type { NameAllocatorPort } from './name-allocator.js';
import type { PlannedDeclaration } from './planned-declaration.js';
import { emitObservedRules } from './observed-emission.js';
import { emitStructuralRules } from './structural-emission.js';
import { emitOwnershipRules } from './ownership-emission.js';

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
  const { hasRules, plannedStructural, plannedPseudos } = input.relationPlan;
  const rules: PlannedDeclaration[] = [];
  const moduleOrder = planFixedModuleOrder(semanticRules,
    collectModuleOrderCandidates(input.relationPlan, sameNodeRules, externalRules));
  const orderIdentity = (declaration: ParsedDeclaration, binding: OrderBinding) => {
    return moduleOrder.get(declaration, binding) ?? {};
  };

  emitOwnershipRules({ rules, localRules, plan: input.relationPlan, moduleId, bindings, nameAllocator, roots, moduleOrder });

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

  emitObservedRules({ rules, hasRules, moduleId, bindings, nameAllocator, roots, moduleOrder });

  emitStructuralRules({ rules, instances: plannedStructural.instances, moduleId, bindings, nameAllocator, roots, moduleOrder });

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
