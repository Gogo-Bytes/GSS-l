import type { AtomicEmissionContext } from './atomic-emission-context.js';
import type { ContextualRelationIdentity } from '../domain/readable-name.js';
import type { StructuralInstance } from '../domain/plan-structural-relations.js';
import { identifyAssetValue } from './asset-values.js';
import { canonicalCondition } from './condition-context.js';
import { canonicalAttributeCondition, renderAttributeCondition, renderStateSuffix, renderRelationCombinator } from './selector-rendering.js';
import { ensureScopePath } from './scope-exports.js';
import type { ContextualDeclarationIdentity } from './planned-declaration.js';

/** Render already-planned runtime relations, preserving source, intermediate
 * and target marker bindings and the authored selector specificity. */
export function emitStructuralRules(input: AtomicEmissionContext & {
  instances: readonly StructuralInstance[];
}): void {
  const { rules, instances, moduleId, bindings, nameAllocator, roots, moduleOrder } = input;
  for (const instance of instances) {
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
        ...(moduleOrder.get(declaration, instance) ?? {}),
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

}
