import type { ParsedDeclaration, ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { PureDeclarationIdentity } from '../domain/readable-name.js';
import type { GssDiagnostic } from '../public-types.js';
import type { OrderBinding } from '../domain/order-occurrences.js';
import { planFixedModuleOrder } from '../domain/fixed-module-ranks.js';
import { collectModuleOrderCandidates, type planModuleRelations } from '../domain/plan-module-relations.js';
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
import { emitExternalRules } from './external-emission.js';

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

  const externalEmission = emitExternalRules({ id: input.id, rules, sameNodeRules, externalRules,
    moduleId, bindings, nameAllocator, roots, moduleOrder });
  if (externalEmission) return externalEmission;

  return { rules };
}
