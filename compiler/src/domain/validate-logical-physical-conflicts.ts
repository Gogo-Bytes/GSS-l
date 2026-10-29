import type { GssDiagnostic } from '../public-types.js';
import { classifyPropertyEffect } from './property-effects.js';
import { isPureOwnershipRule } from './rule-classification.js';
import { matchesOwnedTarget } from './ownership-path.js';

const conflictingPhysicalProperties: Readonly<Record<string, readonly string[]>> = {
  'margin-inline': ['margin', 'margin-left', 'margin-right'],
  'margin-inline-start': ['margin', 'margin-left', 'margin-right'],
  'margin-inline-end': ['margin', 'margin-left', 'margin-right'],
  'margin-block': ['margin', 'margin-top', 'margin-bottom'],
  'margin-block-start': ['margin', 'margin-top', 'margin-bottom'],
  'margin-block-end': ['margin', 'margin-top', 'margin-bottom'],
  'padding-inline': ['padding', 'padding-left', 'padding-right'],
  'padding-inline-start': ['padding', 'padding-left', 'padding-right'],
  'padding-inline-end': ['padding', 'padding-left', 'padding-right'],
  'padding-block': ['padding', 'padding-top', 'padding-bottom'],
  'padding-block-start': ['padding', 'padding-top', 'padding-bottom'],
  'padding-block-end': ['padding', 'padding-top', 'padding-bottom'],
  'inset-inline': ['inset', 'left', 'right'],
  'inset-inline-start': ['inset', 'left', 'right'],
  'inset-inline-end': ['inset', 'left', 'right'],
  'inset-block': ['inset', 'top', 'bottom'],
  'inset-block-start': ['inset', 'top', 'bottom'],
  'inset-block-end': ['inset', 'top', 'bottom']
};

type RuleCandidate = {
  path: readonly string[];
  nodes: readonly { states: readonly unknown[]; attributes: readonly unknown[];
    observations: readonly unknown[]; pseudoElement: string | null }[];
  externalTarget?: string;
  externalCondition?: string;
  layer: string;
  conditions: readonly unknown[];
  relations: readonly string[];
  states: readonly (readonly string[])[];
  attributes: readonly (readonly unknown[])[];
  observations: readonly (readonly unknown[])[];
  pseudoElements: readonly (string | null)[];
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
      rule.path,
      rule.externalTarget ?? null,
      rule.externalCondition ?? null,
      rule.layer,
      rule.conditions,
      rule.relations,
      rule.states,
      rule.attributes,
      rule.observations,
      rule.pseudoElements
    ]);
    add(key, rule);
  }

  const ownershipRules = rules.filter(isLocalPureOwnershipRule);
  const targetPaths = new Map<string, readonly string[]>();
  for (const rule of rules) {
    if (rule.externalTarget === undefined && rule.externalCondition === undefined) {
      targetPaths.set(JSON.stringify(rule.path), rule.path);
    }
  }
  for (const targetPath of targetPaths.values()) {
    for (const candidate of ownershipRules) {
      if (!matchesOwnedTarget(candidate.path, targetPath)) continue;
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
