# GSS-l semantic safety evaluation

> Status: first-version product semantics accepted. This document summarizes the resulting safety model; individual rationale and consequences are authoritative in [`docs/adr/`](adr/).

## 1. Evaluation question

GSS-l asks whether CSS-native authored styles can be converted into reusable atomic rules without making the final browser result depend on incidental registration, build, network, or injection order.

The answer is conditional:

> GSS-l can guarantee semantics inside a declared style scope when the Compiler has enough structure to resolve winners or preserve runtime relations. It cannot guarantee arbitrary class composition, external stylesheets, or unsupported CSS by guessing.

The language therefore combines:

```text
positive capability set
+ explicit ownership contract
+ structured browser relations
+ compile-time cascade resolution
+ fail-closed diagnostics
```

It does not first atomize everything and then attempt to repair the cascade.

## 2. Guarantee boundary

GSS-l guarantees:

- `.gss` declarations and selectors in the positive capability matrix;
- each generated scope/target reference used according to its declared ownership;
- pure and contextual rules generated from one Compiler session/configuration;
- registered condition and cascade-layer order;
- central production CSS and snapshot HMR output;
- resources emitted through the same registry.

GSS-l does not resolve:

- arbitrary `cx()` composition of independent exports;
- external `className` content;
- external/global stylesheet conflicts;
- target references deliberately attached outside their ownership scope;
- unregistered condition/layer precedence;
- syntax outside the positive capability matrix.

The React Adapter lowers known GSS references but does not inspect external class semantics. A framework-independent source Adapter first discovers original GSS import specifiers. The host resolves and successfully compiles them before calling the synchronous transform, so dependency load order cannot silently bypass ScopeSchema validation. A failed current input blocks transformation even when the Compiler retains a last-known-good contribution.

## 3. Authored and consumer model

Authors write CSS-like Modules:

```gss
.father {
  display: flex;
}

.father .son {
  color: red;
}
```

Consumers use path references:

```tsx
<div className={styles.father}>
  <span className={styles.father.son} />
</div>
```

Every path is internally a static object containing `self` and child targets. JSX `className` implicitly lowers a scope reference to `.self`; other string contexts use `.self` explicitly.

A branch can be selected once with a local immutable alias:

```tsx
const branch = active ? styles.father : styles.mother;

<div className={branch}>
  <span className={branch.son} />
</div>
```

Scope objects do not use Proxy, coercion, or production runtime merge.

## 4. Pure atom safety

An independent declaration is safe to reuse when its complete semantic context is part of identity:

```text
layer
condition
selector state
pseudo-element
property
value
important
```

For example:

```gss
.badge {
  display: inline-flex;
  color: red;
}
```

can become independent display and color atoms.

Two values for the same target/property are not both returned and left for class ordering to resolve. The Compiler first computes the winner or reports ambiguity.

## 5. Target path safety

A declared descendant path is an ownership contract:

```gss
.father .son {
  color: red;
}
```

Its declaration can be pushed to `styles.father.son` as a pure atom. The Compiler does not infer JSX DOM and does not protect deliberate misuse of that target in another subtree.

A deeper declared target accumulates all more-general selectors that necessarily match:

```gss
.icon { display: inline-block; color: green; }
.father .icon { color: red; }
.father .son .icon { color: blue; }
```

`styles.father.son.icon` resolves to:

```text
display: inline-block
color: blue
```

Only declared selector paths become references; the Compiler does not synthesize arbitrary path combinations from JSX.

## 6. Runtime relation safety

Relations whose truth depends on the live DOM or browser state retain contextual selectors:

```gss
.father > .son {}
.input + .label {}
.input ~ .label {}
.father:hover .son {}
.card:has(.error) {}
```

Generated selectors require the corresponding source/subject and target/observed markers. A target token alone cannot activate the relation.

When one condition provably implies another, the narrower condition wins:

```text
descendant < direct child
general sibling < adjacent sibling
base relation < relation + state
```

Coexisting incomparable conditions that assign different values to one target/property are rejected unless the author supplies an intersection, exclusion, importance, or other explicit precedence.

## 7. Selector model

The first-version positive selector set is maintained in [`mvp-capabilities.md`](mvp-capabilities.md).

Key safety decisions:

