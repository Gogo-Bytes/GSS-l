# @gss-l/testing — bounded independent reference

Test-only synchronous compiler; no production package depends on it.

```ts
import { compileGssReference } from '@gss-l/testing';

const result = compileGssReference({
  config: { projectRoot: '/project' },
  modules: [{ id: '/project/Card.gss', source: '.card { color: red; }' }]
});
if (result.success) {
  const card = result.scopeSchemas['/project/Card.gss']!.exports.card!;
  // Apply card.selfClassName to the reference document and install result.css there.
}
```

Success contains `css`, `scopeSchemas` keyed by original input id, and `diagnostics`. Failure contains only `diagnostics`, with no partial CSS/mappings. No input is mutated or retained. Duplicate logical Module ids fail; Module output is sorted by logical identity, while authored rule/declaration order is unchanged. Names encode project-relative Module identity and authored class, without an atomic allocator. Scope paths reuse their terminal authored class token, so actual ancestor DOM—not a winner resolver—performs accumulation.

## Current reference coverage (not product capability limits)

- Plain ASCII local classes (`[A-Za-z_][A-Za-z0-9_-]*`) and whitespace descendants, with declared scope paths and structural prefixes. Duplicate paths/state variants reuse the same per-Module authored-class token.
- Current **or** ancestor `:checked` / `:disabled`, including their same-node intersection; pseudo states may occur on only one path node per selector.
- Alternatively, one current **or** ancestor data-/ARIA equality attribute per selector, without pseudo states. Names match `(data|aria)-[a-z][a-z0-9_-]*` (lowercase ASCII). Only `=` is accepted, with optional CSS whitespace around name/operator/value. Values are single-/double-quoted unescaped text (excluding the matching quote, NUL, LF, CR and FF), or unquoted `[A-Za-z_][A-Za-z0-9_-]*`. Empty quoted values are allowed. No namespaces, flags, presence checks, other operators, escapes or comments outside attribute strings.
- Native selector specificity and state text remain authored; only class AST nodes are renamed. Comments and class-looking text inside attribute strings remain untouched.
- Terminal `::before` / `::after` on local ownership/descendant paths, optionally with current `:checked` / `:disabled` (including their intersection). The pseudo-element stays on the base ScopeSchema node, never a new path segment. No ancestor-state or attribute + pseudo-element combinations.
- `content`, `color`, `background-color`, `display`, `width`, `height`. Content is opaque under the same no-function/no-escape policy; quoted strings are preserved, never auto-injected.
- `margin`, `padding` and their physical `-top`, `-right`, `-bottom`, `-left` longhands.
- Authored grouping/order and `!important`; values stay opaque but functions/escapes are rejected. Equal-importance duplicate exact properties fail; normal/important pairs remain intact.

Everything else fails explicitly, including lists/nesting, hover/focus/other or functional pseudos, attributes outside the grammar above, multi-node states, multiple attributes or attribute/pseudo combinations, other/misplaced/repeated pseudo-elements, ancestor-state + pseudo-element combinations, child/sibling/runtime relations, at-rules/resources, other properties, nonempty condition/layer registration and asset bindings. Empty registrations and either `atomizationFallback` policy are accepted; no reference fallback/planning occurs. The optional second argument `{ resolveAssetUrl? }` reserves the approved host port but is not called in this resource-free slice.

This is a bounded reference renderer, **not a full GSS validator**. It neither decides state ambiguity nor changes production capability limits. Oracle fixtures use explicit `:checked:disabled` intersections or distinct properties where production requires unambiguous precedence.

Production compiler types are imported only as types. Runtime reference code uses PostCSS, the independent `postcss-selector-parser` syntax library and local lexical path infrastructure, not the production session, resolver, identities, planners, or naming allocator. Filesystem/Vite/browser code is confined to the harness, not the exported compiler.

## Reproducible browser acceptance

From the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm --filter @gss-l/testing browser:reference
```

Open **http://127.0.0.1:4178/** with native `agent_browser`. The fixed port is strict. Stop the server with Ctrl-C when done.

The page compiles the fourteen reference and atomic fixture outputs separately on the Vite host. Eleven additional contextual-boundary fixtures use explicit hand-authored native CSS and mappings, never atomic output, for syntax intentionally outside `compileGssReference` (child relations and `:has()`). The reference API remains fail-closed for that syntax. It renders identical fixture DOM with the corresponding mappings into separate same-size iframe documents, each with only its own stylesheet. No React adapter or browser-side compiler is involved. Both sides must match literal expected computed values, not merely each other. Fixtures cover:

1. Local ownership and isolation of equal class names in two Modules.
2. `.icon`, `.son .icon`, `.father .icon`, `.father .son .icon` accumulation with actual matching ancestors, including direct and standalone icons.
3. Margin/padding shorthand-before-longhand, longhand-before-shorthand, important shorthand, important longhand, and both-important declarations. All four physical longhands are compared.
4. Native checkbox current `:checked`/`:disabled`: baseline → checked → checked+disabled (explicit intersection dominates) → disabled-only → restored. Changes assign DOM `checked`/`disabled` properties, never class toggles.
5. Native ancestor fieldset `:disabled`, ancestor data-/ARIA equality and current data-/ARIA equality on ordinary nodes: baseline → conditions entered → nonmatching attribute values / enabled fieldset → attributes removed / restored. Distinct touched properties avoid introducing ambiguous production combinations. Changes assign `fieldset.disabled` and use `setAttribute`/`removeAttribute`.

6. Forward and reversed long/short ancestor-condition rules: all four margin/padding effects, important declarations, a weaker current attribute against a stronger base, a stronger current attribute simultaneous with an ancestor state, and restoration.
7. Repeated-name source embeddings: an inner disabled `.a` cannot activate `.a:disabled .b .c` when the required `.b` precedes it; a later `.b` makes the positive binding valid. Inner-only, both, outer-only and restored phases run natively. (The forward/reverse pair counts as two fixtures.)

8. Eleven hand-authored contextual-boundary goldens: adding/removing an unrelated checked rule cannot change the child or observed winner; child refinement beats the same descendant source predicate at equal specificity, but not greater authored specificity or importance; observed class and native checked/no-match/restoration cases retain their subject priority. Child specificity/importance cases run in both authored orders. One same-source child fixture intentionally reverses atomic authored order while its literal native golden places the ADR-0013 child winner last; this models accepted GSS relation precedence explicitly rather than treating atomic output as an oracle.

9. Two compiled-reference pseudo fixtures sample originating elements and both `::before`/`::after` via native `getComputedStyle(element, pseudo)`: Module isolation, distinct content/color/display/dimensions, important color, absent content, descendant ordered-subsequence accumulation and structural prefixes. A non-replaced button enters/exits native `disabled`; its after content/color change and restore while before/host readings remain unchanged. Checked + pseudo syntax is API-tested only; no checkbox pseudo-box claim is made.
10. Four additional pseudo-priority fixtures cover forward/reverse authored order and normal/important disabled declarations. Real buttons under outer → middle → icon retain the higher authored before specificity; unrelated/standalone buttons reuse a weaker same-value declaration without inheriting its priority. Disabled entry/restoration samples literal element/before/after values independently.

Each phase checks every explicitly touched property against literal expectations independently on both sides. Missing phase expectations fail. Native state matches and data-/ARIA attributes are recorded for every node, including ancestors. Ancestor `:checked` is API-tested; it is not claimed as browser fixture coverage.

Wait until `window.__GSS_REFERENCE_RESULT__.status !== 'running'` (also JSON text in `#result`). Acceptance requires:

