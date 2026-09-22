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
  finalize(options?: FinalizeGssOptions): FinalizedGssSnapshot;
};

export function createGssCompilerSession(
  config: GssCompilerConfig,
  ports: GssCompilerPorts,
): GssCompilerSession;
```

There is no process-global singleton.

**Shipped API versus this target sketch:** the exported constructor is still `createGssCompilerSession(config)` with exactly one argument. There is no public `GssCompilerPorts`. The internal [`createCompilerSession`](../packages/compiler/src/application/compiler-session.ts) requires an injectable [`CssParserPort`](../packages/compiler/src/application/css-parser-port.ts); [`default composition`](../packages/compiler/src/compiler.ts) supplies PostCSS outside the application use case. Asset discovery retains its existing public signature. This internal seam does not add public configuration, exports or diagnostic fields.

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
  assetReferences?: readonly GssAssetReference[];
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

Production central assets and versioned build metadata are implemented as described below. Production Asset URL processing and dev versioned resource delivery/HMR are implemented. Dev byte snapshots are served through Vite with existing file-access policy, last-known-good recovery and no new browser runtime; their URLs are internal delivery details, not Compiler identity. The broader configuration/Compiler port sketches elsewhere in this document remain architecture targets rather than additional `gss()` options.

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

The suite above remains a public architecture sketch, not an exported `GssCompilerPorts` or an additional constructor argument today. Only the internal parser seam is implemented in this stage. It returns domain-owned `Parsed*` shapes with internal original-source provenance; no parser AST/host types cross that seam. See [coordinate units and granularity](architecture.md#internal-source-provenance-bounded-implementation). The `AssetResolverPort` configuration slot likewise remains a sketch. The concrete protocol accepted in [ADR-0050](adr/0050-discover-bind-and-render-asset-references.md) is implemented through discovery, replacement input bindings and finalization options:

```ts
export function discoverStylesheetAssets(input: { id: string; source: string }): {
  urls: readonly string[];
  diagnostics: readonly GssDiagnostic[];
};

export type GssAssetReference = {
  url: string;      // CSS-decoded authored URL, not URI-decoded
  identity: string; // stable logical reference identity, including query/fragment semantics
};

