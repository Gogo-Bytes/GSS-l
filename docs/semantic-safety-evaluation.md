# GSS-l semantic safety evaluation

> Status: first-version product semantics accepted. This document summarizes the resulting safety model; individual rationale and consequences are authoritative in [`docs/adr/`](adr/). Sections 1–15 describe the accepted contract, not proof that every combination is implemented. Current implementation and remaining acceptance are reconciled against `7e9b81a` in the [MVP roadmap](mvp-roadmap.md#reading-status-and-counts) and §18 below; historical verification records are not newly executed evidence.

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

**Implemented bounded reference slices; forty-nine-fixture native browser gate passed:** `@gss-l/testing` now exports synchronous `compileGssReference({ config, modules }, ports?)`, returning either complete CSS/public ScopeSchema mappings/diagnostics or diagnostics only. It has no production dependents, IO or framework/browser dependencies. PostCSS retains authored selector/declaration structure; independent per-Module authored-class names let the browser perform descendant accumulation and native cascade without invoking any atomic implementation.

Coverage is deliberately bounded to plain ASCII local classes/whitespace descendant paths; current or ancestor `:checked`/`:disabled` including a same-node intersection (one state-bearing path node), or one current/ancestor data-/ARIA equality attribute without pseudos; terminal `::before`/`::after` optionally with current checked/disabled states (no ancestor-state or attribute combinations); opaque `content` and basic `color`/`background-color`/`display`/`width`/`height`, and physical margin/padding shorthands/four longhands including importance. Value functions/escapes outside the bounded background-image extension below and equal-importance exact-property duplicates fail; ordinary quoted content parentheses are literal, not functions. Syntax/configuration outside these and the bounded registered-condition/layer, background-image and keyframe slices below fail explicitly with no partial output; only bound background-image values invoke the resolver. In particular, unsupported configured precedence cannot pass through as native authored-order semantics. Attribute names are lowercase `(data|aria)-[a-z][a-z0-9_-]*`, with `=` only and optional CSS whitespace. Values are unescaped single-/double-quoted text (excluding the matching quote, NUL/LF/CR/FF), or unquoted `[A-Za-z_][A-Za-z0-9_-]*`; empty quoted strings are allowed. Namespaces, flags, other operators, escapes and comments outside attribute strings fail. Class-node-only rewriting preserves comments and class-looking attribute text. These limits describe reference coverage, not new product restrictions; the reference is not a full GSS validator and performs no ambiguity or winner analysis.

The reproducible [browser harness](../packages/testing/README.md) passed parent native `agent_browser` acceptance for **twenty-five fixtures / 575 computed-value comparisons** (fourteen compiled-reference fixtures plus eleven hand-authored contextual goldens). Every fixture has empty `differences` and `expectedFailures`; both reference and atomic readings independently match literal expectations. Coverage includes ownership/Module isolation, descendant accumulation, physical margin/padding order/importance, native current checkbox and ancestor fieldset states, current/ancestor data-/ARIA equality, reversed authored long/short ancestor rules, simultaneous current/ancestor conditions, and repeated-name source bindings with positive and negative suffix embeddings. Entry, exit and restoration use native DOM state/attribute changes. The unchanged original ancestor-attribute regression reads `margin-left: 1px → 9px → 1px → 1px` on both sides. The checkbox margin probe reads `1px` on both sides in all five phases. The deliberate corruption control detects reference `9px` versus atomic `123px`.

The initial 21-fixture / 395-comparison run missed two review counterexamples (expanded specificity inversion and unchecked cross-path coactivity). Public-seam red/green regressions now guard both, including reverse order, importance, invalid intersections and transactional fallback rejection. Four added native priority fixtures pass forward/reverse normal/important variants on real disabled buttons, with unrelated/standalone same-value atom isolation and independent host/before/after restoration.

Two pseudo fixtures independently sample host, before and after content/color/display/dimensions, Module isolation, importance, absent content, descendant/subsequence/structural prefixes and non-replaced button disabled entry/exit. Each reading/difference names its subject. A pseudo-only atomic before-color override is detected (literal red versus `rgb(1, 2, 3)`) while host/after/other-Module readings remain unchanged; page success requires this and the original element control. Checked + pseudo is API-only. No content is injected and no pseudo applicability is emulated. A red public Compiler test exposed absent pseudo atoms on a structural prefix; the approved repair includes same-layer/condition declared paths/prefixes with winning declaration provenance retained across pseudo/state groups. Multi-class candidates require descendant ownership proof; standalone terminal class rules may match runtime-derived targets without interpreting sibling names as ancestors. Wrong-order/unrelated/sibling negatives and closed-target importance/authored-order/identity checks pass. Declared pseudo paths and their structural prefixes remain in the public ScopeSchema even when the authored rule is empty or no declarations survive planning; public-session regressions cover standalone/descendant before/after and mixed empty/populated paths. Target/priority-qualified emission preserves authored specificity without strengthening shared weaker atoms. Accumulated candidates are validated independently per pseudo subject before commit or preserved fallback; ambiguous coactive ties reject with LKG retained, and only a dominating explicit intersection resolves them. This does not introduce global authored-order winners or change ADR-0021/0027 semantics.

The production repair separates original rule provenance, ownership proof, and generated selectors. The framework-independent descendant planner binds each runtime condition to a specific source prefix only when both its preceding path and remaining suffix embed in the declared target (including mapped structural prefixes). It does not enumerate or share markers across unproved repeated-name bindings. Base, current-state/attribute and ancestor-state/attribute instances retain original class specificity; promoted target-only atoms are Module/target/specificity-qualified rather than globally strengthening a reusable atom. Exact-path ancestor marker names remain unchanged where compatible.

For the bounded descendant/pseudo cases described above, within each target/layer/condition/bound-predicate set, importance, original specificity and authored declaration order resolve property-effect winners. Authored ordinal never enters the registry or physical render order. Across those live predicates, native importance/layer/specificity, registered condition order, proven predicate implication and property effects remain precedence dimensions. This repair is not evidence of complete structural relation implication, general functional/observed-list specificity or full canonical compound condition registration; those remain open in roadmap Stages 3–4. Incomparable equal-priority coactive conflicts without an explicit dominating intersection fail transactionally before any preserved fallback. Canonical names only stabilize already-safe output. Contextual source and observed subject emission now also retain their represented ownership-prefix specificity: repeating only those authored path classes prevents an unrelated descendant state from weakening an existing child or `:has()` winner. Runtime-edge refinement order applies below native specificity/importance; `:has()` arguments remain unchanged. Marker placement/matching, resource behavior and at-rule semantics are unchanged. Public session regressions cover source embeddings, current/base interactions, closed-set ties, ambiguity and restoration, important effects, wrappers/layers, registration/replacement history and relocation.

An additional eleven contextual-boundary browser fixtures use explicit hand-authored native CSS/mappings for child and observed syntax rather than expanding the reference API. All eleven passed parent native browser acceptance. Literal expectations cover unrelated-condition toggles, child tie precedence, higher ancestor specificity, important child rules, and observed match/no-match/restoration.

Reference namespace-class regressions fail with diagnostics only, including after a valid Module; comment and attribute-string class text remain untouched. These are bounded manual browser and API checks, not completion of the full state/condition/resource corpus, independent browser CI or real-project Pilot. The reference still does not validate all production ambiguity/precedence contracts.

**Registered-condition/layer follow-up passed:** the reference now accepts one nonempty condition kind per invocation, flat registered media/supports/container wrappers, and optional outer configured simple-name layers. Independent global base-first/config-rank partitioning moves whole authored groups, not declarations, specificity or importance. A native layer prelude preserves normal/important reversal and unlayered priority. Exact query grammar, name exclusions and fail-closed limits are in [ADR-0030](adr/0030-make-semantic-reference-css-a-testing-capability.md) and the testing README. Mixed kinds, compound/nested wrappers, layer-inside-condition, nested/dotted layers, unknown registrations and resources other than the bounded background-image/keyframe extensions remain outside reference coverage; Compiler warnings/fallback and accepted product semantics are unchanged.

Parent native acceptance passed **43 fixtures / 803 comparisons** (previous 25 / 575 retained; 18 / 228 added), with zero differences and literal failures and all four corruption controls detected. Source/config reversals, Module isolation/reversed registration, base/condition rank, specificity/importance, native layer normal/important/unlayered priority and layer+condition interaction are measured. Actual iframe/named container widths traverse 640 → 100 → 300 → 640; supports records block/grid true and gss-unsupported false (baseline/recheck, not dynamic restoration). State records include viewport, media/supports booleans and provider width. Matching-only condition corruption detects 7px→123px at baseline/restored-both; layer-prelude corruption flips normal blue→red and important/unlayered-important red→blue. Original element/pseudo controls and pseudo controlsUnchanged remain intact. No Compiler edits were needed. Focused reference tests (134) and workspace verification (439 tests, lint/build/typecheck) passed. Reference review then exposed container operators accepted as names outside that grammar. The bounded correction rejects `not`/`and`/`or` case-insensitively, including unused registrations, while retaining these as valid layer names; seven public regressions pass. The original 43/803 corpus did not expose this invalid-name boundary; parent post-fix revalidation freshly opened the rebuilt server and again passed 43/803 with zero differences/literal failures, all four controls detected and pseudo controls unchanged. The full independent oracle/React corpus, browser CI and Pilot remain incomplete.


**Asset reference follow-up passed:** the unchanged synchronous port now handles one case-insensitive `url(...)` or `none` background-image, including quoted/unquoted CSS simple/hex escapes, exact CSS-decoded (not URI-decoded) Module-local URL keys and opaque identity. All sources/configurations/bindings validate before callbacks; identical duplicate bindings are allowed, while empty/unknown/conflicting bindings fail. Each exact used identity resolves once per invocation. Unbound spelling and ordinary URL-looking content/comments remain authored; delivery URLs never influence mappings. Missing/empty/thrown resolver results produce diagnostics only, never partial CSS/schema or retained cache; external callback side effects are not transactional. Safe CSS-string output uses no authored-text placeholders. Other functions/resources, general escapes and mixed/nested condition expansion remain outside this reference slice; see ADR-0030/README for exact raw/decoded character grammar. No new product restriction or deferral is introduced.

Parent native acceptance passed **46 fixtures / 819 comparisons**, preserving **43 / 803** unchanged, with zero differences/literal failures and all five corruption controls effective. Three new compiled-reference fixtures cover Module-scoped equal authored URLs across two delivery generations, query/fragment and CSS-versus-URI decoding, plus layer/media/current-disabled `::before` composition. Host-owned exact routes serve deterministic SVG bytes, with no external network/filesystem widening. Each side independently checks literal URLs and fetched/decoded natural dimensions; this is not a background-paint/screenshot assertion. The wrong-asset corruption is successfully decoded but changes only atomic AssetA/card URL and dimensions **3x2 → 11x7**, leaving AssetB unchanged; the original four controls and pseudo controlsUnchanged remain intact. API tests passed **226** (134 existing + 92 Asset cases); workspace verify passed **531** tests plus lint/build/typecheck. No production Compiler/Vite or public API changes were needed. Full independent oracle/resource/React corpus, browser CI and Pilot remain incomplete. Review then found two value-trivia defects absent from the original 46/819 corpus: leading value comments bypassed validation through PostCSS `raws.between`, and trailing declaration CSS whitespace rejected valid URL/none values. Twenty public regressions now pin zero-callback diagnostics for leading comments, preservation of standalone/quoted comments, all five outer CSS whitespace characters, unchanged URL contents and non-CSS-whitespace rejection. These are reference-only grammar corrections; literal fixture expectations remain unchanged. Parent freshly reopened the rebuilt post-fix server and again passed **46 fixtures / 819 comparisons**, zero differences/literal failures, all five controls detected, pseudo/asset controls unchanged.

**Bounded keyframe reference implementation:** unchanged public seam now namespaces unique root-only Module definitions independently, resolves forward/static single-name references and retains external names. Frame selectors never become ownership paths; resource-only/empty definitions retain empty mappings. Exact literal frame and animation-longhand grammar/exclusions are recorded in ADR-0030/testing README; condition/layer-scoped definitions, shorthand/lists/var and frame Assets remain outside this reference, not production deferrals. All validation still precedes Asset callbacks. 91 new public tests (including PostCSS-trivia red/green), 317 reference / 622 workspace tests and lint/build/typecheck passed. Three paused browser fixtures use side-local authored-symbol probes only for transport alignment, then assert exact CSSAnimation count/association/effect.target and independently literal effect timing/frames. A verified A-only definition-removal control must preserve B/unrelated readings. Parent freshly reopened native gate passed **49 / 875**, zero differences/literal failures, all six controls detected, pseudo/asset/keyframes controls unchanged and definition removal verified; original 46 / 819 retained. Initial 49 / 870 had four both-side literal easing failures: the harness conflated CSS per-keyframe easing with effect-level easing. Independent computed ease-in, effect linear and frame ease-in assertions now pass without production changes; no painted-pixel, full oracle/React, browser CI or Pilot claim.

Review follow-up: the passing 49/875 corpus did not cover malformed property/colon punctuation or comments hidden in `raws.important`. Public red/green reproductions showed both frame `width !: 1px` and ordinary `animation-name !: pulse`, plus `!/**/important` and `!important/**/`, wrongly succeeded and invoked an earlier Module's Asset resolver. The reference-only fix validates the complete separator as CSS whitespace, one colon, CSS whitespace, and rejects comment-bearing importance trivia before callbacks. Nine new public regressions assert diagnostics-only/zero-callback failures and preserve all five CSS whitespace characters with mixed-case ordinary `!important`; frame importance remains prohibited. Verification passed **326 reference tests (100 keyframe) / 631 workspace tests**, lint/build/typecheck and diff check. No production/API/harness/fixture/expectation changes. Parent freshly reopened the final rebuilt owned strict4178 page after both fixes and read the actual native result: **passed, 49 fixtures / 875 comparisons**, zero differences/literal failures, all six controls detected; pseudo/asset/keyframes controls unchanged and keyframes definition removal verified. Original 46/819 expectations and five controls remain unchanged. This is bounded final-build native evidence, not full oracle/browser CI/Pilot completion.

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

The semantic design stage is complete. The recorded baseline discarded the recipe-oriented exploratory implementation under the read-only legacy policy; this status reconciliation does not independently reconstruct sibling/copy history.

The [roadmap reconciliation](mvp-roadmap.md#reading-status-and-counts) preserves 108 original checkbox units: 87 checked, 18 partial and 3 not implemented. These mix decisions, bounded implementation and historical manual acceptance, not a readiness percentage. Pure ownership planning and all four session lifecycle labels now reflect existing code/tests. Full domain/parser/allocator boundaries, selector/cascade semantics, diagnostic/source ranges, Compiler CSS maps and target manifest/report fields remain open. Browserslist compatibility sequences and compatibility-specific preserved fallback are not implemented; the existing whole-Module fallback is for unknown property effects. Interleaved runtime/ownership and explicit-global functional/observed planning are also absent. Full canonical condition-context registration in §9 is an accepted target, not the current per-kind query configuration.

**First bounded S2 implementation:** domain-owned normalized IR and an internal injectable `CssParserPort` now separate the session from default PostCSS composition. Original UTF-16 half-open spans cover declarations, rules, resources and frames; list/nesting branches use enclosing authored rule spans, not fabricated generated-selector offsets ([limits](architecture.md#internal-source-provenance-bounded-implementation)). Physical provenance never enters semantic names/order/resource identity. Public session regressions cover malformed mixed-selector diagnostics, no partial commit, last-known-good retention, relocation/offset-independent resource sharing and pre-seam output goldens. Syntax errors use existing `GSS1001`/`parse` with a path-clean message; diagnostic `id` remains caller-supplied. Public ranges/path fields, CSS maps, complete value concepts and matrix-wide diagnostic gates remain open. No accepted syntax/cascade/fallback or independent reference behavior changes, and no original roadmap checkbox count changes follow from this bounded stage. Validation passes **648 workspace tests** (17 new), lint/build/typecheck and diff checks. Parent freshly reopened the rebuilt owned strict4178 page with native `agent_browser`, took a snapshot and read **status passed, 49 fixtures / 875 comparisons**, zero differences/literal failures and all six controls detected; pseudo/Asset/keyframe controls remained unchanged and keyframe definition removal was verified. No reference/oracle fixture or expectation changed; the earlier 531-test and keyframe-reference history above remains historical evidence. Review then exposed original-span offsets after a stripped leading U+FEFF/U+FFFE and uncaught malformed authored inline source-map annotations. The first follow-up added 28 tests (**676 workspace tests**, lint/build/typecheck pass): BOM offsets translate back to unchanged caller CSS; the existing exported PostCSS PreviousMap consumer preflights inline decode/schema errors without broad parser recovery or external-file policy changes. Parent native acceptance then passed 49/875/six controls, but further review exposed lazy mapping errors during syntax-error lookup. The bounded repair guards only the current inline-map consumer's `originalPositionFor` via normal public Input construction and the exported Parser for nonempty inline maps ([boundary](architecture.md#diagnostics)); absent/external/empty annotations retain normal `postcss.parse`. No mapping traversal is forced: valid CSS with `?`/`AA` mappings still commits as in baseline 6864013, while unclosed CSS and malformed selectors now diagnose and retain LKG/schema/generation. Baseline malformed selectors already escaped; that historical behavior is not presented as diagnostic success. Baseline valid v3/XSSI/charset/base64/empty payloads and last-annotation precedence remain unchanged across all 13 comparison rows; unexpected parser/custom-port failures still propagate and other Input instances remain unaffected. The 19 additional regression tests bring verification to **695 workspace tests** (265 Compiler), lint/build/typecheck pass. Parent freshly reopened the rebuilt strict4178 harness after the lazy-lookup repair, took a native snapshot and read **passed, 49 fixtures / 875 comparisons**, zero differences/literal failures, all six controls detected; pseudo/Asset/keyframe controls unchanged and keyframe definition removal verified. No output-affecting edits followed this final native gate.

React shared-type/cross-file provenance and typed escape coverage remain partial. The Vite implementation and historical smoke evidence below are retained, but do not establish full supported-host SSR/SSG/client linkage/hydration or representative clean/incremental convergence. [ADR-0044](adr/0044-scope-vite-adapter-to-vite-managed-html.md) limits host responsibility to Vite-managed HTML; no generic SSR integration is implied. The prior 631-test verification and 49/875/six-control native oracle are bounded historical gates. Actual browser CI is not checked in, the representative React/state/condition/resource oracle is incomplete, and no real-project Pilot migration/size/feedback report is evidenced. No new product semantics or deferrals follow from these gaps.

Stage 1 of [`mvp-roadmap.md`](mvp-roadmap.md) established the new Compiler workspace and verification commands. Implementation now proceeds in test-first vertical slices through the accepted `GssCompilerSession` seam. The Vite virtual-JavaScript, explicit source-Adapter composition, and dev central CSS/HTML/HMR slices are implemented with real Vite integration tests, including HTTP/WebSocket coverage. Browser smoke verification covered red → blue → invalid source (blue retained with overlay) → green recovery, with one stylesheet link, no appended style elements, and no page reload in a self-accepting fixture. Production central CSS and JSON delivery are now covered by real build/watch tests: lazy census, MPA/base handling, empty census, preserved fallback reporting, source-snapshot consistency, and relocation stability. Production preview browser checks confirmed lazy rules are present before lazy JS loads, lazy rendering adds no stylesheet, and both HTML entries share the same asset. Dev resource browser checks loaded a real font and exercised red → blue image bytes → deleted image (blue bytes and CSS retained with overlay) → green recovery, preserving the DOM node, one stylesheet link, zero appended style elements and one application boot. A separate identical-byte restoration check cleared the error overlay without reloading. The broader semantic-oracle/Pilot gates remain incomplete.

**Bounded public diagnostic range follow-up:** [ADR-0051](adr/0051-expose-bounded-original-css-diagnostic-ranges.md) adds exported `GssSourceRange = { start: number; end: number }` and optional `GssDiagnostic.range`. Offsets are original caller CSS, zero-based UTF-16 and half-open, including BOM/CRLF/astral positions. CSS syntax uses validated parser Input coordinates rather than upstream map locations; missing ends are zero-width parser-reported points (including EOF when genuinely reported). Selector syntax reached in prevalidation and unsupported selectors use the enclosing authored rule, not fabricated generated-selector tokens. Duplicate declarations use the actual repeated declaration. Unreliable coordinates/origins and inline-map helper failures omit ranges, even if a lazy lookup fails during selector validation. Other capability/config/binding/resource/registry/multi-origin sites remain unranged. Id/code/order, no-partial-commit/LKG generation/schema/snapshot, normal outputs/names/manifest/resource identity, parser composition and data-only map containment remain unchanged. Existing reference diagnostics may omit this field; production parser/IR is not imported by the reference. Public source-adapter interfaces, CSS maps, IDE/Vite overlay consumption, remaining site coverage and full stable-diagnostics acceptance are not completed. The original roadmap's 108 labels / 87 checked / 21 open remain unchanged. [Public tracers](../packages/compiler/test/diagnostic-ranges.test.ts) and the existing map/parser regression suites provide bounded evidence. Final `corepack pnpm verify` passes **735 workspace tests** (305 Compiler, 326 reference, 23 React, 81 Vite), lint/build/typecheck; diff and local documentation link checks pass. Parent freshly reopened the verified strict4178 page with native `agent_browser`, took a snapshot and read the actual result: **passed, 49 fixtures / 875 comparisons**, no differences/literal failures, all six controls detected; pseudo/Asset/keyframe controls unchanged and keyframe definition removal verified. No output-affecting edits followed this gate. Reference/harness fixtures and expectations remain unchanged; this is not matrix-wide S2, full oracle or Pilot acceptance.


**Bounded Vite diagnostic presentation follow-up:** the Adapter consumes existing optional Compiler ranges through native Rollup/Vite `loc`/`frame`, not a new overlay protocol or domain API. [Presenter](../packages/vite/src/diagnostics.ts) snapshots match the physical diagnostic owner and the exact replacement/census text; formatting performs no IO and never substitutes active JSX or a newer disk version. Original UTF-16/BOM/CRLF/astral offsets, multiline exclusive ends and zero-width/EOF insertion points are retained. Missing/mismatched/unreliable ranges and React/IO/resource errors remain location-free. Severity/code/order, Compiler results and LKG resource/CSS state stay unchanged. Current ranged sites remain those of ADR-0051; remaining attribution sites, paths/sorting, IDE integration, CSS maps and full S2/host acceptance stay open.

Parent native testing exposed a pre-existing same-schema recovery flaw: identical blue restoration cleared the overlay but rebooted a non-accepting importer and replaced its DOM node. An isolated `5aca280` archive reproduces the public failing test. The explicitly approved bounded repair suppresses JavaScript propagation only for latest successful unchanged-ScopeSchema stylesheet replacement, using the existing forced native CSS update on recovery; changed schema and deletion still propagate, stale tasks cannot suppress the latest result, and error graph invalidation/LKG remain intact. Parent rebuilt native gate verifies duplicate `GSS1204` at physical `.gss:3:2` with the repeated-declaration frame, prior red styling and stable boot/node; exact red restoration clears the native overlay with unchanged boot/node, one central link and zero appended styles. Changing red to blue changes atomic scope JavaScript and correctly propagates/reboots this non-accepting fixture; this is a positive control, not a CSS-only recovery failure.

[21 real Vite regressions](../packages/vite/test/diagnostic-location.test.ts) plus [18 private defensive coordinate tests](../packages/vite/test/diagnostics.test.ts) cover cold JSX/source-map and load errors, actual production error/watch refresh, census warning snapshot replay, watcher duplicate/syntax payloads, stale-read suppression and recovery controls. `corepack pnpm verify` passes **774 tests** (305 Compiler, 326 independent reference, 23 React, 120 Vite), lint/build/typecheck. Existing **735 tests** and all **49/875/six-control oracle fixtures and expectations** are unchanged; this native host gate supplements them without claiming a fresh full oracle or Pilot. The roadmap retains **108 original labels / 87 checked / 21 open**.

**Bounded structural relation implication follow-up (ADR-0013):** the public session tracer reproduced adjacent/general sibling conflict output in the wrong order: authored adjacent red then general blue emitted red before blue in either authored order. Parent native red confirmed only the six added contextual goldens failed (ten adjacent differences/atomic literal failures, no reference literal failures); original 49 fixtures remained clean. This is a reproduced defect, not merely the earlier roadmap rank-risk observation.

The framework-independent [structural planner](../packages/compiler/src/domain/plan-structural-relations.ts) distinguishes owned target/source paths, live runtime suffix edges and aligned source predicates. Adjacent implies general sibling on the same witness; extra earlier runtime edges may be forgotten when the remaining suffix aligns. Predicate supersets refine a relation at the same bound source. Ownership segments are not inferred DOM ancestry: a structural source predicate implies an ancestor predicate only across an all-child suffix. Proof edges, not combinator weights/names/values/registration order, generate topological emission ranks only on target-qualified structural emissions. Existing descendant ranks remain context-independent because their atoms can be shared across targets/Modules; descendant constraints cannot imply a runtime edge and safely anchor the structural graph. In Modules with structural rules the existing descendant-instance path retains original authored specificity for accumulated base declarations too; unrelated descendant-only and pseudo planners are unchanged. Equivalent structural conditions resolve declarations only within their closed same-target/context group using importance/specificity/authored ordinal, preserving original rule/declaration provenance.

Incomparable coactive equal-priority overlapping effects diagnose before contribution commit or preserved fallback, retaining generation/schema/CSS LKG. Scope equality does not imply DOM node identity. Negation/equality exclusions and explicit intersections require the same source uniquely determined by both reverse child/adjacent chains; general-sibling or differently bound sources cannot establish that proof. An equal-native-priority covering intersection is accepted when it strictly implies both conflicting conditions; the same full-coverage/unique-witness checks still exclude repeated witnesses and extra predicates. A necessarily coactive higher-priority winner can also cover a conflict. Existing importance, layer, registered-condition, authored specificity and host/pseudo ownership remain precedence dimensions. Unexpected parser/custom-port exceptions still propagate.

A further public red case `.input:checked + .label { color: red } .input .label:has(:checked) { color: blue }` committed at both isolated baseline `f14ca55` and the initial repair despite independent coactive witnesses and equal emitted specificity. The bounded guard now includes opaque observed branches in affected structural competition, using their emitted class/type specificity; it adds no general `:has()` implication or new accepted syntax. Nonconflicting/equal effects, distinct targets and native-priority observed/structural winners remain accepted. Functional/observed-list maxima, general implication, interleaved/global grammar and full cross-context safety remain the existing roadmap gaps, not newly deferred capabilities.

[48 new public session regressions](../packages/compiler/test/structural-relations.test.ts) cover forward/reverse ordering, source state/attribute/zero-specificity refinement, longer/mixed suffixes, repeated-source ambiguity, valid unique-witness exclusions/intersections, effect overlap, observed/native-priority controls, unknown-property fallback containment, LKG, names/values/registration and clean/replacement convergence. `corepack pnpm verify` passes **822 tests** (353 Compiler, 326 independent reference, 23 React, 120 Vite), lint/build/typecheck. Before review corrections, parent opened the rebuilt owned strict4178 server using native `agent_browser` and read **passed: 64 fixtures / 953 comparisons**, zero differences/literal failures, all **seven** controls detected. Original **49 / 875 / six controls** and literal expectations remain unchanged. Twenty added [hand-authored contextual goldens](../packages/testing/browser/structural-relation-fixtures.ts), not `compileGssReference` coverage, independently specify adjacent/nonadjacent/state/attribute/refinement/mixed-chain and structural/observed priority winners. Earlier-only source phases prove two same-class nodes are distinct witnesses. The new CSSOM wrong-order control actually moves only the general-sibling rule after adjacent, changing adjacent red to blue while distant readings stay unchanged (`ruleReordered` and `controlsUnchanged` true); pseudo/Asset/keyframe controls remain unchanged and keyframe definition removal is verified. This is bounded parent native acceptance, not full S3.10/oracle/browser CI/Pilot completion. Original roadmap counts remain **108 units / 87 checked / 21 open**.

Review reproduced five failing public cases: shared conditional margin atoms acquired different local ranks depending on Module/target planning, and equal-specificity exact adjacent intersections were rejected. The seven new regressions pass after retaining descendant ranks and adding strict-refinement precedence to fully covering intersections. The five new independent goldens sample checked margin-left literals in both registration orders/single-Module and forward/reverse adjacent intersection entry/exit. After the final build, parent native `agent_browser` freshly passed **69 fixtures / 972 comparisons**, zero differences/literal failures and all seven controls detected. The three actual shared-effect records read margin-left 2px → 1px → 2px; both equal-specificity intersections pass all phases/literals. The relation control reports `ruleReordered`/`controlsUnchanged` true; pseudo/Asset/keyframe controls retain unrelated readings and keyframe definition removal remains verified. No output-affecting edits followed this gate.
