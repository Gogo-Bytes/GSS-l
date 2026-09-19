# Compiler and Adapter interfaces

> Status: first-version architecture target. Product semantics are defined by [`language-design.md`](language-design.md), [`mvp-capabilities.md`](mvp-capabilities.md), and the ADRs.

## Architecture boundary

The Compiler uses a ports-and-adapters layout:

```text
React/Vite Adapter
  → application use cases
    → framework-agnostic domain
      → parser, compatibility, asset, and output ports
```

The domain must not import React, JSX, Babel, SWC, Vite, Rollup, filesystem, browser, or process-global registry types.

### Domain concepts

```text
ModuleId
SelectorPath
ScopeTree
Declaration
PropertyEffect
ConditionContext
CascadeLayer
RelationConstraint
CascadeCandidate
PlannedRule
SemanticIdentity
GlobalResource
Diagnostic
```

### Domain services

```text
CascadeResolver
PropertyEffectRegistry
SelectorConstraintAnalyzer
RulePlanner
RuleOrderPlanner
NameAllocator
ResourceRegistry
```

`CascadeResolver` decides winners and ambiguity. `RuleOrderPlanner` only produces deterministic order for rules already proven safe.

## Compiler session

A build or dev server owns one explicit compiler session:

```ts
export type GssCompilerSession = {
  replaceStylesheet(input: ReplaceStylesheetInput): ReplaceStylesheetResult;
  invalidate(moduleId: string): InvalidateResult;
  getScopeSchema(moduleId: string): ScopeSchema | undefined;
  finalize(): FinalizedGssSnapshot;
};

export function createGssCompilerSession(
  config: GssCompilerConfig,
  ports: GssCompilerPorts,
): GssCompilerSession;
```

There is no process-global singleton.

### Configuration

```ts
export type GssCompilerConfig = {
  projectRoot: string;
  conditions: RegisteredConditionConfig;
  layers: RegisteredLayerConfig;
  naming: NameAllocatorConfig;
  compatibility: CompatibilityTargetConfig;
  atomizationFallback?: "preserve-module" | "error";
};
```

`atomizationFallback` defaults to `"preserve-module"`. It applies only when selectors and scope semantics are valid but property effects or compatibility sequences cannot be safely atomized. It never converts parse, scoping, selector-safety, ordering, or resource-conflict errors into successful output.

`projectRoot` is used to derive stable logical Module ids. Absolute paths never enter semantic identity or emitted output.

### Replace input

```ts
export type ReplaceStylesheetInput = {
  id: string;
  source: string;
};
```

`replaceStylesheet()` is transactional:

1. parse and normalize CSS nesting;
2. validate the positive capability set;
3. build framework-agnostic IR;
4. resolve selector paths, cascade winners, and property effects;
5. plan pure/contextual atoms, markers, and resources;
6. if atomic proof fails for a recoverable reason, discard that plan and prepare one whole-Module preserved contribution;
7. prepare the complete Module contribution, mode, fallback reasons, and resources;
8. commit only if no error diagnostic exists.

A failed replacement leaves the previous successful contribution active.

### Replace result

```ts
export type ReplaceStylesheetResult = {
  id: string;
  committed: boolean;
  generation: number;
  module?: StyleModuleArtifact;
  diagnostics: readonly GssDiagnostic[];
};

export type StyleModuleArtifact = {
  id: string;
  scopeSchema: ScopeSchema;
  moduleCode: string;
  declarationCode: string;
  dependencies: readonly GssDependency[];
  compilationMode: "atomic" | "preserved";
  fallbackReasons: readonly GssFallbackReason[];
  sourceMap?: SourceMapArtifact;
};
```

The Adapter decides whether error diagnostics fail a build, show an overlay, or are returned to another host.

## Scope schema

The Compiler exposes structure, not framework AST:

```ts
export type ScopeSchema = {
  moduleId: string;
  exports: Readonly<Record<string, ScopeNodeSchema>>;
};

export type ScopeNodeSchema = {
  selfClassName: string;
  targets: Readonly<Record<string, ScopeNodeSchema>>;
};
```

Example `.gss`:

```gss
.father {}
.father .son {}
.father .son .icon {}
```

Conceptual schema:

```ts
{
  exports: {
    father: {
      selfClassName: "...",
      targets: {
        son: {
          selfClassName: "...",
          targets: {
            icon: {
              selfClassName: "...",
              targets: {},
            },
          },
        },
      },
    },
  },
}
```

The emitted JavaScript presents targets directly as properties:

```js
const father = {
  self: "...",
  son: {
    self: "...",
    icon: {
      self: "...",
    },
  },
};

export default { father };
```

`targets` is an internal schema namespace, not part of the authored JavaScript interface.

## Generated TypeScript declarations

Generated declarations use a branded phantom intersection so React `className` accepts a scope reference while target properties remain visible:

```ts
declare const GSS_SCOPE: unique symbol;

export type GssScope<TTargets> =
  string &
  TTargets & {
    /** Concrete class string. Use outside JSX className. */
    readonly self: string;
    readonly [GSS_SCOPE]: true;
  };
```

Example:

```ts
declare const styles: {
  readonly father: GssScope<{
    readonly son: GssScope<{
      readonly icon: GssScope<{}>;
    }>;
  }>;
};

export default styles;
```

The type is a compile-time interface. The runtime value is the static object shown above; the React Adapter guarantees contextual lowering and reports unsupported escape.

## React style-usage Adapter

The React Adapter owns JSX and binding analysis:

