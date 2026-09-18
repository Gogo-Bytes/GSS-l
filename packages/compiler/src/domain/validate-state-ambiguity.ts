import type { GssDiagnostic } from '../public-types.js';

type DeclarationCandidate = {
  property: string;
  value: string;
  important: boolean;
};

type RuleCandidate = {
  path: readonly string[];
  relations: readonly string[];
  states: readonly (readonly string[])[];
  attributes: readonly (readonly unknown[])[];
  declarations: readonly DeclarationCandidate[];
};

type StateRule = {
  pathKey: string;
  states: readonly string[];
  declarations: readonly DeclarationCandidate[];
};

export function validateStateAmbiguity(
  id: string,
  rules: readonly RuleCandidate[]
): readonly GssDiagnostic[] {
  const stateRules = rules.flatMap((rule): StateRule[] => {
    const states = canonicalStates(rule.states.at(-1) ?? []);
    const isCurrentStateRule =
      states.length > 0 &&
      rule.relations.every((relation) => relation === 'descendant') &&
      rule.states.slice(0, -1).every((entry) => entry.length === 0) &&
      rule.attributes.every((entry) => entry.length === 0);
    return isCurrentStateRule
      ? [{ pathKey: JSON.stringify(rule.path), states, declarations: rule.declarations }]
      : [];
  });

  for (let leftIndex = 0; leftIndex < stateRules.length; leftIndex += 1) {
    const left = stateRules[leftIndex]!;
    for (let rightIndex = leftIndex + 1; rightIndex < stateRules.length; rightIndex += 1) {
      const right = stateRules[rightIndex]!;
      if (left.pathKey !== right.pathKey) continue;
      if (left.states.join('\0') === right.states.join('\0')) continue;
      if (left.states.length !== right.states.length) continue;

      for (const leftDeclaration of left.declarations) {
        const rightDeclaration = right.declarations.find(
          ({ property }) => property === leftDeclaration.property
        );
        if (!rightDeclaration) continue;
        if (leftDeclaration.important !== rightDeclaration.important) continue;
        if (leftDeclaration.value === rightDeclaration.value) continue;

        const intersection = canonicalStates([...left.states, ...right.states]);
        if (hasExplicitIntersection(stateRules, left.pathKey, intersection, leftDeclaration.property)) {
          continue;
        }

        return [{
          code: 'GSS1205',
          severity: 'error',
          phase: 'resolve',
          message: `Coactive states :${left.states.join(':')} and :${right.states.join(':')} assign different ${leftDeclaration.property} values at equal precedence.`,
          id,
          reason: 'ambiguous-coactive-state-conflict',
          suggestion: `Add an explicit :${intersection.join(':')} rule for ${leftDeclaration.property}, or make the conditions mutually exclusive.`
        }];
      }
    }
  }

  return [];
}

function hasExplicitIntersection(
  rules: readonly StateRule[],
  pathKey: string,
  intersection: readonly string[],
  property: string
): boolean {
  const stateKey = intersection.join('\0');
  return rules.some((rule) =>
    rule.pathKey === pathKey &&
    rule.states.join('\0') === stateKey &&
    rule.declarations.some((declaration) => declaration.property === property)
  );
}

function canonicalStates(states: readonly string[]): readonly string[] {
  return [...new Set(states)].sort();
}
