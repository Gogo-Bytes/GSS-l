import type { ParsedGlobalResource, ParsedStyleRule } from '../domain/parsed-stylesheet.js';
import type { GssDiagnostic } from '../public-types.js';

export type ParsedStylesheet = {
  rules: readonly ParsedStyleRule[];
  resources: readonly ParsedGlobalResource[];
  diagnostics: readonly GssDiagnostic[];
};

/** Internal synchronous seam. Author failures are diagnostics; adapter/invariant failures throw. */
export type CssParserPort = {
  parseStylesheet(id: string, source: string): ParsedStylesheet;
};
