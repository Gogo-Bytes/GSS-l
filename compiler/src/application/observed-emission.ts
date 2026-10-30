import { getOwnershipPath } from '../domain/ownership-path.js';
import type { AtomicEmissionContext } from './atomic-emission-context.js';
import type { ParsedStyleRule, ParsedHasCondition } from '../domain/parsed-stylesheet.js';
import type { ObservedRelationIdentity } from '../domain/readable-name.js';
import { identifyAssetValue } from './asset-values.js';
import { canonicalCondition } from './condition-context.js';
import { renderNativeSelector, renderObservedCombinator } from './selector-rendering.js';
import { ensureScopePath } from './scope-exports.js';
import type { ObservedDeclarationIdentity } from './planned-declaration.js';

/** Emit already-planned :has() branches; native list specificity, branch
 * witness and observed marker membership remain distinct parts of identity. */
export function emitObservedRules(input: AtomicEmissionContext & {
  hasRules: readonly ParsedStyleRule[];
}): void {
  const { rules, hasRules, moduleId, bindings, nameAllocator, roots, moduleOrder } = input;
  for (const rule of hasRules) {
    const authoredPath = getOwnershipPath(rule.nodes);
    const wrappers = rule.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = rule.layer;
    const observations = rule.nodes.at(-1)!.observations;
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
        subjectPath: authoredPath,
        relation: observation.relation,
        ...(observation.observedClass ? { observedClass: observation.observedClass } : {}),
        ...(observation.observedState ? { observedState: observation.observedState } : {}),
        ...(observation.observedResidual
          ? { observedResidual: observation.observedResidual }
          : {})
      };
      const subjectMarker = nameAllocator.createHasSubjectMarker(relationIdentity);
      ensureScopePath(roots, authoredPath).classNames.add(subjectMarker);
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
      const subjectSpecificity = rule.nodes.length + (selectorListSpecificity ?? 0);
      // A native complex list supplies its own maximum; zero-strength witnesses retain branch identity.
      // Simple lists keep the existing target-qualified scalar lowering.
      const selector = nativeSpecificity
        ? `${`.${subjectMarker}`.repeat(rule.nodes.length)}:has(${nativeList})${observations.length > 1
          ? `:where(:has(${observedCombinator}${observedSelector}))` : ''}`
        : `${`.${subjectMarker}`.repeat(subjectSpecificity)}:has(${observedCombinator}${normalizedObservedSelector})`;

      for (const declaration of rule.declarations) {
        const identity: ObservedDeclarationIdentity = {
          ...relationIdentity,
          ...(moduleOrder.get(declaration, { rule, targetPath: authoredPath, observation }) ?? {}),
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

}
