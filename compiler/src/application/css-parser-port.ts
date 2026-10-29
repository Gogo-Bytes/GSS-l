import type { ParsedGlobalResource, ParsedSourceRule, ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { GssDiagnostic } from '../public-types.js';

export type ParsedStylesheet = {
  rules: readonly ParsedSourceRule[];
  resources: readonly ParsedGlobalResource[];
  diagnostics: readonly GssDiagnostic[];
};

/** Temporary path projection. Retains rule/branch order and declaration object
 * identity while existing planners migrate away from the separate path array. */
export type PlanningStylesheet = Omit<ParsedStylesheet, 'rules'> & { rules: readonly ParsedStyleRule[] };

export function projectForPlanning(parsed: ParsedStylesheet): PlanningStylesheet {
  return { ...parsed, rules: parsed.rules.map(({ nodes, ...rule }) => ({
    ...rule,
    nodes,
    path: nodes.map(({ name }) => name)
  })) };
}

/** Internal synchronous seam. Author failures are diagnostics; adapter/invariant failures throw. */
export type CssParserPort = {
  parseStylesheet(id: string, source: string): ParsedStylesheet;
};