- `styles.a.b` always means descendant path `.a .b`;
- same-node local class compounds are not part of the first-version model;
- business variants use attributes, ARIA, or pseudo states;
- external class contracts use explicit `:global(...)`;
- selector lists normalize into independent branches and fail as a whole if one branch is invalid;
- `:not()`, `:is()`, and `:where()` preserve negative, OR, and zero-specificity semantics;
- `:has()` remains a browser-evaluated observed relation;
- supported pseudo-elements remain part of selector identity;
- standard CSS nesting expands before semantic analysis.

Residual tag/attribute/global selectors remain contextual instead of being falsely converted into target-only atoms.

## 8. Cascade model

Winner resolution and physical CSS ordering are separate operations.

Within the GSS author origin, resolution follows native-style cascade precedence:

```text
importance and authored cascade layer
→ selector specificity
→ semantic source-order dimensions
```

Semantic source-order dimensions are:

```text
registered at-rule condition rank
→ relation implication rank
→ property-effect rank
```

Normal and important layer ordering follows CSS, including important-layer reversal. `:where()` contributes zero specificity.

Canonical identity and emitted class names stabilize output only. They never choose a winner.

Authored order is retained only inside a closed candidate set known to match the same target. Global Module registration or worker completion order never acts as source order.

## 9. At-rule conditions

The first version supports registered `@media`, `@supports`, and `@container` condition contexts.

Projects configure one order for full canonical contexts, including explicitly registered compounds. Weights are not arithmetically combined.

Unregistered condition contexts are emitted with a warning. Their relative precedence is outside the semantic guarantee.

Named cascade layers use a separate project-level order and are part of rule identity.

## 10. Shorthand and longhand safety

A versioned, data-driven property-effect registry describes which effect slots each property writes.

For:

```gss
.box {
  margin: 8px;
  margin-left: 16px;
}
```

both declarations survive, and global property ordering guarantees shorthand before longhand.

For:

```gss
.box {
  margin-left: 16px;
  margin: 8px;
}
```

the earlier longhand is a known loser and does not enter the export.

Values remain opaque. In particular, `var(...)` is not assumed to substitute one component.

Potential logical/physical overlap still fails closed because its winner can depend on runtime writing mode. An otherwise valid Module with unknown property effects cannot emit atoms; it may instead pass the independent preserved-scoping proof and retain browser-evaluated authored order as one whole preserved Module.

## 11. Duplicate property and compatibility sequences

Authored duplicate exact-property sequences are rejected rather than split into value-ordered atoms.

Authors write standard values; the compatibility transformer may expand one semantic declaration into an indivisible physical fallback sequence based on browser targets.

Feature fallback uses `@supports`, which has an explicit condition identity and ordering contract.

## 12. Custom properties

A custom property provider is an atom on its authored target:

```gss
.card {
  --card-color: red;
}
```

Consumers rely on native inheritance and substitution. Providers are not copied to every consumer, values remain opaque, and names remain authored so inline style, themes, and `style.setProperty()` work.

`@property` is a global registration resource: identical definitions deduplicate; conflicting definitions fail.

## 13. Global resources

Module-local `@keyframes` is renamed deterministically and static animation references are rewritten. Frame declarations remain inside an indivisible resource.

`@font-face` remains a global family resource. Descriptor order and `src` fallback order are preserved; asset URLs enter the dependency graph.

Resources are reference-counted and removed when no committed Module references them.

## 14. Deterministic registry and output

Registration collects semantic contributions; it does not append final CSS.

Production performs a complete reachable-Module census and emits one central ordered asset. Lazy-route CSS is included so network order cannot change the cascade. Versioned `gss-manifest.json` and `gss-report.json` link the same asset using an output-relative filename; every emitted HTML entry resolves it against its deployment base. Physical source snapshots retained with virtual Modules align CSS with generated JS, while clean final registry state prevents removed or merely precompiled Modules from leaking into the output. Cached preserved Modules are refreshed even when their JavaScript is unchanged.

Development uses one stylesheet link per Vite-managed HTML document and replaces the complete ordered snapshot through Vite's native CSS HMR after a successful transaction. Failed compilation retains the last-known-good snapshot; invalidation removes zero-reference output. Per-file generation tokens suppress stale reads after replacement/deletion, and recorded source importers are invalidated for fresh ScopeSchema validation. Late discovery and late HMR connections refresh earlier snapshots rather than depending on network order.

