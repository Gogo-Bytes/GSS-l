import type { ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { GssDiagnostic } from '../public-types.js';
import { planFixedModuleOrder } from '../domain/fixed-module-ranks.js';
import { collectModuleOrderCandidates, type planModuleRelations } from '../domain/plan-module-relations.js';
import { type AssetBindings } from './asset-values.js';
import { type MutableScopeNode } from './scope-exports.js';
import type { NameAllocatorPort } from './name-allocator.js';
import type { PlannedDeclaration } from './planned-declaration.js';
import { emitObservedRules } from './observed-emission.js';
import { emitStructuralRules } from './structural-emission.js';
import { emitOwnershipRules } from './ownership-emission.js';
import { emitExternalRules } from './external-emission.js';
import { emitPseudoRules } from './pseudo-emission.js';

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
  const context = { rules, moduleId, bindings, nameAllocator, roots, moduleOrder };

  emitOwnershipRules({ ...context, localRules, plan: input.relationPlan });

  emitPseudoRules({ ...context, localRules, instances: plannedPseudos.instances });

  emitObservedRules({ ...context, hasRules });

  emitStructuralRules({ ...context, instances: plannedStructural.instances });

  const externalEmission = emitExternalRules({ ...context, id: input.id, sameNodeRules, externalRules });
  if (externalEmission) return externalEmission;

  return { rules };
}
