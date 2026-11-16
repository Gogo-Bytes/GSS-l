import { getOwnershipPath } from './ownership-path.js';
import type { GssDiagnostic } from '../public-types.js';
import type { ParsedDeclaration, ParsedStyleRule, ParsedSelectorNode, SourceSpan } from './parsed-stylesheet.js';

type DeclarationCandidate = {
  source: SourceSpan;
  property: string;
  important: boolean;
};

type RuleCandidate = {
  nodes: readonly Pick<ParsedSelectorNode, 'name'>[];
  declarations: readonly DeclarationCandidate[];
};

export function declarationSequence(declaration: ParsedDeclaration): readonly ParsedDeclaration[] {
  const { fallbacks, ...last } = declaration;
  return [...(fallbacks ?? []).map(value => ({ ...last, ...value })), last];
}

export function groupAdjacentDeclarations(rules: readonly ParsedStyleRule[]): readonly ParsedStyleRule[] {
  const groups = new Map<ParsedDeclaration, ParsedDeclaration>();
  return rules.map(rule => {
    const declarations: ParsedDeclaration[] = [];
    for (const declaration of rule.declarations) {
      const previous = declarations.at(-1);
      if (previous?.property === declaration.property && previous.important === declaration.important) {
        const group = groups.get(declaration) ?? { ...declaration, fallbacks: [
          ...(previous.fallbacks ?? []), { value: previous.value, source: previous.source }
        ] };
        groups.set(declaration, group);
        declarations[declarations.length - 1] = group;
      } else declarations.push(declaration);
    }
    return declarations.length === rule.declarations.length ? rule : { ...rule, declarations };
  });
}

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
          suggestion: 'Keep same-property, same-importance fallbacks adjacent or express feature fallback with @supports.'
        });
        continue;
      }
      seen.add(key);
    }
  }

  return diagnostics;
}
