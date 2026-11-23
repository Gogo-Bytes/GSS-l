import type { AtomicEmissionContext } from './atomic-emission-context.js';
import type { ContextualRelationIdentity } from '../domain/readable-name.js';
import type { RuntimeStructuralInstance } from '../domain/plan-structural-relations.js';
import { identifyDeclarationValue } from './asset-values.js';
import { canonicalCondition } from './condition-context.js';
import { canonicalAttributeCondition, renderAttributeCondition, renderStateSuffix, renderWitnessSelector } from './selector-rendering.js';
import { ensureScopePath } from './scope-exports.js';
import type { ContextualDeclarationIdentity } from './planned-declaration.js';

/** Render already-planned runtime relations, preserving source, intermediate
 * and target marker bindings and the authored selector specificity. */
export function emitStructuralRules(input: AtomicEmissionContext & {
  instances: readonly RuntimeStructuralInstance[];
}): void {
  const { rules, instances, moduleId, bindings, nameAllocator, roots, moduleOrder } = input;
  for (const instance of instances) {
    const { rule, declarations, relationRank, targetPath, witnesses } = instance;
    const wrappers = rule.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = rule.layer;
    // Only structural planner instances enter this branch; their source binding
    // is already established. Keep trailing descendant edges in emitted selectors.
    const first = witnesses[0]!;
    const sourcePath = first.path;
    const runtimeRelations = witnesses.slice(1).map(witness => witness.incoming!);
    const predicate = rule.nodes[first.nodeIndex]!;
    // Keep the existing marker identity for the admitted single source attribute.
    const sourceState = predicate.states.join(':') || undefined;
    const sourceAttributeCondition = predicate.attributes[0];
    const sourceAttribute = sourceAttributeCondition
      ? canonicalAttributeCondition(sourceAttributeCondition)
      : undefined;
    const suffixAt = (nodeIndex: number) => {
      const node = rule.nodes[nodeIndex]!;
      return renderStateSuffix(node.states, moduleId, nameAllocator, roots) + node.attributes.map(renderAttributeCondition).join('');
    };
    const targetSuffix = suffixAt(witnesses.at(-1)!.nodeIndex);
    // Endpoint fields keep their historical names; they cannot identify conditions between endpoints
    // or a second source attribute. Those chains use all authored tests, including empty positions.
    const hasConditionedPrefix = runtimeRelations[0] === 'descendant';
    const needsWitnessKey = hasConditionedPrefix || predicate.attributes.length > 1 || witnesses.slice(1, -1).some(w => {
      const node = rule.nodes[w.nodeIndex]!;
      return node.states.length || node.attributes.length;
    }) || (witnesses.length > 2 && !!targetSuffix);
    const tests = needsWitnessKey ? { witnessKey: JSON.stringify(witnesses.map(w => {
      const { states, attributes } = rule.nodes[w.nodeIndex]!;
      return hasConditionedPrefix ? [w.path, w.classWeight, states, attributes] : [states, attributes];
    })) } : { ...(sourceState ? { sourceState } : {}), ...(sourceAttribute ? { sourceAttribute } : {}),
      ...(targetSuffix ? { targetSuffix } : {}) };
    const relationIdentity: ContextualRelationIdentity = {
      moduleId,
      layer,
      condition,
      relations: runtimeRelations,
      ...tests,
      sourcePath,
      targetPath
    };
    const targetMarker = nameAllocator.createTargetMarker(relationIdentity);
    const markers = witnesses.map(({ path }, index) => {
      const marker = index === 0 && !sourceState && !sourceAttribute
        ? nameAllocator.createSourceMarker(moduleId, sourcePath, condition, layer)
        : index === witnesses.length - 1
          ? targetMarker
          : nameAllocator.createContextMarker(relationIdentity, index, path);
      ensureScopePath(roots, path).classNames.add(marker);
      return marker;
    });
    const selector = renderWitnessSelector(witnesses, ({ nodeIndex }, i) => ({ marker: markers[i]!,
      suffix: i === witnesses.length - 1 ? targetSuffix : suffixAt(nodeIndex) }));

    for (const declaration of declarations) {
      const identity: ContextualDeclarationIdentity = {
        ...relationIdentity,
        ...(moduleOrder.get(declaration, instance) ?? {}),
        property: declaration.property,
        ...identifyDeclarationValue(declaration, bindings),
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
