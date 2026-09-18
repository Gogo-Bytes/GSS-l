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

The React Adapter lowers known GSS references but does not inspect external class semantics.

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

Potential logical/physical overlap and unknown property effects fail closed because their winner can depend on runtime writing mode or unmodelled shorthand semantics.

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

Production performs a complete reachable-Module census and emits one central ordered asset. Lazy-route CSS is included so network order cannot change the cascade.

Development uses one style owner and replaces the complete ordered snapshot after a successful transaction. Failed compilation retains the last-known-good snapshot; invalidation removes zero-reference output.

The first version uses reversible readable names generated from canonical identity. Naming is isolated behind `NameAllocator` and does not affect semantics.

## 15. Fail-closed policy

A successful build means every input is inside a documented capability or warning exception.

The Compiler does not silently convert unknown or dangerous input into a generic preserved/scoped block. Contextual atoms and residual/global selectors are explicit language features, not fallback guesses.

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

## 18. Implementation status

The semantic design stage is complete. The recipe-oriented exploratory implementation has been discarded without modifying the read-only legacy project.

Stage 1 of [`mvp-roadmap.md`](mvp-roadmap.md) established the new Compiler workspace and verification commands. Implementation now proceeds in test-first vertical slices through the accepted `GssCompilerSession` seam.
