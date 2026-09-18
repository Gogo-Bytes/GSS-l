export type GssDiagnostic = {
  code: string;
  severity: 'info' | 'warning' | 'error';
  phase: 'parse' | 'normalize' | 'validate' | 'resolve' | 'plan' | 'registry' | 'render';
  message: string;
  id: string;
  reason?: string;
  suggestion?: string;
};

export type ScopeNodeSchema = {
  selfClassName: string;
  targets: Readonly<Record<string, ScopeNodeSchema>>;
};

export type ScopeSchema = {
  moduleId: string;
  exports: Readonly<Record<string, ScopeNodeSchema>>;
};

export type StyleModuleArtifact = {
  id: string;
  scopeSchema: ScopeSchema;
  moduleCode: string;
  declarationCode: string;
  dependencies: readonly string[];
};

export type ReplaceStylesheetInput = {
  id: string;
  source: string;
};

export type ReplaceStylesheetResult = {
  id: string;
  committed: boolean;
  generation: number;
  module?: StyleModuleArtifact;
  diagnostics: readonly GssDiagnostic[];
};

export type FinalizedGssSnapshot = {
  generation: number;
  css: string;
  manifest: {
    modules: readonly string[];
    rules: readonly {
      kind: 'pure-atom' | 'contextual-atom';
      className: string;
      selector: string;
      property: string;
      value: string;
      important: boolean;
      sources: readonly string[];
    }[];
  };
  report: {
    modules: number;
    rules: number;
  };
};

export type GssCompilerConfig = {
  projectRoot: string;
};

export type GssCompilerSession = {
  replaceStylesheet(input: ReplaceStylesheetInput): ReplaceStylesheetResult;
  invalidate(moduleId: string): { id: string; changed: boolean; generation: number };
  getScopeSchema(moduleId: string): ScopeSchema | undefined;
  finalize(): FinalizedGssSnapshot;
};
