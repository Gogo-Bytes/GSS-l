# GSS-l architecture

> Product semantics are defined in [`language-design.md`](language-design.md). Public seams are defined in [`compiler-interface.md`](compiler-interface.md).

## Positioning

GSS-l is a build-time CSS compiler with a React-first consumer Adapter. Authors write constrained, CSS-native `.gss`; the Compiler resolves safe cascade semantics and emits one central stylesheet plus static style-scope Modules.

The architecture has two hard boundaries:

1. CSS semantics belong to a framework-agnostic Compiler domain.
2. React/JSX syntax and build-tool lifecycle belong to Adapters.

Production has no GSS runtime conflict resolver, Proxy, or dynamic rule registry.

## System context

```text
                         ┌─────────────────────┐
.gss source ────────────▶│ Compiler session    │────▶ central CSS asset
                         │                     │────▶ module JS + .d.ts
React/TSX source ───────▶│ scope schema ports  │────▶ manifest + report
                         └─────────────────────┘────▶ diagnostics
                                  ▲
                                  │
                         React and Vite Adapters
```

The Compiler owns style meaning. Adapters own source discovery, AST integration, file/URL resolution, HMR transport, SSR asset linkage, and host diagnostics presentation.

## Architectural layers

### Domain

The Domain contains framework-independent language concepts and rules:

```text
SelectorPath
ScopeTree
Declaration
PropertyEffect
ConditionContext
CascadeLayer
RelationConstraint
Specificity
SemanticIdentity
PlannedRule
GlobalResource
Diagnostic
```

Domain services:

```text
SelectorConstraintAnalyzer
CascadeResolver
PropertyEffectRegistry
RulePlanner
RuleOrderPlanner
NameAllocator
ResourceRegistry
```

The Domain does not read files, parse JSX, emit Vite assets, mutate the DOM, or depend on a process-global singleton.

### Application

Application use cases coordinate domain services and transactional state:

```text
replaceStylesheet
invalidateModule
getScopeSchema
finalizeSnapshot
```

The main aggregate is a compiler session containing committed Module contributions and their shared rule/resource references.

A replacement follows:

```text
prepare complete contribution
→ validate invariants
→ commit atomically
```

An error leaves the previous contribution unchanged.

### Ports

The target architecture routes infrastructure dependencies through explicit ports:

```text
CssParserPort
CompatibilityTransformerPort
AssetResolverPort
NameAllocatorPort
```

Ports use domain/application data rather than exposing Babel, Vite, filesystem, or third-party parser objects across the boundary.

The first internal parser seam is implemented: [`CssParserPort`](../packages/compiler/src/application/css-parser-port.ts) returns project-owned [`Parsed*` IR](../packages/compiler/src/domain/parsed-stylesheet.ts) and existing diagnostic values. The session requires this port; [`compiler.ts`](../packages/compiler/src/compiler.ts) composes the default PostCSS Adapter outside the use case, also for Asset discovery. The exported constructor remains `createGssCompilerSession(config)`, with no public port argument. Compatibility/allocator port wiring and the broader value model remain targets.

### Adapters

The first Adapters are:

- React/TypeScript source transform;
- Vite module and asset integration;
- browser testing/oracle integration.

Future Vue, Svelte, or other build integrations reuse the same Compiler session and scope schema.

## Stylesheet compilation flow

```text
.gss source
→ parse
→ normalize standard CSS nesting and selector lists
→ validate positive capabilities
→ build selector paths and ScopeTree
→ build declaration candidates
→ resolve cascade and property effects
→ plan pure/contextual rules and resources
→ allocate readable names
→ prepare Module contribution
→ transactional registry commit
```

### Parse and normalize

The parser preserves original source spans and produces project-owned syntax/IR. Standard nesting and selector lists are normalized before semantic analysis.

#### Internal source provenance (bounded implementation)

