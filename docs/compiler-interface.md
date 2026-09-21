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

`projectRoot` is used to derive stable logical Module ids. Absolute paths never enter semantic identity or emitted names. Root-external stylesheets use relative ids such as `../shared/Card.gss` ([ADR-0047](adr/0047-use-project-relative-identities-for-root-external-stylesheets.md)); the host canonicalizes physical root/source paths. Physical ids remain session transaction/lookup keys. Sources on another Windows drive or UNC share fail closed because no project-relative identity can be expressed. The Compiler performs lexical path conversion only and does not read the filesystem.

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

## TypeScript declaration strategy

The first version does not generate or require a per-Module `.gss.d.ts` file. The integration provides one global wildcard declaration backed by the branded recursive types from `@gss-l/types`:

```ts
import type { GssStyles } from '@gss-l/types';

declare module '*.gss' {
  const styles: GssStyles;
  export default styles;
}
```

`GssScope<TTargets>` models a runtime scope object and exposes only `self: string` as the concrete class string. The wildcard declaration intentionally does not promise that a particular `styles.<path>` exists; the React Adapter validates actual paths against `ScopeSchema` and reports unknown paths during transformation. Precise IDE completion and per-Module declaration generation are deferred to a future IDE integration.

## Shared source Adapter port

Accepted in [ADR-0046](adr/0046-discover-source-imports-before-synchronous-transform.md), exported from `@gss-l/compiler` as an application port:

```ts
export type GssSourceAdapter = {
  supports(id: string): boolean;
  discoverImports(input: { id: string; source: string }): readonly string[];
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
```

`SourceMapArtifact` is source-map v3 data without a third-party editor type. `SourceAdapterDiagnostic` carries `code`, `severity`, `phase`, `message`, `id`, and optional `reason`/`suggestion`; it contains no framework AST or host objects.

`discoverImports()` returns original import specifiers synchronously and does not read files. The host asynchronously resolves and compiles those dependencies before invoking the synchronous transform with a ScopeSchema resolver keyed by original specifier. Errors stop the current transformation; warnings continue. A failed replacement retains the Compiler's last-known-good contribution, but that old schema must not mask the current error.

The implemented composition is:

```ts
import { gss } from '@gss-l/vite';
import { react } from '@gss-l/react';

const plugin = gss({ adapter: react() });
```

`gss()` returns a Vite plugin and requires an explicit Adapter. Its session is owned by that integration instance. Stable virtual IDs are encoded/decoded in one Vite-owned module; resolution does not compile. Both virtual JS load and source precompilation use the physical id and the same session. `react()` reuses the existing React transform, including source maps and unknown-path diagnostics.

Current implementation covers virtual JS, source composition, and dev central CSS/HTML/HMR. Development serves the entire `finalize().css` snapshot at `/@gss-l/central.css`; each Vite-managed HTML entry receives one base-aware stylesheet link. File replacement/deletion/recreation invalidates CSS, virtual JS, and recorded source importers. Failed compilation preserves committed CSS while reporting an error. Superseded reads cannot commit; concurrently awaiting consumers follow the newest compilation result, never a stale successful fallback.

Initial discovery refreshes any already-served snapshot; an HMR connection established after compilation is resynchronized through Vite's native CSS update protocol. No custom browser runtime or public HMR API is introduced. Dev file reads honor Vite `server.fs`, including denies and canonical root-external targets.

Production central assets and versioned build metadata are implemented as described below. Asset URL processing is not yet implemented. The broader configuration/Compiler port sketches elsewhere in this document remain architecture targets rather than additional `gss()` options.

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

## Production build files (implemented)

[ADR-0048](adr/0048-emit-versioned-production-css-manifest-and-report.md) defines three outputs for a non-empty reachable GSS census:

- One CSS asset emitted with `name: 'gss.css'`; Rollup/Vite `assetFileNames` determines its final path/hash.
- `gss-manifest.json`: `{ version: 1, cssAsset, compiler: snapshot.manifest }`.
- `gss-report.json`: `{ version: 1, cssAsset, compiler: snapshot.report }`.

`cssAsset` is an output-directory-relative filename without deployment base or URL encoding. Each emitted HTML entry gets one stylesheet link; absolute/CDN base and HTML-relative base are resolved independently of the JSON value. Existing matching links are not duplicated, and pre-existing assets with either reserved JSON filename cause a build error.

At `generateBundle`, the Adapter enumerates the complete Rollup Module graph, including lazy dependencies, rather than relying on early CSS loads or only on rendered chunk contents. The census follows static, dynamic and implicit dependency edges from entries, excluding speculative loads without an entry path. Only GSS Modules in that census contribute. Private Rollup metadata retains the source snapshot that produced each Module's JavaScript; finalization replays those snapshots into clean registry state, without rereading files after graph construction. Cached preserved Modules are explicitly refreshed because their CSS can change without changing generated JavaScript.

An empty census emits none of these files and adds no link. A reachable empty stylesheet still has a manifest entry and an empty central CSS asset. Manifest Module ids and rule/resource sources are logical ids, not physical session keys. The JSON payloads reuse the current `FinalizedGssSnapshot` structures; the broader manifest/report sketches below describe remaining architecture targets, not extra fields already emitted by version 1.

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
