import { getOwnershipPath } from './ownership-path.js';
import type { GssDiagnostic } from '../public-types.js';
import type { ParsedSelectorNode, SourceSpan } from './parsed-stylesheet.js';

type DeclarationCandidate = {
  source: SourceSpan;
  property: string;
  important: boolean;
};

type RuleCandidate = {
  nodes: readonly Pick<ParsedSelectorNode, 'name'>[];
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
          message: `Duplicate declaration for ${declaration.property} in ${getOwnershipPath(rule.nodes).map((name) => `.${name}`).join(' ')}.`,
          id,
          ...(declaration.source.sourceId === id ? {
            range: { start: declaration.source.start, end: declaration.source.end }
          } : {}),
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