`SourceSpan` has `sourceId` (the unchanged parser input id), `start` and `end`. Coordinates are zero-based JavaScript UTF-16 code-unit offsets with an exclusive end: `source.slice(start, end)` selects the original text. CRLF occupies two units; an astral Unicode character occupies two. PostCSS removes a leading U+FEFF/U+FFFE internally; the Adapter translates node offsets back by one unit when `Input.hasBOM` is true, without changing the caller source. The internal span has no line/column fields. A subsequent bounded [public diagnostic range slice](#diagnostics) projects these coordinates without exposing `sourceId` as a new public field.

- Declarations carry their exact authored node spans (property through value/importance, including a semicolon if present, excluding surrounding whitespace). Comments inside that span remain part of the original text, even when PostCSS normalizes the semantic value.
- Rules, resources and keyframe frames carry complete authored node spans, including braces. Each selector-list branch shares the **enclosing authored rule** span; this is not an exact selector-token span.
- Nesting expansion and parent-rule splitting retain the original PostCSS `Source` object. The Adapter snapshots authored spans before normalization, then retrieves them for clones. A normalized nested rule points to the original nested rule, not a concatenated parent selector. Missing/synthetic origins throw an invariant error, rather than inventing a range in regenerated CSS.
- Conditions/layers, individual selector components, inherited parent-selector fragments and emitted CSS do not yet have exact mappings. The IR does not retain parser ASTs, host objects or full source text. Provenance is not a semantic identity, name or order input; keyframe frame identities explicitly project semantic fields to exclude it.

[`PostCSS Adapter tests`](../packages/compiler/test/postcss-stylesheet-parser.test.ts) pin these granularity limits; [`port tests`](../packages/compiler/test/css-parser-port.test.ts) exercise replace/finalize with an injected parser. This is source attribution groundwork, not CSS source-map emission or the full S2 value model.

Normalization never makes an unsupported selector supported. Every resulting branch passes the same positive capability validation.

### Selector and scope analysis

Class paths produce a `ScopeTree`. Plain descendant paths express caller-owned target paths. Child, sibling, ancestor-state, and observed `:has()` relations produce structured runtime constraints.

The analyzer works on selector AST and constraint objects, not selector-string heuristics.

### Cascade resolution

`CascadeResolver` decides winner or ambiguity using:

```text
importance and authored layer
→ specificity
→ registered condition order
→ relation implication
→ property effects
```

Authored order is used only inside a closed candidate set known to match the same target. Module registration order and emitted class-name order never decide a winner.

### Planning

`RulePlanner` maps resolved declarations to:

```text
PureAtomicRule
ContextualAtomicRule
PreservedModuleBlock
GlobalResource
```

Each atomic CSS rule represents one semantic declaration. A compatibility transformer may expand that declaration into an indivisible physical fallback sequence.

Compilation has two proof gates. An atomic proof failure caused by an otherwise valid unknown property effect or indivisible compatibility sequence replans the complete Module as preserved scoped CSS. A preserved Module keeps authored rule/declaration order and never mixes its rules with per-declaration atoms. Failure to parse, scope, or preserve semantics still fails closed.

### Registry and finalization

The registry deduplicates complete atomic/resource semantic identities and reference-counts every Module contribution. A preserved block remains Module-owned and indivisible rather than participating in cross-Module atom reuse.

`RuleOrderPlanner` receives only rules already proven safe and creates deterministic physical order. Canonical identity breaks harmless ties but never chooses semantic winners.

Finalization produces one ordered stylesheet for every reachable main and lazy Module.

## React source flow

```text
React/TSX source
→ framework Adapter discovers .gss imports (no file reads)
→ host resolves and compiles dependencies asynchronously
→ synchronous transform resolves ScopeSchema
→ track supported local immutable aliases
→ lower GSS references inside JSX className to `.self`
→ diagnose unknown paths and unsupported escape
→ emit transformed source + source map
```

The shared `GssSourceAdapter` application port is exported by `@gss-l/compiler`. `@gss-l/react` implements it through `react()`; `@gss-l/vite` explicitly receives it through `gss({ adapter })`. Vite owns physical/virtual ids, file reads, diagnostics presentation and the session, not React lowering. A current compilation error blocks transformation rather than falling back to an old ScopeSchema.

The React Adapter may inspect syntax and binding provenance, but it does not:

- infer rendered DOM structure;
- evaluate business conditions;
- interpret `cx()` semantics;
- resolve CSS property conflicts;
- inspect external class strings.

Outside JSX `className`, callers use `.self` when they need a concrete class string.

## Compiler session ownership

A Vite build/dev server creates one session. The session is not shared across unrelated builds or process-global state.

```text
replaceStylesheet(id, source)
invalidate(id)
getScopeSchema(id)
finalize()
```

Output Module identities are stable project-relative logical ids, including root-external paths such as `../shared/Card.gss`. Canonical physical ids remain session transaction/ScopeSchema lookup keys; the host owns filesystem canonicalization. Absolute cwd, timestamps, random values, worker order, and hash-map iteration order never enter output identity.

## Production architecture

Production performs a complete reachable-Module census and emits:

```text
one central GSS CSS asset
static virtual JavaScript Modules
TypeScript declarations
build manifest
report
source maps
```

The implemented Vite build emits an asset named `gss.css` through Rollup naming rules, plus `gss-manifest.json` and `gss-report.json`. The JSON envelopes contain `version: 1`, output-relative `cssAsset`, and the corresponding Compiler snapshot data. All emitted HTML entries share the CSS asset; deployment base is applied only when creating their links. An empty GSS census emits no GSS asset or metadata.

SSR integrations can read `gss-manifest.json` and link the same CSS asset used by client hydration; no generic SSR response helper is provided. The browser does not create or reorder GSS rules at runtime.

The first version includes lazy-route CSS in the central asset so network completion cannot alter the cascade. The final Rollup Module census, not precompiled scope lookups or emitted chunk contents, determines production contributions. Source snapshots retained with virtual Modules keep final CSS aligned with generated JS. Watch builds replay the current census into clean registry state and refresh preserved snapshots even when generated JS is byte-identical.

## Development and HMR

The dev Adapter injects one `<link rel="stylesheet" data-gss-dev>` per Vite-managed HTML document, pointing to the base-aware `/@gss-l/central.css` virtual CSS endpoint. Vite serves direct CSS and owns native stylesheet-link replacement; GSS adds no custom browser runtime or per-Module CSS imports.

```text
source update
→ newest physical-file read wins
→ transactional replace by Module id
→ finalize complete generation
→ invalidate virtual CSS cache
→ native Vite CSS HMR replaces the stylesheet link
```

It never appends newly discovered atoms to the current stylesheet tail. Later source discovery invalidates an earlier empty snapshot. A newly connected HMR client receives a snapshot refresh so discovery before socket connection cannot leave stale CSS. Each MPA document uses the same URL without duplicate links; this development flow relies on Vite HMR being enabled.

On compile failure:

```text
rollback transaction
→ retain last-known-good stylesheet
→ present diagnostic
```

Module invalidation removes its references; zero-reference atoms, markers, and resources disappear from the next snapshot. Per-physical-file generation tokens prevent stale async reads from committing after a newer replacement or deletion. Physical change events also invalidate virtual JS and recorded source importers, ensuring fresh ScopeSchema validation. Virtual loads respect Vite's filesystem access policy.

## Naming architecture

Semantic identity and emitted names are separate.

The first `NameAllocator` emits reversible, readable names from complete canonical identity. It is replaceable after real corpus measurements without changing resolver, registry, scope schema, or authored API.

Local markers/resources include stable project-relative identity where isolation requires it. Absolute paths do not appear.

## Resource architecture

Resources are managed separately from class rules:

```text
module-local keyframes
font-face
property registration
layer-order statement
asset dependencies
```

Keyframes are renamed and local static references are rewritten. Font family names remain global. URL resolution and asset emission stay behind Adapter ports.

## Diagnostics

Expected source problems are values, not exceptions. The target diagnostic model includes phase, code, Module id, source range, semantic path, reason, and optional suggestion. The shipped [`GssDiagnostic`](../packages/compiler/src/public-types.ts) now has optional `range?: GssSourceRange` ([ADR-0051](adr/0051-expose-bounded-original-css-diagnostic-ranges.md)), but no path field; its `id` remains the caller's id (possibly physical).

Public ranges are zero-based UTF-16, half-open in original caller CSS (including BOM/CRLF/astral units). `GSS1001` CSS syntax translates only validated `error.input` line/column coordinates whose input text matches caller CSS after one BOM removal, never remapped upstream fields. Supplied ends must be valid/exclusive; missing ends are zero-width parser-reported points, including EOF if actually reported. Invalid/partial/reversed/out-of-bounds/split-surrogate coordinates omit the range. Selector syntax reached in prevalidation and `GSS1101` unsupported selectors reuse the complete enclosing authored rule span; nested/list branches do not promise exact selector-token locations. Map-helper errors without Input provenance remain unranged even inside selector prevalidation. `GSS1204` uses the actual repeated declaration span. Other capability/config/binding/resource/registry/multi-origin sites remain unranged. Existing emission order and transaction semantics are unchanged. See [public tracers](../packages/compiler/test/diagnostic-ranges.test.ts). This does not implement CSS maps, source-to-output tracing, IDE/overlay consumption or matrix-wide S2 attribution.

The PostCSS Adapter validates authored selector syntax before nesting and passes Rule objects to selector-parser so expected syntax errors use `CssSyntaxError`. Those errors return existing `GSS1001`/`parse` diagnostics with a path-clean generic message. Authored inline source-map decoding/schema and lazy mapping-lookup failures use the same diagnostic channel. An Adapter-only preflight reuses PostCSS's explicitly exported `postcss/lib/previous-map` infrastructure seam. Discovery uses `map.prev: false` to select the same last annotation without decoding or external-file IO; the consumer runs only for nonempty decoded text, matching PostCSS Input. Consumer construction does not validate lazy mappings. For nonempty inline maps only, the Adapter constructs the normal public `Input`, guards that instance's consumer `originalPositionFor` data lookup, then invokes the exported `postcss/lib/parser` ([private minimal declaration](../packages/compiler/src/infrastructure/postcss-parser.d.ts)). Normal `postcss.parse` constructs Input internally and offers no instance-local hook before syntax-error lookup, so absent/external/empty maps retain that normal route. Only inline decode/consumer/lookup data operations are enclosed by conversion, never parsing, normalization or all of `Input.error`. There is no global/prototype mutation or eager mappings traversal: valid CSS with lazy malformed `?`/`AA` mappings still succeeds as in baseline 6864013. XSSI, charset/base64, empty payloads and last-annotation precedence remain unchanged. No decoder/schema is copied or dependency added, external-map IO behavior is untouched, and upstream `sourcesContent` never replaces caller-CSS span coordinates. Unsupported capabilities still use `GSS1101`/`validate`. The session does not catch arbitrary exceptions from custom parsers, and programmer/invariant errors propagate. Mixed valid/invalid lists cannot commit partial contributions; previous CSS/ScopeSchema/generation remain active. This does not claim matrix-wide diagnostic sorting or attribution.

Compiler invariant failures throw only when internal guarantees are broken, for example:

- one emitted name maps to different identities;
- a winner depends on registry order;
- an uncommitted contribution appears in finalization;
- a target token references no planned rule;
- stale HMR generation replaces a newer snapshot.

## Verification architecture

Testing uses two independent output paths:

```text
atomic compiler
reference renderer
```

They currently parse independently with separate PostCSS-based implementations: the reference does not import production parser/IR, winner pruning or atomic planning. Shared parsing is permitted by the target design but is not introduced by the internal parser seam. Browser fixtures render both mappings in isolated documents and compare touched computed properties under the same states and conditions.

Fast domain/snapshot tests and browser oracle tests run separately. Real-project Pilot acceptance requires zero unexplained computed-style differences.

## Documentation ownership

- Accepted decisions and rationale: [`adr/`](adr/)
- Positive first-version support: [`mvp-capabilities.md`](mvp-capabilities.md)
- Explicit deferred work and non-goals: [`deferred-capabilities.md`](deferred-capabilities.md)
- Implementation stages and gates: [`mvp-roadmap.md`](mvp-roadmap.md)

New implementation work must fit an accepted capability. A newly discovered semantic gap is documented and decided before the Compiler silently expands its language.
