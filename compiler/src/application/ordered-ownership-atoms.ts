import { getOwnershipPath, matchesOwnedTarget } from '../domain/ownership-path.js';
import type { ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import { identifyDeclarationValue, type AssetBindings } from './asset-values.js';
import { canonicalCondition } from './condition-context.js';
import type { NameAllocatorPort } from './name-allocator.js';
import type { PlannedDeclaration } from './planned-declaration.js';
import { ensureScopePath, type MutableScopeNode } from './scope-exports.js';

/** Unknown effects forbid winner pruning and value-based movement across competing declarations. */
export function orderedOwnershipAtoms(rules: readonly ParsedStyleRule[], paths: readonly (readonly string[])[],
  moduleId: string, bindings: AssetBindings, allocator: NameAllocatorPort, roots: Map<string, MutableScopeNode>): PlannedDeclaration[] {
  const targets = new Map(paths.map(path => [JSON.stringify(path), { path, scope: ensureScopePath(roots, path) }]));
  const atoms: PlannedDeclaration[] = [];
  for (const rule of rules) {
    const path = getOwnershipPath(rule.nodes);
    const members = [...targets.values()].filter(t => matchesOwnedTarget(path, t.path));
    for (const declaration of rule.declarations) {
      const identity = { property: declaration.property, ...identifyDeclarationValue(declaration, bindings), important: declaration.important,
        state: 'self', condition: canonicalCondition(rule.conditions), layer: rule.layer, orderSlot: atoms.length + 1,
        ownership: { moduleId, path, specificity: path.length } };
      const className = allocator.createAtomicName(identity);
      for (const { scope } of members) scope.classNames.add(className);
      atoms.push({ kind: 'pure-atom', identity, className, selector: `.${className}`.repeat(path.length),
        wrappers: rule.conditions, layer: rule.layer, source: declaration.source });
    }
  }
  return atoms;
}
