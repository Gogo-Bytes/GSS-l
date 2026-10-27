import type { ScopeSchema } from '../public-types.js';

/** Source map v3 data, without a dependency on a particular source editor. */
export type SourceMapArtifact = {
  version: number;
  names: string[];
  sources: string[];
  mappings: string;
  file?: string;
  sourceRoot?: string;
  sourcesContent?: (string | null)[];
};

export type SourceAdapterDiagnostic = {
  code: string;
  severity: 'info' | 'warning' | 'error';
  phase: string;
  message: string;
  id: string;
  reason?: string;
  suggestion?: string;
};

export type GssSourceAdapter = {
  supports(id: string): boolean;
  /** Original import specifiers. No file reads or host resolution. */
  discoverImports(input: { id: string; source: string }): readonly string[];
  /** The host must successfully compile discovered dependencies before calling. */
  transform(input: {
    id: string;
    source: string;
    resolveScopeSchema(importId: string): ScopeSchema | undefined;
  }): {
    code: string;
    map?: SourceMapArtifact;
    diagnostics: readonly SourceAdapterDiagnostic[];
  };
};