```ts
export type ReactStyleUsageAdapter = {
  transform(input: ReactTransformInput): ReactTransformResult;
};

export type ReactTransformInput = {
  id: string;
  source: string;
  resolveScopeSchema: (importId: string) => ScopeSchema | undefined;
};

export type ReactTransformResult = {
  code: string;
  map?: SourceMapArtifact;
  dependencies: readonly string[];
  diagnostics: readonly GssDiagnostic[];
};
```

Responsibilities:

- identify imports from `.gss` Modules;
- resolve longest static style path;
- lower scope references inside JSX `className` to `.self`;
- lower GSS references nested inside the `className` expression, including `cx(...)` arguments;
- propagate supported local immutable direct, conditional, and property aliases;
- report unknown paths and unsupported scope-object escape;
- preserve all non-GSS expressions without analyzing class conflict.

It does not resolve CSS winners, infer DOM structure, or interpret `cx()`.

## Finalization

```ts
export type FinalizedGssSnapshot = {
  generation: number;
  css: string;
  manifest: GssManifest;
  report: GssReport;
  sourceMap?: SourceMapArtifact;
};
```

`finalize()`:

1. reads the complete committed Module census;
2. removes zero-reference atoms, markers, and resources;
3. resolves configured condition and layer ranks;
4. orders already-safe rules using `RuleOrderPlanner`;
5. emits one central production CSS snapshot;
6. emits resource and source mappings;
7. returns byte-stable output for an unchanged semantic snapshot.

Production emits the finalized CSS as one asset. Development replaces the single style owner's complete text with the new generation.

## Module invalidation

```ts
export type InvalidateResult = {
  id: string;
  changed: boolean;
  generation: number;
};
```

`invalidate(id)` removes that Module contribution and decrements references. A subsequent `finalize()` omits resources whose reference count reached zero.

## Planned output

```ts
export type PlannedRule =
  | PureAtomicRule
  | ContextualAtomicRule;

export type PureAtomicRule = {
  kind: "pure-atom";
  identity: SemanticIdentity;
  declaration: ResolvedDeclaration;
};

export type ContextualAtomicRule = {
  kind: "contextual-atom";
  identity: SemanticIdentity;
  selector: ContextualSelectorPlan;
  declaration: ResolvedDeclaration;
};
```

Each planned CSS rule has one semantic declaration. Transformer-generated compatibility declarations remain an indivisible physical expansion of that one semantic declaration.

Global resources use a separate union:

```ts
export type GlobalResource =
  | KeyframesResource
  | FontFaceResource
  | PropertyRegistrationResource
  | LayerOrderResource;
```

## Ports

```ts
export type GssCompilerPorts = {
  cssParser: CssParserPort;
  compatibilityTransformer: CompatibilityTransformerPort;
  assetResolver: AssetResolverPort;
  nameAllocator: NameAllocatorPort;
};
```

The ports keep infrastructure replaceable:

- parser implementation can change without changing domain IR;
- browserslist lowering stays outside authored declaration resolution;
- Vite/Rollup URL emission stays outside the Compiler domain;
- readable first-version names can later be replaced by short/hash names.

## Diagnostics

```ts
export type GssDiagnostic = {
  code: string;
  severity: "info" | "warning" | "error";
  phase:
    | "parse"
    | "normalize"
    | "validate"
    | "resolve"
    | "plan"
    | "registry"
    | "render"
    | "react-transform";
  message: string;
  id: string;
  range?: SourceRange;
  path?: readonly string[];
  reason?: string;
  suggestion?: string;
};
```

Expected user errors return diagnostics. Exceptions are reserved for violated Compiler invariants.

Diagnostics are sorted by source range, code, and path. No result contains timestamps, random ids, or absolute project paths.

## Manifest

The manifest supports source and semantic inspection:

```ts
export type GssManifest = {
  modules: readonly ManifestModule[];
  rules: readonly ManifestRule[];
  resources: readonly ManifestResource[];
  conditions: readonly ManifestCondition[];
  layers: readonly ManifestLayer[];
};
```

It records:

- source declaration to final rule/name mapping;
- all sources sharing an atom;
- scope and target paths;
- pure versus contextual planning;
- condition/layer/relation/property order components;
- authored/generated keyframe names;
- font and asset dependencies;
- warnings whose precedence lies outside the guarantee.

## Report

The report is for governance and later optimization. It records at least:

- source, pure-atomic, contextual, and resource declaration counts;
- CSS and generated JavaScript raw/gzip/Brotli sizes;
- class string cost;
- condition/layer registration warnings;
- deferred or rejected capability diagnostics;
- central asset composition.

The first readable naming strategy is measured through this report before any short/hash allocator replaces it.

## Reference testing interface

The testing package owns a separate seam:

```ts
export function compileGssReference(
  input: CompileGssReferenceInput,
  ports: ReferenceCompilerPorts,
): ReferenceCompileResult;
```

The reference renderer shares syntax and source infrastructure but does not call `CascadeResolver`, `RulePlanner`, `RuleOrderPlanner`, or `NameAllocator` from the atomic path.

Browser oracle fixtures render reference and atomic mappings in isolated documents and compare touched computed properties under the same state and condition matrix.

## Determinism and invariants

For the same logical Module sources and project configuration, output is independent of:

- Module registration order;
- parallel worker completion order;
- filesystem absolute path;
- HMR history;
- hash-map iteration order.

The following are invariant failures:

- a winner depends on emitted name ordering;
- two semantic identities receive one emitted name;
- a target token references a missing planned rule;
- an uncommitted Module contribution appears in `finalize()`;
- stale HMR generation replaces a newer snapshot;
- atomic output cannot be traced to source and semantic identity.
