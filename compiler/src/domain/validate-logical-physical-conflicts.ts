import type { GssDiagnostic } from '../public-types.js';
import { classifyPropertyEffect } from './property-effects.js';
import { isPureOwnershipRule } from './rule-classification.js';
import { getOwnershipPath, matchesOwnedTarget } from './ownership-path.js';

// This legacy admission whitelist is narrower than module-order-policy's
// potential-alias relation. Preserve its families, axes and diagnostic order;
// adding a sortable alias does not automatically add a GSS1206 rejection.
const conflictingPhysicalProperties: Readonly<Record<string, readonly string[]>> = Object.fromEntries(
  ['margin', 'padding', 'inset'].flatMap((family) =>
    (['inline', 'block'] as const).flatMap((axis) => {
      const sides = axis === 'inline' ? ['left', 'right'] : ['top', 'bottom'];
      const physical = [family, ...sides.map((side) => family === 'inset' ? side : `${family}-${side}`)];
      return ['', '-start', '-end'].map((suffix) => [`${family}-${axis}${suffix}`, physical]);
    })
  )
);

type RuleCandidate = {
  nodes: readonly { name: string; states: readonly unknown[]; attributes: readonly unknown[];
    observations: readonly unknown[]; pseudoElement: string | null }[];
  externalTarget?: string;
  externalCondition?: string;
  layer: string;
  conditions: readonly unknown[];
  relations: readonly string[];
  declarations: readonly { property: string }[];
};

export function validateLogicalPhysicalConflicts(
  id: string,
  rules: readonly RuleCandidate[],
  allowPureLonghands = true
): readonly GssDiagnostic[] {
  const propertiesByContext = new Map<string, Map<string, Set<RuleCandidate>>>();
  function add(key: string, rule: RuleCandidate) {
    const properties = propertiesByContext.get(key) ?? new Map<string, Set<RuleCandidate>>();
    for (const { property } of rule.declarations) {
      const owners = properties.get(property) ?? new Set<RuleCandidate>();
      owners.add(rule);
      properties.set(property, owners);
    }
    propertiesByContext.set(key, properties);
  }
  for (const rule of rules) {
    const key = JSON.stringify([
      getOwnershipPath(rule.nodes),
      rule.externalTarget ?? null,
      rule.externalCondition ?? null,
      rule.layer,
      rule.conditions,
      rule.relations,
      rule.nodes.map((node) => [node.states, node.attributes, node.observations, node.pseudoElement])
    ]);
    add(key, rule);
  }

  const ownershipRules = rules.filter(isLocalPureOwnershipRule);
  const targetPaths = new Map<string, readonly string[]>();
  for (const rule of rules) {
    if (rule.externalTarget === undefined && rule.externalCondition === undefined) {
      const path = getOwnershipPath(rule.nodes);
      targetPaths.set(JSON.stringify(path), path);
    }
  }
  for (const targetPath of targetPaths.values()) {
    for (const candidate of ownershipRules) {
      if (!matchesOwnedTarget(getOwnershipPath(candidate.nodes), targetPath)) continue;
      const key = JSON.stringify([
        'accumulated',
        targetPath,
        candidate.layer,
        candidate.conditions
      ]);
      add(key, candidate);
    }
  }

  for (const properties of propertiesByContext.values()) {
    for (const logical of Object.keys(conflictingPhysicalProperties).sort()) {
      if (!properties.has(logical)) continue;
      const physical = conflictingPhysicalProperties[logical]!.find((property) => {
        if (!properties.has(property)) return false;
        const owners = new Set([...properties.get(logical)!, ...properties.get(property)!]);
        // The fixed module rank planner orders pure ownership longhands across
        // targets, preserving proven ownership before fixed property priority.
        return !(allowPureLonghands && [...owners].every(isLocalPureOwnershipRule) &&
          classifyPropertyEffect(logical).kind === 'longhand' &&
          classifyPropertyEffect(property).kind === 'longhand');
      });
      if (!physical) continue;
      return [{
        code: 'GSS1206',
        severity: 'error',
        phase: 'resolve',
        message: `${logical} and ${physical} overlap according to writing direction or writing mode.`,
        id,
        reason: 'logical-physical-property-conflict',
        suggestion: 'Use only logical properties or only physical properties within one selector context.'
      }];
    }
  }

  return [];
}

function isLocalPureOwnershipRule(rule: RuleCandidate): boolean {
  return rule.externalTarget === undefined && rule.externalCondition === undefined && isPureOwnershipRule(rule);
}