export type FinalizeGssOptions = {
  resolveAssetUrl?: (identity: string) => string;
};
```

The host stops on discovery errors, resolves resources asynchronously without modifying committed state, then calls `replaceStylesheet({ id, source, assetReferences })`. Invalid or conflicting bindings fail transactionally with `GSS1501`. Bindings affect atom identity and resource conflict detection before contribution commit; different authored URL spellings can share a resolved identity, while equal text from different source directories need not share one.

`finalize({ resolveAssetUrl })` renders bound references in atoms, contextual declarations, preserved CSS and resources. Missing/empty output URLs throw without changing the session. Results are cached by identity within that finalization, CSS strings are escaped, and manifest declaration values reflect the rendered CSS value rather than private identity encoding. A change to output URL does not change ScopeSchema or class names.

Without bindings, the original standalone Compiler behavior is retained: dependency extraction and authored URL values, with no filesystem checks or automatic deployment rebasing. Vite now uses this protocol for production builds; dev resource integration is still pending.

### Vite production asset lifecycle (implemented)

The Adapter discovers URLs and finishes local resource reads before committing the corresponding contribution. Relative references resolve from the physical `.gss`; canonical file identities use project-relative paths plus query/fragment semantics. Root-path references resolve under `publicDir` and retain a public-route identity. Existing scheme URLs, protocol-relative URLs and fragments pass through without IO. Missing files, disabled `publicDir` for root references and invalid paths fail the build.

Private Rollup Module metadata carries source, bindings and resource byte snapshots. Only final-census Modules contribute emitted assets; speculative loads cannot leak outputs. Files with inconsistent byte snapshots fail rather than selecting a registration-order winner. Resource reads are watched, including missing requested paths, and cached GSS Modules refresh those snapshots even when scope JavaScript is unchanged. Neither byte payloads nor deployment URLs enter generated GSS JavaScript.

Local files are emitted independently through Rollup naming rules, without automatic inlining. Public resources retain Vite's normal public-directory copying behavior rather than being re-emitted under hashes. Referenced public paths cannot collide with GSS metadata, CSS or emitted resource outputs. Query/fragment are preserved and filename path segments are URL-encoded.

For relative base, URLs are relative to the emitted CSS file, not the source Module or HTML entry. CSS naming and URL rendering are checked for a stable result so the final CSS hash describes the final bytes; only owned temporary candidates are discarded. Non-converging custom naming fails explicitly. This does not add another CSS file or a runtime URL resolver.

The ports keep infrastructure replaceable:

- parser implementation can change without changing domain IR;
- browserslist lowering stays outside authored declaration resolution;
- Vite/Rollup URL emission stays outside the Compiler domain;
- readable first-version names can later be replaced by short/hash names.

## Diagnostics

The shipped bounded contract is recorded in [ADR-0051](adr/0051-expose-bounded-original-css-diagnostic-ranges.md).

```ts
export type GssSourceRange = { start: number; end: number };

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
    | "render";
  message: string;
  id: string;
  range?: GssSourceRange;
  reason?: string;
  suggestion?: string;
};
```

Expected user errors return diagnostics. Exceptions are reserved for violated Compiler invariants.

`range` uses zero-based UTF-16 offsets into the **original caller CSS**, with an exclusive end; CRLF/astral characters take two units and BOM markers count. It is optional: absent means no reliable attribution, not offset zero. CSS syntax `GSS1001` uses validated parser Input coordinates, never upstream source-map coordinates. Without a supplied end it reports a zero-width point (including a genuinely reported EOF). Authored selector syntax `GSS1001` and unsupported-selector `GSS1101` use the complete enclosing authored rule span, including braces; list branches share it and nested branches point to their original nested rule. Duplicate-declaration `GSS1204` identifies the actual repeated declaration, including a semicolon if authored. These are not exact selector-token or generated-CSS mappings.

Other diagnostic sites (including configuration/bindings, resources/registry and multi-origin resolution), unknown origins and inline-map decode/schema/lazy-lookup failures without Input coordinates omit the field. Asset discovery exposes these parser ranges but does not perform declaration validation. Existing consumers and independent reference diagnostics can still supply diagnostics without ranges.

Diagnostic `id` remains caller-supplied (including physical ids); codes and current emission order are unchanged. Expected PostCSS/selector syntax errors retain a generic path-clean message and existing `GSS1001`/`parse`. There is no public `path` field, range/code/path sorting, CSS source-map emission or IDE/Vite overlay consumption in this slice. Failed replacement still retains generation, ScopeSchema and finalized last-known-good contribution. CSS/manifest semantic identity remains independent of physical checkout location and source positions.

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

Implemented as a bounded first slice in the separate `@gss-l/testing` package ([ADR-0030](adr/0030-make-semantic-reference-css-a-testing-capability.md)); production packages do not depend on it:

```ts
export type CompileGssReferenceInput = {
  config: GssCompilerConfig;
  modules: readonly ReplaceStylesheetInput[];
};
export type ReferenceCompilerPorts = {
  resolveAssetUrl?: (identity: string) => string;
};
export type ReferenceCompileResult =
  | { success: true; css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>>; diagnostics: readonly GssDiagnostic[] }
  | { success: false; diagnostics: readonly GssDiagnostic[] };

export function compileGssReference(
  input: CompileGssReferenceInput,
  ports?: ReferenceCompilerPorts,
): ReferenceCompileResult;
```

This synchronous, stateless API has no IO, framework or browser dependencies. Mappings are keyed by input Module id, and each schema retains that id. Reference class names encode project-relative Module identity and authored local class independently; the same local class is reused across its declared paths so the browser—not target winner resolution—performs accumulation. Input Modules are isolated and sorted by logical identity; authored selector structure, rule order, declaration grouping/order and importance are preserved. Failure returns no partial output, including when an earlier Module was valid.

Current coverage: plain ASCII local classes (`[A-Za-z_][A-Za-z0-9_-]*`), whitespace descendant paths, `color`, `background-color`, `display`, `width`, `height`, and physical `margin`/`padding` shorthands/four longhands. Functions and escapes in values are rejected; values otherwise remain opaque. Equal-importance exact-property duplicate declarations fail. Lists, nesting, states, runtime relations, conditions/layers/resources and other properties fail explicitly. Nonempty registered condition/layer configuration and asset bindings also fail rather than silently using a different cascade. Empty registrations and either atomic fallback policy are accepted. The optional asset resolver is reserved and never called by this slice.

The reference uses PostCSS but no atomic compiler implementation, winner/pruning logic, atom identity, `RulePlanner`, `RuleOrderPlanner`, or `NameAllocator`. The public production API is used only on the atomic side of the browser harness.

The bounded harness renders the same DOM with substituted mappings in isolated documents and compares touched properties/physical longhands for ownership, descendant accumulation and shorthand order/importance, with literal expectations and a corrupted-atomic negative control. See [`packages/testing/README.md`](../packages/testing/README.md) for startup and machine-readable acceptance. The broader state/condition/resource corpus, browser CI and Pilot remain incomplete.

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