```js
const r = window.__GSS_REFERENCE_RESULT__;
r.status === 'passed' &&
r.results.length === 25 &&
r.results.every(f => f.comparisons > 0 && f.differences.length === 0 && f.expectedFailures.length === 0) &&
r.negativeControl.detected === true &&
r.pseudoNegativeControl.detected === true &&
r.pseudoNegativeControl.controlsUnchanged === true
```

Each difference reports phase, actual native pseudo/attribute state, Module id, scope path, node, sampled subject (`element`, `::before`, `::after`), property, reference value and atomic value; each fixture also exposes its phase list and complete readings. The negative control intentionally overrides atomic `#forward` with `margin-left: 123px !important`; it must detect reference `9px` versus atomic `123px`. A second control overrides only atomic `#pseudo-a::before` color with `rgb(1, 2, 3) !important`; exactly one before-color difference from literal red must be detected, with every originating-element/after/other-Module reading unchanged. Page success requires both controls. If either compilation or frame loading fails, the page fails rather than reporting an empty comparison as success (host compilation errors also appear in Vite's overlay).

**Bounded native browser gate passed.** Parent `agent_browser` ran all twenty-five fixtures (fourteen compiled-reference fixtures plus eleven hand-authored contextual goldens): **575 computed-value comparisons**, no differences or expected failures. The unchanged original ancestor attribute fixture now reads `margin-left: 1px → 9px → 1px → 1px` on both sides. The checkbox margin probe reads `1px` on both sides across all five phases; the abandoned padding probe is not used to assert native checkbox rendering. The corruption control remains effective (`9px` versus `123px`).

The pseudo slice exposed a public-session regression: `.icon::before` / `.icon:disabled::after` were absent from a declared `.outer .icon .leaf` structural prefix. The bounded restoration includes declared target paths/prefixes in the same layer/condition. Multi-class candidates require a proven descendant ownership prefix; standalone terminal classes can match runtime-derived targets, but sibling path names cannot invent ancestry. Pseudo planning retains winning declaration provenance and authored specificity with target/priority-qualified atoms, and validates accumulated candidates separately per pseudo subject before either commit or preserved fallback. Only a closed bound-predicate set uses authored order (ADR-0027); incomparable coactive ties reject transactionally unless an explicit intersection dominates by importance/specificity. Wrong-order, unrelated and sibling-derived negatives are API-tested.

The production descendant-condition repair binds each target to proven source-prefix embeddings (including negative repeated-name cases), preserves original base/current/ancestor specificity, and resolves declaration effects only inside closed bound-predicate candidate sets. Incomparable equal-priority coactive conflicts fail closed, not by marker name/order. Tests also exercise transactional replacement, registration order, project relocation, layers and registered conditions through the public Compiler seam. At the contextual boundary, source and `:has()` subject markers repeat only the authored path classes they represent; observed arguments keep native specificity. Runtime-edge refinement order breaks ties but does not alter browser specificity or importance. Marker placement/matching is unchanged. No public testing API or accepted GSS semantics changed.

This is **not** the complete state/condition/resource oracle, browser CI, or Pilot. The reference remains deliberately bounded and is not a substitute for production ambiguity validation.

Fast API checks: `corepack pnpm --filter @gss-l/testing test`. Browser files are typechecked but are not automatically browser-executed by `pnpm verify`.

The original 21-fixture / 395-comparison run did not expose two review counterexamples: expanded pseudo targets lost authored specificity, and cross-path equal-precedence coactive states bypassed validation. Both now have public-session red/green regressions, including last-known-good retention, reversed order, invalid intersections and independent subjects. The expanded 25-fixture / 575-comparison parent native run passed with zero differences/literal failures and both negative controls effective. Coactive checked/disabled pseudo ambiguity is compiler/API coverage, not a painted checkbox pseudo-box assertion. Full oracle coverage, browser CI and Pilot remain incomplete.
