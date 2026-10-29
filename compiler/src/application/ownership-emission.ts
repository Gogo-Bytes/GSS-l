import type { ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { ContextualRelationIdentity, PureDeclarationIdentity } from '../domain/readable-name.js';
import type { planFixedModuleOrder } from '../domain/fixed-module-ranks.js';
import type { planModuleRelations } from '../domain/plan-module-relations.js';
import { resolveTargetDeclarations } from '../domain/resolve-target-declarations.js';
import { identifyAssetValue, type AssetBindings } from './asset-values.js';
import { canonicalCondition, groupRulesByCondition } from './condition-context.js';
import { canonicalAttributeCondition, renderAttributeCondition, renderStateSuffix } from './selector-rendering.js';
import { ensureScopePath, type MutableScopeNode } from './scope-exports.js';
import type { NameAllocatorPort } from './name-allocator.js';
import type { PlannedDeclaration } from './planned-declaration.js';

/** Emit already-planned ownership targets and ancestor predicates. Ownership
 * paths are not assumed to be DOM ancestors; only ancestor predicates need a
 * source/target relation selector. */
export function emitOwnershipRules(input: {
  rules: PlannedDeclaration[];
  localRules: readonly ParsedStyleRule[];
  plan: NonNullable<ReturnType<typeof planModuleRelations>['plan']>;
  moduleId: string;
  bindings: AssetBindings;
  nameAllocator: NameAllocatorPort;
  roots: Map<string, MutableScopeNode>;
  moduleOrder: ReturnType<typeof planFixedModuleOrder>;
}): void {
  const { rules, localRules, plan, moduleId, bindings, nameAllocator, roots, moduleOrder } = input;
  const { ownershipRules, hasDescendantConditions, plannedDescendants, plannedStructural } = plan;
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
          source: declaration.source, identity: { ...relationIdentity, ...(moduleOrder.get(declaration, instance) ?? {}), property: declaration.property,
            ...identifyAssetValue(declaration.value, bindings), important: declaration.important }
        });
      } else {
        for (const declaration of instance.declarations) {
          const identity: PureDeclarationIdentity = {
            layer, condition, state: attribute ? canonicalAttributeCondition(attribute) : states.join(':') || 'self',
            ...(moduleOrder.get(declaration, instance) ?? {}),
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
          ...(moduleOrder.get(declaration, { rule, targetPath: target.path }) ?? {}),
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

}
