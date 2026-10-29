import type { planFixedModuleOrder } from '../domain/fixed-module-ranks.js';
import type { AssetBindings } from './asset-values.js';
import type { MutableScopeNode } from './scope-exports.js';
import type { NameAllocatorPort } from './name-allocator.js';
import type { PlannedDeclaration } from './planned-declaration.js';

/** Shared state for already-admitted atomic emission. It carries decisions;
 * individual emitters retain their own relation and marker semantics. */
export type AtomicEmissionContext = {
  rules: PlannedDeclaration[];
  moduleId: string;
  bindings: AssetBindings;
  nameAllocator: NameAllocatorPort;
  roots: Map<string, MutableScopeNode>;
  moduleOrder: ReturnType<typeof planFixedModuleOrder>;
};
