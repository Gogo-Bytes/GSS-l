import type { GssDiagnostic } from '../public-types.js';

type DeclarationCandidate = {
  property: string;
  important: boolean;
};

type RuleCandidate = {
  path: readonly string[];
  declarations: readonly DeclarationCandidate[];
};

export function validateDeclarationSequences(
  id: string,
  rules: readonly RuleCandidate[]
): readonly GssDiagnostic[] {
  const diagnostics: GssDiagnostic[] = [];

  for (const rule of rules) {
    const seen = new Set<string>();
    for (const declaration of rule.declarations) {
      const key = `${declaration.property}\0${declaration.important ? 'important' : 'normal'}`;
      if (seen.has(key)) {
        diagnostics.push({
          code: 'GSS1204',
          severity: 'error',
          phase: 'resolve',
          message: `Duplicate declaration for ${declaration.property} in ${rule.path.map((name) => `.${name}`).join(' ')}.`,
          id,
          reason: 'duplicate-exact-property',
          suggestion: 'Keep one standard value or express feature fallback with @supports.'
        });
        continue;
      }
      seen.add(key);
    }
  }

  return diagnostics;
}
