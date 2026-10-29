import type { AtomicEmissionContext } from './atomic-emission-context.js';
import type { ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { PureDeclarationIdentity } from '../domain/readable-name.js';
import type { GssDiagnostic } from '../public-types.js';
import { classifyPropertyEffect } from '../domain/property-effects.js';
import { identifyAssetValue } from './asset-values.js';
import { canonicalCondition } from './condition-context.js';
import { ensureScopePath } from './scope-exports.js';

/** Render admitted external selectors. External nodes do not become exported
 * scopes; overlap remains fail-closed until relation semantics are proved. */
export function emitExternalRules(input: AtomicEmissionContext & {
  id: string;
  sameNodeRules: readonly ParsedStyleRule[];
  externalRules: readonly ParsedStyleRule[];
}): { diagnostics: readonly GssDiagnostic[] } | undefined {
  const { rules, sameNodeRules, externalRules, moduleId, bindings, nameAllocator, roots, moduleOrder } = input;
  for (const rule of sameNodeRules) {
    const scope = ensureScopePath(roots, rule.path);
    const ancestorMarkers = rule.path.slice(0, -1).map((_, index) => {
      const path = rule.path.slice(0, index + 1);
      const marker = nameAllocator.createScopeMarker(moduleId, path);
      ensureScopePath(roots, path).classNames.add(marker);
      return marker;
    });
    const effects = new Set<string>();
    for (const declaration of rule.declarations) {
      const declarationEffects = classifyPropertyEffect(declaration.property).effects;
      if (declarationEffects.some((effect) => effects.has(effect))) {
        return { diagnostics: [{
          code: 'GSS1205', severity: 'error', phase: 'resolve', id: input.id,
          reason: 'ambiguous-coactive-state-conflict',
          message: 'Same-node external condition declarations have overlapping property effects.'
        }] };
      }
      declarationEffects.forEach((effect) => effects.add(effect));
      const identity: PureDeclarationIdentity = {
        layer: rule.layer, condition: canonicalCondition(rule.conditions),
        state: `external-condition:${rule.externalCondition!}`,
        ...(moduleOrder.get(declaration, { rule, targetPath: rule.path }) ?? {}),
        ownership: { moduleId, path: rule.path, specificity: rule.path.length },
        property: declaration.property,
        ...identifyAssetValue(declaration.value, bindings),
        important: declaration.important
      };
      const className = nameAllocator.createAtomicName(identity);
      scope.classNames.add(className);
      const ownedSelector = [...ancestorMarkers, className].map((marker) => `.${marker}`).join(' ');
      rules.push({
        kind: 'contextual-atom', identity, className,
        selector: `${ownedSelector}${rule.externalCondition}`,
        wrappers: rule.conditions, layer: rule.layer, source: declaration.source
      });
    }
  }

  // External descendants receive CSS but no exported scope or generated DOM class.
  // Keep overlapping effect families fail-closed until the contextual cascade
  // planner can prove a winner across external selector branches.
  const externalEffects = new Set<string>();
  for (const rule of externalRules) {
    const scope = ensureScopePath(roots, rule.path);
    const ancestorMarkers = rule.path.slice(0, -1).map((_, index) => {
      const path = rule.path.slice(0, index + 1);
      const marker = nameAllocator.createScopeMarker(moduleId, path);
      ensureScopePath(roots, path).classNames.add(marker);
      return marker;
    });
    for (const declaration of rule.declarations) {
      const effects = classifyPropertyEffect(declaration.property).effects;
      if (effects.some((effect) => externalEffects.has(effect))) {
        return { diagnostics: [{
          code: 'GSS1205', severity: 'error', phase: 'resolve', id: input.id,
          reason: 'ambiguous-coactive-state-conflict',
          message: 'External target declarations have overlapping property effects.'
        }] };
      }
      effects.forEach((effect) => externalEffects.add(effect));
      const identity: PureDeclarationIdentity = {
        layer: rule.layer, condition: canonicalCondition(rule.conditions),
        state: `external:${rule.externalTarget!}`,
        ...(moduleOrder.get(declaration, { rule, targetPath: rule.path }) ?? {}),
        ownership: { moduleId, path: rule.path, specificity: rule.path.length },
        property: declaration.property,
        ...identifyAssetValue(declaration.value, bindings),
        important: declaration.important
      };
      const className = nameAllocator.createAtomicName(identity);
      scope.classNames.add(className);
      rules.push({
        kind: 'contextual-atom', identity, className,
        selector: `${[...ancestorMarkers, className].map((marker) => `.${marker}`).join(' ')} ${rule.externalTarget}`,
        wrappers: rule.conditions, layer: rule.layer, source: declaration.source
      });
    }
  }

  return undefined;
}