The first version uses reversible readable names generated from canonical identity. Naming is isolated behind `NameAllocator` and does not affect semantics. Root-external stylesheets use project-relative logical ids such as `../shared/Card.gss`; canonical physical ids remain transaction/lookup keys. Moving the workspace without changing its relative layout cannot change Module-owned names. If no project-relative identity can be expressed, compilation fails closed rather than encoding an absolute path.

## 15. Fail-closed policy

A successful build means every input either passed atomic proof or passed the documented whole-Module preserved proof. Preserved output is visible through a diagnostic, artifact mode, manifest entry, report coverage, and optional strict-policy failure.

The Compiler never converts parse, selector ownership/scoping, global ordering, or resource-conflict errors into generic preserved output. Contextual atoms, residual/global selectors, and constrained preserved Modules are explicit language features, not fallback guesses.

Explicitly discussed future capabilities and non-goals are tracked in [`deferred-capabilities.md`](deferred-capabilities.md).

## 16. Verification model

The testing package provides an independent reference renderer:

```text
supported .gss
├── reference CSS + reference mapping
└── atomic CSS + atomic mapping
```

Both mappings render the same fixture in isolated browser documents. The oracle compares touched properties and relevant effect longhands under:

- base state;
- pseudo and attribute states;
- child/sibling/observed relations;
- pseudo-elements;
- media/supports/container conditions;
- layers and importance;
- custom property inheritance;
- stable resource metadata.

The reference renderer does not call the atomic winner/pruning/planning path. A real-project Pilot must reach zero unexplained computed-style differences.

## 17. Accepted decision index

- Descendant ownership: [ADR-0001](adr/0001-descendant-selectors-as-style-scope-targets.md)
- Ambiguous state conflicts: [ADR-0002](adr/0002-reject-ambiguous-coactive-state-conflicts.md)
- At-rule condition order: [ADR-0003](adr/0003-global-order-for-registered-at-rule-conditions.md), [ADR-0023](adr/0023-support-container-queries-in-condition-order.md)
- Consumer composition boundary: [ADR-0004](adr/0004-do-not-analyze-consumer-class-composition.md)
- Property effects and duplicate declarations: [ADR-0005](adr/0005-order-atoms-by-global-property-effects.md), [ADR-0006](adr/0006-reject-authored-duplicate-properties.md), [ADR-0018](adr/0018-use-a-data-driven-property-effect-registry.md)
- Custom properties: [ADR-0007](adr/0007-atomize-custom-property-providers.md)
- React scope interface: [ADR-0008](adr/0008-lower-style-scope-references-in-class-value-contexts.md), [ADR-0017](adr/0017-use-self-as-the-explicit-class-string-escape.md)
- React-first architecture: [ADR-0009](adr/0009-react-first-framework-agnostic-core.md)
- Target paths: [ADR-0010](adr/0010-map-style-reference-paths-to-selector-class-paths.md), [ADR-0011](adr/0011-accumulate-rules-that-necessarily-match-a-target-path.md)
- Runtime relations and precedence: [ADR-0012](adr/0012-use-contextual-markers-only-for-runtime-relations.md), [ADR-0013](adr/0013-prefer-logically-narrower-runtime-relations.md)
- Compound and functional selectors: [ADR-0014](adr/0014-reject-local-compound-class-selectors.md), [ADR-0015](adr/0015-constrain-local-classes-in-functional-pseudos.md), [ADR-0016](adr/0016-support-has-as-an-observed-contextual-relation.md)
- Fail-closed and selector normalization: [ADR-0019](adr/0019-fail-closed-when-safety-cannot-be-proved.md), [ADR-0020](adr/0020-expand-supported-selector-lists-into-rule-branches.md), [ADR-0022](adr/0022-normalize-standard-css-nesting-before-semantic-analysis.md)
- Pseudo-elements: [ADR-0021](adr/0021-support-a-positive-pseudo-element-capability-set.md)
- Resources and layers: [ADR-0024](adr/0024-support-module-local-keyframes.md), [ADR-0025](adr/0025-support-font-face-as-a-global-resource.md), [ADR-0026](adr/0026-support-configured-named-cascade-layers.md)
- Cascade and delivery: [ADR-0027](adr/0027-separate-cascade-resolution-from-render-order.md), [ADR-0028](adr/0028-use-one-central-css-asset-and-snapshot-hmr.md)
- Naming and verification: [ADR-0029](adr/0029-use-reversible-readable-names-for-the-first-version.md), [ADR-0030](adr/0030-make-semantic-reference-css-a-testing-capability.md)
- Source Adapter discovery and synchronous transformation: [ADR-0046](adr/0046-discover-source-imports-before-synchronous-transform.md)
- Root-external Module identity: [ADR-0047](adr/0047-use-project-relative-identities-for-root-external-stylesheets.md)
- Production CSS and versioned build metadata: [ADR-0048](adr/0048-emit-versioned-production-css-manifest-and-report.md)

