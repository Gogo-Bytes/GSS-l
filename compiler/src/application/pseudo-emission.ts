import { getOwnershipPath } from '../domain/ownership-path.js';
import type { ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { PureDeclarationIdentity } from '../domain/readable-name.js';
import type { DescendantInstance } from '../domain/plan-descendant-conditions.js';
import { isPseudoElementRule } from '../domain/rule-classification.js';
import { identifyAssetValue } from './asset-values.js';
import { canonicalCondition } from './condition-context.js';
import { renderStateSuffix } from './selector-rendering.js';
import { ensureScopePath } from './scope-exports.js';
import type { AtomicEmissionContext } from './atomic-emission-context.js';

/** Preserve declared pseudo scope paths and the authored subject specificity. */
export function emitPseudoRules(input: AtomicEmissionContext & {
  localRules: readonly ParsedStyleRule[];
  instances: readonly DescendantInstance<ParsedStyleRule>[];
}): void {
  const { rules, localRules, instances, moduleId, bindings, nameAllocator, roots, moduleOrder } = input;
  // Declared pseudo paths remain public scopes even when no declarations survive planning.
  for (const rule of localRules) {
    if (isPseudoElementRule(rule)) ensureScopePath(roots, getOwnershipPath(rule.nodes));
  }
  for (const instance of instances) {
    const { rule, targetPath, declarations, relationRank } = instance;
    const node = rule.nodes.at(-1)!;
    const pseudoElement = node.pseudoElement!;
    const state = node.states.join(':') || 'self';
    const wrappers = rule.conditions;
    const condition = canonicalCondition(wrappers);
    const layer = rule.layer;
    const scope = ensureScopePath(roots, targetPath);
    for (const declaration of declarations) {
      const identity: PureDeclarationIdentity = {
        layer, condition, state, pseudoElement,
        ...(moduleOrder.get(declaration, instance) ?? {}),
        property: declaration.property,
        ...identifyAssetValue(declaration.value, bindings),
        important: declaration.important,
        ...(rule.nodes.length > 1 ? { ownership: { moduleId, path: targetPath, specificity: rule.nodes.length } } : {})
      };
      const className = nameAllocator.createAtomicName(identity);
      scope.classNames.add(className);
      rules.push({
        kind: state === 'self' ? 'pure-atom' : 'contextual-atom',
        identity, className,
        // Keep authored class specificity on this target-qualified atom, not a shared weaker atom.
        selector: `${`.${className}`.repeat(rule.nodes.length)}${renderStateSuffix([state], moduleId, nameAllocator, roots)}::${pseudoElement}`,
        wrappers, layer, relationRank, source: declaration.source
      });
    }
  }

}
