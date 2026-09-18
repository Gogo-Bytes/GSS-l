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

Infrastructure dependencies enter through explicit ports:

```text
CssParserPort
CompatibilityTransformerPort
AssetResolverPort
NameAllocatorPort
```

Ports use domain/application data rather than exposing Babel, Vite, filesystem, or third-party parser objects across the boundary.

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

The parser preserves source ranges and produces project-owned syntax/IR. Standard nesting and selector lists are normalized before semantic analysis.

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
GlobalResource
```

Each CSS rule represents one semantic declaration. A compatibility transformer may expand that declaration into an indivisible physical fallback sequence.

The first version does not silently choose a preserved/scoped fallback when proof fails; validation fails closed.

### Registry and finalization

The registry deduplicates complete semantic identities and reference-counts Module contributions. It stores meaning, not first-seen CSS text.

`RuleOrderPlanner` receives only rules already proven safe and creates deterministic physical order. Canonical identity breaks harmless ties but never chooses semantic winners.

Finalization produces one ordered stylesheet for every reachable main and lazy Module.

## React source flow

```text
React/TSX source
→ locate .gss imports
→ resolve ScopeSchema
→ track supported local immutable aliases
→ lower GSS references inside JSX className to `.self`
→ diagnose unknown paths and unsupported escape
→ emit transformed source + source map
```

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

Module ids are stable project-relative logical ids. Absolute cwd, timestamps, random values, worker order, and hash-map iteration order never enter output identity.

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

SSR reads the build manifest and links the same CSS asset used by client hydration. The browser does not create or reorder GSS rules at runtime.

The first version includes lazy-route CSS in the central asset so network completion cannot alter the cascade.

## Development and HMR

The dev Adapter owns one `<style data-gss-dev>` element.

```text
source update
→ transactional replace by Module id
→ finalize complete generation
→ replace style text
```

It never appends newly discovered atoms to the current stylesheet tail.

On compile failure:

```text
rollback transaction
→ retain last-known-good stylesheet
→ present diagnostic
```

Module invalidation removes its references; zero-reference atoms, markers, and resources disappear from the next snapshot. Generation numbers prevent stale async work from replacing newer output.

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

Expected source problems are values, not exceptions. Each diagnostic carries phase, code, Module id, source range, semantic path, reason, and optional suggestion.

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

They share parsing/source infrastructure but not winner pruning or atomic planning. Browser fixtures render both mappings in isolated documents and compare touched computed properties under the same states and conditions.

Fast domain/snapshot tests and browser oracle tests run separately. Real-project Pilot acceptance requires zero unexplained computed-style differences.

## Documentation ownership

- Accepted decisions and rationale: [`adr/`](adr/)
- Positive first-version support: [`mvp-capabilities.md`](mvp-capabilities.md)
- Explicit deferred work and non-goals: [`deferred-capabilities.md`](deferred-capabilities.md)
- Implementation stages and gates: [`mvp-roadmap.md`](mvp-roadmap.md)

New implementation work must fit an accepted capability. A newly discovered semantic gap is documented and decided before the Compiler silently expands its language.
