import { compareCodeUnits } from '../domain/compare-code-units.js';
import type { ParsedCondition, ParsedGlobalResource, ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { GssCompilerConfig, GssDiagnostic } from '../public-types.js';

// These keys preserve authored condition order; they are not a proof that two
// condition expressions are logically equivalent or mutually exclusive.
export function validateRegisteredConditions(
  config: GssCompilerConfig,
  id: string,
  rules: readonly ParsedStyleRule[],
  resources: readonly ParsedGlobalResource[]
): readonly GssDiagnostic[] {
  const unregistered = new Map<string, ParsedCondition>();
  const conditionContexts = [
    ...rules.map(({ conditions }) => conditions),
    ...resources.flatMap((resource) =>
      resource.kind === 'keyframes' ? [resource.conditions] : []
    )
  ];
  for (const conditions of conditionContexts) {
    for (const condition of conditions) {
      const registered = new Set(config.conditions?.[condition.kind] ?? []);
      if (!registered.has(condition.query)) {
        unregistered.set(`${condition.kind}\0${condition.query}`, condition);
      }
    }
  }
  const conditionDiagnostics: GssDiagnostic[] = [...unregistered.values()]
    .sort((left, right) =>
      compareCodeUnits(`${left.kind}\0${left.query}`, `${right.kind}\0${right.query}`)
    )
    .map(({ kind, query }) => ({
      code: 'GSS1102',
      severity: 'warning',
      phase: 'validate',
      message: `@${kind} ${query} is not registered; its relative precedence is not guaranteed.`,
      id,
      reason: 'condition-not-registered',
      suggestion: `Add the exact query to compiler conditions.${kind} in project precedence order.`
    }));

  const registeredLayers = new Set(config.layers ?? []);
  const resourceLayers = resources.flatMap((resource) =>
    resource.kind === 'keyframes' ? [resource.layer] : []
  );
  const unregisteredLayers = new Set(
    [...rules.map(({ layer }) => layer), ...resourceLayers].filter((layer) =>
      layer !== 'unlayered' && !registeredLayers.has(layer)
    )
  );
  const layerDiagnostics: GssDiagnostic[] = [...unregisteredLayers].sort().map((layer) => ({
    code: 'GSS1103',
    severity: 'warning',
    phase: 'validate',
    message: `@layer ${layer} is not registered; its relative precedence is not guaranteed.`,
    id,
    reason: 'layer-not-registered',
    suggestion: 'Add the canonical layer name to compiler layers in project precedence order.'
  }));

  return [...conditionDiagnostics, ...layerDiagnostics];
}

export function groupRulesByCondition(
  rules: readonly ParsedStyleRule[]
): ReadonlyMap<string, readonly ParsedStyleRule[]> {
  const groups = new Map<string, ParsedStyleRule[]>();
  for (const rule of rules) {
    const key = `${rule.layer}\0${canonicalCondition(rule.conditions)}`;
    groups.set(key, [...(groups.get(key) ?? []), rule]);
  }
  return groups;
}

export function canonicalCondition(conditions: readonly ParsedCondition[]): string {
  return conditions.length === 0
    ? 'base'
    : conditions.map(({ kind, query }) => `${kind}:${query}`).join('&&');
}