### Asset identity and delivery URLs

[ADR-0049](adr/0049-separate-asset-identity-from-delivery-urls.md) fixes the URL integration semantics: local references resolve from their owning `.gss`, and stable logical Asset identity is separate from deployment URLs. Equal authored URL strings from different directories must not cause incorrect atom or resource deduplication. The Vite Adapter owns file reads, watch, rebasing and independent asset emission; the Compiler remains filesystem- and framework-independent. Existing data/remote/fragment URLs pass through, root paths use `publicDir`, and query/fragment are retained. Missing local resources fail before Module contribution commit, retaining last-known-good dev CSS and failing production builds. Automatic inlining is not part of this first slice.

The Compiler/host protocol is now accepted and implemented in [ADR-0050](adr/0050-discover-bind-and-render-asset-references.md): discovery returns decoded URL strings and diagnostics; replacement accepts transactional logical identity bindings; finalization resolves deployment URLs without modifying committed state or names. Tests cover differing identities for equal authored URLs, alias deduplication, global font conflicts, preserved/keyframe output, missing resolver results, CSS escaping, and exact Unicode identities. Typed identity values are distinguished from arbitrary authored text before class accumulation. Vite production now resolves and reads local resources before contribution commit, retains bindings and bytes with cached Modules, and emits only final-census resources. Tests cover local/public URLs, lazy fonts, base/naming variants, canonical aliases, relocation stability, missing resources, inconsistent snapshots and watch deletion/recovery with unchanged scope JS. Browser preview confirmed that a relative-base build deployed under a subpath loads local/public images and a real font from nested HTML, then loads a lazy image without adding a stylesheet. Dev resource URL/HMR integration now uses the same preparation/binding seam, with Vite-served versioned byte snapshots rather than a second physical-URL resolution by Vite's CSS pipeline. This avoids automatic SVG inlining and encoded-filename failures. Requested/canonical paths are checked before reading, HTTP delivery rechecks file access, and native host/CORS checks remain in front of the middleware. No filesystem allowlist is expanded. Committed bytes and CSS survive missing-file failures; recreation, including identical bytes, recovers through native CSS updates. Shared ownership, font/public resources, symlink identity changes, explicit external-path allowance and stale source reads are covered by real dev-server tests. Standalone unbound Compiler calls still do not resolve local files.

## 18. Implementation status

The semantic design stage is complete. The recipe-oriented exploratory implementation has been discarded without modifying the read-only legacy project.

Stage 1 of [`mvp-roadmap.md`](mvp-roadmap.md) established the new Compiler workspace and verification commands. Implementation now proceeds in test-first vertical slices through the accepted `GssCompilerSession` seam. The Vite virtual-JavaScript, explicit source-Adapter composition, and dev central CSS/HTML/HMR slices are implemented with real Vite integration tests, including HTTP/WebSocket coverage. Browser smoke verification covered red → blue → invalid source (blue retained with overlay) → green recovery, with one stylesheet link, no appended style elements, and no page reload in a self-accepting fixture. Production central CSS and JSON delivery are now covered by real build/watch tests: lazy census, MPA/base handling, empty census, preserved fallback reporting, source-snapshot consistency, and relocation stability. Production preview browser checks confirmed lazy rules are present before lazy JS loads, lazy rendering adds no stylesheet, and both HTML entries share the same asset. Dev resource browser checks loaded a real font and exercised red → blue image bytes → deleted image (blue bytes and CSS retained with overlay) → green recovery, preserving the DOM node, one stylesheet link, zero appended style elements and one application boot. A separate identical-byte restoration check cleared the error overlay without reloading. The broader semantic-oracle/Pilot gates remain incomplete.
