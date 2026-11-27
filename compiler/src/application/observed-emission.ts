import type { OwnedTargetBinding } from '../domain/order-occurrences.js';
import type { AtomicEmissionContext } from './atomic-emission-context.js';
import type { ParsedHasCondition } from '../domain/parsed-stylesheet.js';
import type { ObservedRelationIdentity } from '../domain/readable-name.js';
import { identifyDeclarationValue } from './asset-values.js';
import { canonicalCondition } from './condition-context.js';
import { renderNativeSelector, renderObservedCombinator } from './selector-rendering.js';
import { ensureScopePath } from './scope-exports.js';
import type { ObservedDeclarationIdentity } from './planned-declaration.js';

/** Emit already-planned :has() branches; native list specificity, branch
 * witness and observed marker membership remain distinct parts of identity. */
export function emitObservedRules(input: AtomicEmissionContext & {
  subjects: readonly OwnedTargetBinding[];
}): void {
  const { rules, subjects, moduleId, bindings, nameAllocator, roots, moduleOrder } = input;
  for (const { rule, targetPath } of subjects) {
    const wrappers = rule.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = rule.layer;
    const groups = rule.nodes.at(-1)!.hasConditions;
    const renderBranch = (observation: ParsedHasCondition) => {
      const relationIdentity: ObservedRelationIdentity = {
        moduleId,
        layer,
        condition,
        subjectPath: targetPath,
        relation: observation.relation,
        ...(observation.observedClass ? { observedClass: observation.observedClass } : {}),
        ...(observation.observedState ? { observedState: observation.observedState } : {}),
        ...(observation.observedResidual
          ? { observedResidual: observation.observedResidual }
          : {})
      };
      const observedSelector = observation.observedClass
        ? (() => {
          const observedMarker = nameAllocator.createObservedMarker(relationIdentity);
          ensureScopePath(roots, [observation.observedClass]).classNames.add(observedMarker);
          return `.${observedMarker}${observation.observedState ? `:${observation.observedState}` : ''}`;
        })()
        : renderNativeSelector(observation.observedResidual!, moduleId, nameAllocator, roots);
      const observedCombinator = renderObservedCombinator(observation.relation);
      return { observation, relationIdentity, observedSelector, observedCombinator };
    };
    if (groups.length > 1) {
      const subjectMarker = nameAllocator.createScopeMarker(moduleId, targetPath);
      ensureScopePath(roots, targetPath).classNames.add(subjectMarker);
      const conditions = groups.map(group => {
        const alternatives = group.alternatives.map(observation => {
          const { observedCombinator, observedSelector } = renderBranch(observation);
          return observedCombinator + observedSelector;
        });
        return `:has(${alternatives.join(',')})`;
      });
      const selector = `.${subjectMarker}`.repeat(rule.nodes.length) + conditions.join('');
      for (const declaration of rule.declarations) {
        rules.push({
          kind: 'contextual-atom', className: subjectMarker, selector, wrappers, layer, source: declaration.source,
          identity: { moduleId, layer, condition, subjectPath: targetPath, hasConditions: groups,
            ...moduleOrder.get(declaration, { rule, targetPath }),
            property: declaration.property, ...identifyDeclarationValue(declaration, bindings),
            important: declaration.important }
        });
      }
      continue;
    }
    const observations = groups[0]!.alternatives;
    const branches = observations.map(renderBranch);
    const nativeList = branches.map(({ observedCombinator, observedSelector }) => `${observedCombinator}${observedSelector}`).join(',');
    for (const { observation, relationIdentity, observedSelector, observedCombinator } of branches) {
      const subjectMarker = nameAllocator.createHasSubjectMarker(relationIdentity);
      ensureScopePath(roots, targetPath).classNames.add(subjectMarker);
      // :has() is unforgiving: the full list controls validity and strength, the branch only witnesses a match.
      const witness = branches.length > 1 ? `:where(:has(${observedCombinator}${observedSelector}))` : '';
      const selector = `${`.${subjectMarker}`.repeat(rule.nodes.length)}:has(${nativeList})${witness}`;

      for (const declaration of rule.declarations) {
        const identity: ObservedDeclarationIdentity = {
          ...relationIdentity,
          ...(moduleOrder.get(declaration, { rule, targetPath: targetPath, observation }) ?? {}),
          property: declaration.property,
          ...identifyDeclarationValue(declaration, bindings),
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

}
