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

export type GssFallbackReason = {
  property: string;
  reason: 'property-effect-not-registered';
};

export type StyleModuleArtifact = {
  id: string;
  scopeSchema: ScopeSchema;
  moduleCode: string;
  declarationCode: string;
  dependencies: readonly string[];
  compilationMode: 'atomic' | 'preserved';
  fallbackReasons: readonly GssFallbackReason[];
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
    moduleDetails: readonly {
      id: string;
      compilationMode: 'atomic' | 'preserved';
      fallbackReasons: readonly GssFallbackReason[];
    }[];
    resources: readonly {
      kind: 'property' | 'keyframes' | 'font-face';
      name: string;
      sources: readonly string[];
    }[];
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
    resources: number;
    atomicModules: number;
    preservedModules: number;
    atomicCoverage: number;
  };
};

export type GssCompilerConfig = {
  projectRoot: string;
  layers?: readonly string[];
  atomizationFallback?: 'preserve-module' | 'error';
  conditions?: {
    media?: readonly string[];
    supports?: readonly string[];
    container?: readonly string[];
  };
};

export type GssCompilerSession = {
  replaceStylesheet(input: ReplaceStylesheetInput): ReplaceStylesheetResult;
  invalidate(moduleId: string): { id: string; changed: boolean; generation: number };
  getScopeSchema(moduleId: string): ScopeSchema | undefined;
  finalize(): FinalizedGssSnapshot;
};
