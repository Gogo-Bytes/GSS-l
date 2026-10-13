import type { SourceMapArtifact } from './application/source-adapter.js';

/** Zero-based UTF-16 offsets into the original caller CSS, with an exclusive end. */
export type GssSourceRange = { start: number; end: number };

/** Every authored origin retained by a live emitted contribution, using a logical Module id. */
export type GssManifestOrigin = { moduleId: string; range: GssSourceRange };

export type GssDiagnostic = {
  code: string;
  severity: 'info' | 'warning' | 'error';
  phase: 'parse' | 'normalize' | 'validate' | 'resolve' | 'plan' | 'registry' | 'render';
  message: string;
  id: string;
  /** Absent when reliable original-source attribution is unavailable. */
  range?: GssSourceRange;
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
  reason: 'property-effect-not-registered' | 'compatibility-sequence-unatomizable';
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

export type GssAssetReference = {
  /** CSS-decoded authored URL, including query/fragment. */
  url: string;
  /** Host-resolved stable logical reference identity, including query/fragment semantics. */
  identity: string;
};

export type FinalizeGssOptions = {
  resolveAssetUrl?: (identity: string) => string;
};

export type ReplaceStylesheetInput = {
  id: string;
  source: string;
  assetReferences?: readonly GssAssetReference[];
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
  /** Source map v3 for generated CSS; shared rules choose a stable primary origin. */
  sourceMap: SourceMapArtifact & { version: 3 };
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
      origins: readonly GssManifestOrigin[];
    }[];
    /** One entry per emitted preserved rule, in CSS emission order. */
    preservedRules: readonly GssManifestOrigin[];
    rules: readonly {
      kind: 'pure-atom' | 'contextual-atom';
      className: string;
      selector: string;
      property: string;
      value: string;
      important: boolean;
      sources: readonly string[];
      origins: readonly GssManifestOrigin[];
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
  /** Ordered host CSS transform/minification stages, each with resolved minimum browser versions. */
  compatibilityTargetStages?: readonly Readonly<Record<string, string>>[];
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
  finalize(options?: FinalizeGssOptions): FinalizedGssSnapshot;
};
