type DeclarationCandidate = {
  property: string;
  value: string;
  important: boolean;
};

type RuleCandidate = {
  path: readonly string[];
  declarations: readonly DeclarationCandidate[];
  sourceOrdinal: number;
};

export type ResolvedTarget = {
  path: readonly string[];
  declarations: readonly DeclarationCandidate[];
};

type RankedDeclaration = {
  declaration: DeclarationCandidate;
  specificity: number;
  sourceOrdinal: number;
  declarationOrdinal: number;
};

export function resolveTargetDeclarations(
  rules: readonly RuleCandidate[]
): readonly ResolvedTarget[] {
  const targetPaths = new Map<string, readonly string[]>();
  for (const rule of rules) targetPaths.set(serializePath(rule.path), rule.path);

  return [...targetPaths.values()].map((targetPath) => ({
    path: targetPath,
    declarations: resolveOneTarget(rules, targetPath)
  }));
}

function resolveOneTarget(
  rules: readonly RuleCandidate[],
  targetPath: readonly string[]
): readonly DeclarationCandidate[] {
  const winners = new Map<string, RankedDeclaration>();

  for (const rule of rules) {
    if (!isMatchingGeneralPath(rule.path, targetPath)) continue;

    rule.declarations.forEach((declaration, declarationOrdinal) => {
      const candidate: RankedDeclaration = {
        declaration,
        specificity: rule.path.length,
        sourceOrdinal: rule.sourceOrdinal,
        declarationOrdinal
      };
      const current = winners.get(declaration.property);
      if (!current || comparePrecedence(candidate, current) > 0) {
        winners.set(declaration.property, candidate);
      }
    });
  }

  return [...winners.values()]
    .map(({ declaration }) => declaration)
    .sort((left, right) => left.property.localeCompare(right.property));
}

function isMatchingGeneralPath(
  candidatePath: readonly string[],
  targetPath: readonly string[]
): boolean {
  if (candidatePath.length > targetPath.length) return false;
  if (candidatePath.at(-1) !== targetPath.at(-1)) return false;

  let candidateIndex = 0;
  for (const targetName of targetPath) {
    if (targetName === candidatePath[candidateIndex]) candidateIndex += 1;
  }
  return candidateIndex === candidatePath.length;
}

function comparePrecedence(left: RankedDeclaration, right: RankedDeclaration): number {
  const important = Number(left.declaration.important) - Number(right.declaration.important);
  if (important !== 0) return important;

  const specificity = left.specificity - right.specificity;
  if (specificity !== 0) return specificity;

  const source = left.sourceOrdinal - right.sourceOrdinal;
  if (source !== 0) return source;

  return left.declarationOrdinal - right.declarationOrdinal;
}

function serializePath(path: readonly string[]): string {
  return JSON.stringify(path);
}
