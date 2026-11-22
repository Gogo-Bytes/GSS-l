import { boundPredicates } from '../domain/selector-bindings.js';
import { getOwnershipPath } from '../domain/ownership-path.js';
import type { AtomicEmissionContext } from './atomic-emission-context.js';
import type { ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { ContextualRelationIdentity, PureDeclarationIdentity } from '../domain/readable-name.js';
import type { DescendantInstance } from '../domain/plan-descendant-conditions.js';
import type { PlannedOwnershipGroup } from './ownership-planning.js';
import { identifyDeclarationValue } from './asset-values.js';
import { canonicalCondition } from './condition-context.js';
import { canonicalAttributeCondition, renderWitnessSelector, renderAttributeCondition, renderStateSuffix } from './selector-rendering.js';
import { ensureScopePath } from './scope-exports.js';

/** Emit already-planned ownership targets and ancestor predicates. Ownership
 * paths are not assumed to be DOM ancestors; only ancestor predicates need a
 * source/target relation selector. */
export function emitOwnershipRules(input: AtomicEmissionContext & {
  localRules: readonly ParsedStyleRule[];
  descendants?: readonly DescendantInstance<ParsedStyleRule>[];
  ownershipGroups: readonly PlannedOwnershipGroup[];
}): void {
  const { rules, localRules, descendants, ownershipGroups, moduleId, bindings, nameAllocator, roots, moduleOrder } = input;
  if (descendants) {
    for (const rule of localRules) ensureScopePath(roots, getOwnershipPath(rule.nodes));
    for (const instance of descendants) {
      const { rule, targetPath, sourceIndex, witnesses, relationRank } = instance;
      const first = witnesses[0]!;
      const wrappers = rule.conditions;
      const condition = canonicalCondition(wrappers);
      const layer = rule.layer;
      const { states, attributes } = rule.nodes[first.nodeIndex]!;
      const attribute = attributes[0];
      const localMarkers = new Set<string>();
      const suffix = attributes.map(renderAttributeCondition).join('') + renderStateSuffix(states, moduleId, nameAllocator, roots, localMarkers);
      const scope = ensureScopePath(roots, targetPath);
      if (witnesses.length > 1) {
        const sourcePath = first.path;
        const authoredPath = getOwnershipPath(rule.nodes);
        const suffixes = witnesses.map(({ nodeIndex }, i) => {
          if (i === 0) return suffix;
          const node = rule.nodes[nodeIndex]!;
          return node.attributes.map(renderAttributeCondition).join('') + renderStateSuffix(node.states, moduleId, nameAllocator, roots);
        });
        const relationIdentity: ContextualRelationIdentity = {
          moduleId, layer, condition, sourcePath, targetPath,
          relations: rule.relations.slice(sourceIndex),
          ...(witnesses.length > 2 || suffixes.at(-1) || attributes.length > 1 || (attribute && states.length)
            ? { witnessKey: JSON.stringify(boundPredicates(instance)) }
            : attribute ? { sourceAttribute: canonicalAttributeCondition(attribute) } : { sourceState: states.join(':') }),
          ...(JSON.stringify(authoredPath) !== JSON.stringify(targetPath) ? { authoredPath } : {})
        };
        const targetMarker = nameAllocator.createTargetMarker(relationIdentity);
        const selector = renderWitnessSelector(witnesses, ({ path }, i) => {
          const marker = i === witnesses.length - 1 ? targetMarker : nameAllocator.createSourceMarker(moduleId, path, condition, layer);
          ensureScopePath(roots, path).classNames.add(marker);
          return { marker, suffix: suffixes[i]! };
        });
        for (const declaration of instance.declarations) rules.push({
          kind: 'contextual-atom', className: targetMarker, selector, wrappers, layer, relationRank,
          source: declaration.source, identity: { ...relationIdentity, ...(moduleOrder.get(declaration, instance) ?? {}), property: declaration.property,
            ...identifyDeclarationValue(declaration, bindings), important: declaration.important }
        });
      } else {
        const stateMarkers = [...localMarkers];
        for (const declaration of instance.declarations) {
          const identity: PureDeclarationIdentity = {
            layer, condition, state: attribute && (attributes.length > 1 || states.length > 0)
              ? `compound:${JSON.stringify([attributes, states])}`
              : attribute ? canonicalAttributeCondition(attribute) : states.join(':') || 'self',
            ...(moduleOrder.get(declaration, instance) ?? {}),
            ...(stateMarkers.length ? { stateMarkers } : {}),
            property: declaration.property, ...identifyDeclarationValue(declaration, bindings), important: declaration.important,
            ...(rule.nodes.length > 1 ? { ownership: { moduleId, path: targetPath, specificity: rule.nodes.length } } : {})
          };
          const className = nameAllocator.createAtomicName(identity);
          scope.classNames.add(className);
          rules.push({ kind: sourceIndex < 0 ? 'pure-atom' : 'contextual-atom', identity, className,
            selector: renderWitnessSelector(witnesses, () => ({ marker: className, suffix })), wrappers, layer, relationRank,
            source: declaration.source });
        }
      }
    }
  }

  for (const { wrappers, condition, layer, targets } of ownershipGroups) {
    for (const target of targets) {
      const scope = ensureScopePath(roots, target.path);
      for (const { rule, declaration } of target.occurrences) {
        const identity: PureDeclarationIdentity = {
          layer,
          condition,
          state: 'self',
          ...(moduleOrder.get(declaration, { rule, targetPath: target.path }) ?? {}),
          property: declaration.property,
          ...identifyDeclarationValue(declaration, bindings),
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
