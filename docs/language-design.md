# GSS-l language design

> Status: first-version product semantics accepted. The authoritative decisions live in [`docs/adr/`](adr/); the positive support set lives in [`mvp-capabilities.md`](mvp-capabilities.md).

## Goals

GSS-l keeps authored styles close to CSS Modules:

```gss
.father {
  display: flex;
}

.father .son {
  color: red;
}

.father:hover > .son {
  color: blue;
}
```

It is not a recipe/object CSS-in-JS DSL. The compiler uses the additional `.gss` contract to resolve cascade winners, emit reusable declaration atoms where safe, and retain browser-evaluated relations as contextual atoms.

The first React integration has no production GSS runtime. A build-time Adapter lowers references imported from `.gss` files.

## Public React interface

A class path in the stylesheet becomes a style-scope path:

```text
.icon                    → styles.icon
.father .son             → styles.father.son
.father .son .icon       → styles.father.son.icon
```

Every generated path is internally a static scope object:

```ts
{
  self: string;
  ...targets;
}
```

Inside JSX `className`, the React Adapter implicitly selects `self`:

```tsx
<div className={styles.father}>
  <span className={styles.father.son} />
</div>
```

Outside JSX `className`, callers request the concrete string explicitly:

```ts
const className = styles.father.self;
```

A local immutable branch can be selected once:

```tsx
const branch = active ? styles.father : styles.mother;

<div className={branch}>
  <span className={branch.son} />
</div>
```

The Adapter propagates direct, conditional, and property aliases within the local file. Arbitrary scope-object escape is rejected with a diagnostic that recommends `.self` when a string is intended.

## Target paths and accumulation

A reference path is generated only for a selector path declared in the `.gss` Module. The compiler does not invent paths from JSX structure.

For an explicitly declared deeper path, the compiler accumulates all more-general selectors that necessarily match:

```gss
.icon {
  display: inline-block;
  color: green;
}

.father .icon {
  color: red;
}

.father .son .icon {
  color: blue;
  font-size: 16px;
}
```

`styles.father.son.icon` resolves to the final target style:

```text
display: inline-block
color: blue
font-size: 16px
```

Losing declarations do not enter the target token.

## Pure atoms and contextual atoms

### Ownership descendant

A plain descendant path is an ownership contract:

```gss
.father .son {
  color: red;
}
```

The declaration can become a pure atom on `styles.father.son`. If the caller attaches that target to an unrelated subtree, the resulting style is caller misuse and is outside GSS-l guarantees.

### Runtime relations

Relations that depend on actual DOM structure or browser state retain source and target markers:

```gss
.father > .son {}
.input + .label {}
.input ~ .label {}
.father:hover .son {}
```

They generate contextual selectors conceptually equivalent to:

```css
.fatherMarker > .fatherSonTarget {}
.inputMarker + .inputLabelTarget {}
.inputMarker ~ .inputLabelTarget {}
.fatherMarker:hover .fatherSonTarget {}
```

Both references and the real browser relation must be present for the declaration to apply.

When one runtime condition provably implies another, the narrower condition wins—for example child over descendant and adjacent sibling over general sibling. Coexisting incomparable conditions that assign different values to the same target/property produce a diagnostic unless the author expresses an intersection, exclusion, or other explicit precedence.

## Selector capabilities

Property chaining represents descendant paths only. Same-node local class compounds such as `.button.primary` are not part of the first-version language. Component variants use attributes, ARIA, or pseudo states:

```gss
.button[data-variant="primary"] {}
.tab[aria-selected="true"] {}
.button:hover {}
```

External class contracts are explicit:

```gss
.editor :global(.ProseMirror-focused) {}
```

Selector lists are expanded into independent semantic branches. Every branch must pass capability validation or the complete authored rule fails.

Supported functional conditions include `:not()`, `:is()`, and `:where()` over supported pseudo, attribute, and explicit-global arguments. `:where()` retains zero specificity.

`:has()` is an observed contextual relation:

```gss
.card:has(.error) {
  border-color: red;
}
```

The subject and observed node use independent references:

```tsx
<div className={styles.card}>
  <span className={styles.error} />
</div>
```

The positive pseudo-element set is listed in [`mvp-capabilities.md`](mvp-capabilities.md). Pseudo-elements are part of rule identity and remain terminal selector targets.

## Standard CSS nesting

Standard CSS nesting is normalized before semantic analysis:

```gss
.father {
  display: flex;

  .son {
    color: red;

    &:hover {
      color: blue;
    }
  }

  > .icon {
    width: 16px;
  }
}
```

The normalized selectors pass through the same capability checks and relation planning as unnested CSS. Nesting does not create a second Less/Sass-style language.

## Conditions and layers

The first version supports `@media`, `@supports`, and `@container`. Projects register a global condition order:

```ts
conditionOrder: [
  "base",
  "dark",
  "tablet",
  "tablet-dark",
  "desktop",
]
```

All Modules use that order. An unregistered condition is emitted with a warning, but its relative precedence is outside the guarantee.

Named cascade layers use a separate project order:

```ts
layerOrder: [
  "reset",
  "base",
  "components",
  "utilities",
  "overrides",
]
```

Layer is part of rule identity. Normal and important declarations retain native CSS layer behavior, including important-layer reversal.

## Declaration semantics

Declaration values remain CSS token streams and are opaque unless a specific transformation has proof to inspect them.

A data-driven property-effect registry models shorthand/longhand overlap. Within an export, later declarations eliminate known losers. Remaining atoms use a global property-effect order, such as shorthand before its surviving longhand override.

Authored duplicate exact-property fallback sequences are rejected. Browser compatibility expansion belongs to the configured CSS transformer; feature fallback uses `@supports`.

Custom property providers are atoms on their authored targets. Names and values remain open so inheritance, inline style, external themes, and `style.setProperty()` continue to work. `@property` is a deduplicated global registration.

## Global resources

`@keyframes` is module-local by default. Static references in `animation-name` and `animation` shorthand are rewritten to a stable generated resource name. Keyframe blocks remain indivisible resources.

`@font-face` is a global indivisible resource. Family names remain authored so faces can be shared across Modules. Descriptor order and `src` fallback order are preserved.

## Cascade and output order

Winner resolution and CSS rendering are separate domain operations.

Within the author origin, semantic resolution follows:

```text
importance and cascade layer
→ selector specificity
→ registered condition order
→ relation implication
→ property-effect order
```

Canonical identity and emitted names provide deterministic output only; they never choose a winner. A result that depends on Module registration, worker completion, or name sorting is a compiler invariant failure.

## Safety policy

GSS-l is fail-closed. Inputs that cannot be proven safe return structured diagnostics rather than silently becoming scoped or preserved CSS.

Contextual relations, residual selectors, explicit globals, registered resources, and transformer-generated compatibility declarations are formal capabilities—not fallback bundles.

The first version emits one central production CSS asset for all reachable main and lazy Modules. Dev/HMR replaces Module contributions transactionally and regenerates a complete ordered snapshot.

## Verification

The testing package provides an independent `compileGssReference()` path that keeps authored selector/cascade structure. Browser fixtures compare its computed styles with the atomic output across relevant states and conditions.

Production output does not include reference CSS.

## Capability and evolution records

- Positive first-version support: [`mvp-capabilities.md`](mvp-capabilities.md)
- Explicitly discussed deferred work and non-goals: [`deferred-capabilities.md`](deferred-capabilities.md)
- Decision history and rationale: [`adr/`](adr/)
