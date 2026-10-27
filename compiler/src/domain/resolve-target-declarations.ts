import { effectsOfProperty } from './property-effects.js';
import { comparePropertyRenderOrder } from './module-order-policy.js';
import type { SourceSpan } from './parsed-stylesheet.js';

type DeclarationCandidate = {
  property: string;
  value: string;
  important: boolean;
  source: SourceSpan;
};

type RuleCandidate = {
  path: readonly string[];
  declarations: readonly DeclarationCandidate[];
  sourceOrdinal: number;
};

export type ResolvedTarget<R extends RuleCandidate> = {
  path: readonly string[];
  declarations: readonly DeclarationCandidate[];
  occurrences: readonly { rule: R; declaration: DeclarationCandidate }[];
};

type RankedDeclaration<R extends RuleCandidate> = {
  rule: R;
  declaration: DeclarationCandidate;
  specificity: number;
  sourceOrdinal: number;
  declarationOrdinal: number;
};

export function resolveTargetDeclarations<R extends RuleCandidate>(
  rules: readonly R[],
  declaredTargetPaths: readonly (readonly string[])[] = rules.map(({ path }) => path)
): readonly ResolvedTarget<R>[] {
  const targetPaths = new Map<string, readonly string[]>();
  for (const path of declaredTargetPaths) targetPaths.set(serializePath(path), path);

  return [...targetPaths.values()].map((targetPath) => {
    const occurrences = resolveOneTarget(rules, targetPath);
    return { path: targetPath, declarations: occurrences.map(({ declaration }) => declaration), occurrences };
  });
}

function resolveOneTarget<R extends RuleCandidate>(
  rules: readonly R[],
  targetPath: readonly string[]
): readonly RankedDeclaration<R>[] {
  const winners = new Map<string, RankedDeclaration<R>>();

  for (const rule of rules) {
    if (!isMatchingGeneralPath(rule.path, targetPath)) continue;

    rule.declarations.forEach((declaration, declarationOrdinal) => {
      const candidate: RankedDeclaration<R> = {
        rule,
        declaration,
        specificity: rule.path.length,
        sourceOrdinal: rule.sourceOrdinal,
        declarationOrdinal
      };
      for (const effect of effectsOfProperty(declaration.property)) {
        const current = winners.get(effect);
        if (!current || comparePrecedence(candidate, current) > 0) {
          winners.set(effect, candidate);
        }
      }
    });
  }

  return [...new Set(winners.values())]
    .sort((left, right) => comparePropertyRenderOrder(left.declaration.property, right.declaration.property));
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

function comparePrecedence(left: RankedDeclaration<RuleCandidate>, right: RankedDeclaration<RuleCandidate>): number {
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
