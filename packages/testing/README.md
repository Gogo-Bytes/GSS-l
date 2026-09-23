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

Success contains `css`, `scopeSchemas` keyed by original input id, and `diagnostics`. Failure contains only `diagnostics`, with no partial CSS/mappings. No input is mutated or retained. Duplicate logical Module ids fail; Output groups are globally ordered base-first then by configured condition rank; logical Module identity stabilizes output within a rank, never decides a claimed semantic winner. Authored order inside each corresponding group and declaration order remain unchanged. Independent Module names are isolated; arbitrary composition of their exports is not an oracle guarantee. Names encode project-relative Module identity and authored class, without an atomic allocator. Scope paths reuse their terminal authored class token, so actual ancestor DOM—not a winner resolver—performs accumulation.

## Current reference coverage (not product capability limits)

- Plain ASCII local classes (`[A-Za-z_][A-Za-z0-9_-]*`) and whitespace descendants, with declared scope paths and structural prefixes. Duplicate paths/state variants reuse the same per-Module authored-class token.
- Current **or** ancestor `:checked` / `:disabled`, including their same-node intersection; pseudo states may occur on only one path node per selector.
- Alternatively, one current **or** ancestor data-/ARIA equality attribute per selector, without pseudo states. Names match `(data|aria)-[a-z][a-z0-9_-]*` (lowercase ASCII). Only `=` is accepted, with optional CSS whitespace around name/operator/value. Values are single-/double-quoted unescaped text (excluding the matching quote, NUL, LF, CR and FF), or unquoted `[A-Za-z_][A-Za-z0-9_-]*`. Empty quoted values are allowed. No namespaces, flags, presence checks, other operators, escapes or comments outside attribute strings.
- Native selector specificity and state text remain authored; only class AST nodes are renamed. Comments and class-looking text inside attribute strings remain untouched.
- Terminal `::before` / `::after` on local ownership/descendant paths, optionally with current `:checked` / `:disabled` (including their intersection). The pseudo-element stays on the base ScopeSchema node, never a new path segment. No ancestor-state or attribute + pseudo-element combinations.
- `content`, `color`, `background-color`, `display`, `width`, `height`. Content is opaque with no functions outside strings and no escapes; quoted URL-looking text is preserved, never discovered as an Asset or auto-injected. Other basic values retain the prior no-function/no-escape gate.
- `margin`, `padding` and their physical `-top`, `-right`, `-bottom`, `-left` longhands.
- Authored grouping/order and `!important`; basic values stay opaque but functions/escapes are rejected (literal content strings and bounded background-image are described separately). Equal-importance duplicate exact properties fail; normal/important pairs remain intact.

### Asset binding + background-image (bounded)

- Exactly case-insensitive `none` or one case-insensitive literal `url(...)`. Single-/double-quoted or unquoted nonempty arguments allow CSS whitespace around the argument and complete declaration value (space/tab/LF/CR/FF only). Outer whitespace is ignored for validation, not removed from URL contents or unbound output. Quoted arguments exclude an unescaped matching quote; unquoted arguments exclude unescaped whitespace, quotes, parentheses and comments.
- CSS simple escapes and 1–6 hex-digit escapes are decoded for binding lookup only. A hex escape may consume one CSS whitespace terminator (CRLF counts as one). Escaped spaces/quotes/parentheses are supported. Raw or decoded U+0000–001F, U+007F, unpaired surrogates, out-of-range scalar escapes and escaped newline continuations fail; hex terminator whitespace is not URL content. No URI decoding, normalization, filesystem resolution or case folding of URL keys/identities occurs. Query/fragment and Unicode/case distinctions remain opaque.
- URL lists, gradients, `var`, `image-set`, modifiers, escaped function names, comments outside the quoted URL and resource properties/at-rules outside the keyframe slice below remain excluded. Existing selector/condition/layer boundaries are unchanged. These are reference exclusions, not product deferrals.
- Module-local `assetReferences` require nonempty fields, a discovered CSS-decoded URL and one exact opaque identity per URL. Identical duplicate bindings are allowed; conflicting/unknown/empty bindings fail. All Modules, syntax/config and bindings validate before the first host callback. Only bound URLs invoke the port, once per used exact identity per compilation, including aliases across Modules. Empty bindings/unbound URLs require no resolver and retain authored spelling. URL-looking ordinary content strings/comments are untouched.
- Missing resolver, empty/non-string output or a thrown resolver error returns diagnostics only (`reference-asset-resolution-failed`), never partial CSS/ScopeSchema. This reference-only result policy does not change production finalize exceptions. A later callback failure cannot roll back earlier host side effects; no resolver cache persists across invocations. Delivery strings are safely CSS-string escaped, never substituted through authored-text placeholders, and never affect mapping identity.

### Registered conditions and named layers (bounded)

- At most **one nonempty condition kind per invocation**, using existing `config.conditions.media`, `.supports` or `.container` arrays. Empty arrays/unused valid registrations are accepted. Entries must be unique and match the exact grammar below (one literal space after `:`; no escapes/comments or normalization beyond PostCSS's surrounding wrapper whitespace).
- Media: `(min-width: Npx)` or `(max-width: Npx)`, where `N` is `0` or a positive integer without leading zeroes.
- Container: the same width grammar, optionally preceded by a simple name and one space, e.g. `panel (min-width: 200px)`.
- Supports: exactly `(display: block)`, `(display: grid)` or `(display: gss-unsupported)`.
- `config.layers` is a unique ordered list of simple ASCII names (`[A-Za-z_][A-Za-z0-9_-]*`). Layer/container names exclude CSS-wide keywords and `default`/`none`, case-insensitively. Container names additionally exclude `not`, `and`, and `or` case-insensitively; these query operators remain valid layer names.
- Flat registered wrapper blocks are accepted at root, or inside one outer configured `@layer name` block. A global native `@layer early, late;` prelude uses configured order, **not** first authored occurrence. Unlayered rules remain unlayered.
- Whole condition/rule groups are partitioned base-first then in configured condition order **across Modules and layers**. Selectors are never strengthened, declarations are never pruned/reordered, and normal/important declarations are never manually reversed. Native CSS handles specificity, importance, layer reversal and unlayered precedence. Layer blocks may be split to retain their enclosing layer while moving condition groups. Comments/quoted content and declared empty paths/prefixes remain present.

Mixed nonempty condition kinds, compound/nested conditions, nested/dotted/anonymous/unregistered layers, layer-inside-condition, authored layer statements, unregistered wrappers, other queries and unknown condition keys all fail without partial output. This slice deliberately makes **no cross-kind/compound/nested precedence choice**. Compiler warning/fallback behavior is unchanged. This is a reference coverage boundary, not a new production restriction.

Everything else fails explicitly, including lists/selector nesting, hover/focus/other or functional pseudos, attributes outside the grammar above, multi-node states, multiple attributes or attribute/pseudo combinations, other/misplaced/repeated pseudo-elements, ancestor-state + pseudo-element combinations, child/sibling/runtime relations, other at-rules/resources and other properties. Background-image bindings and the bounded root keyframe slice below are supported. Empty registrations and either `atomizationFallback` policy are accepted; no reference fallback/planning occurs. The existing optional second argument `{ resolveAssetUrl? }` renders bound background-image identities as specified below.

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

The page compiles the thirty-eight reference and atomic fixture outputs separately on the Vite host. Eleven additional contextual-boundary fixtures use explicit hand-authored native CSS and mappings, never atomic output, for syntax intentionally outside `compileGssReference` (child relations and `:has()`). The reference API remains fail-closed for that syntax. It renders identical fixture DOM with the corresponding mappings into separate initially same-size iframe documents (640px viewport; matching scripted resize on both sides), each with only its own stylesheet. No React adapter or browser-side compiler is involved. Both sides must match literal expected computed values, not merely each other. Fixtures cover:

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

11. Twelve registered-condition fixtures (media/supports/container × forward/reversed source × forward/reversed config) test configured order, base-vs-condition rank, original descendant specificity, importance, namespacing and reversed Module registration. Media uses actual iframe width; container uses a real named inline-size provider, with identical setup-only CSS in a separate style element. Both traverse **640px/both → 100px/neither → 300px/first only → 640px/restored**. Supports cannot be toggled at runtime: baseline/recheck explicitly records native `CSS.supports` block/grid `true` and gss-unsupported `false`; the unsupported wrapper must never win. No supports entry/exit claim is made.
12. Four native layer fixtures cross source/config reversal, independently asserting normal, important, unlayered normal and unlayered important colors. Two layer+registered-media fixtures verify layer priority stays above condition rank, while condition rank still governs equal-layer important declarations; viewport no-match/restoration is sampled.

Each phase checks every explicitly touched property against literal expectations independently on both sides. Missing phase expectations fail. Native state matches and data-/ARIA attributes are recorded for every node, including ancestors. Ancestor `:checked` is API-tested; it is not claimed as browser fixture coverage.

Wait until `window.__GSS_REFERENCE_RESULT__.status !== 'running'` (also JSON text in `#result`). Acceptance requires:

```js
const r = window.__GSS_REFERENCE_RESULT__;
r.status === 'passed' &&
r.results.length === 49 &&
r.results.reduce((sum, f) => sum + f.comparisons, 0) === 875 &&
r.results.every(f => f.comparisons > 0 && f.differences.length === 0 && f.expectedFailures.length === 0) &&
r.negativeControl.detected === true &&
r.pseudoNegativeControl.detected === true &&
r.pseudoNegativeControl.controlsUnchanged === true &&
r.conditionNegativeControl.detected === true &&
r.layerNegativeControl.detected === true &&
r.assetNegativeControl.detected === true &&
r.assetNegativeControl.controlsUnchanged === true &&
r.keyframesNegativeControl.detected === true &&
r.keyframesNegativeControl.controlsUnchanged === true &&
r.keyframesNegativeControl.definitionRemoved === true
```

Each difference reports phase, actual native pseudo/attribute state plus iframe viewport width, matchMedia/CSS.supports results and container provider width, Module id, scope path, node, sampled subject (`element`, `::before`, `::after`), property, reference value and atomic value; each fixture also exposes its phase list and complete readings. The negative control intentionally overrides atomic `#forward` with `margin-left: 123px !important`; it must detect reference `9px` versus atomic `123px`. A second control overrides only atomic `#pseudo-a::before` color with `rgb(1, 2, 3) !important`; exactly one before-color difference from literal red must be detected, with every originating-element/after/other-Module reading unchanged. Page success requires all six controls. The registered-media control appends a matching-only important override: exactly baseline/restored `padding-left: 7px` versus `123px` must differ, with nonmatching phases/control readings unchanged. The layer control reverses only the atomic prelude: normal blue → red and both important cases red → blue must differ, while unlayered normal stays green. If either compilation or frame loading fails, the page fails rather than reporting an empty comparison as success (host compilation errors also appear in Vite's overlay).

**Previous bounded native browser gate passed.** Parent `agent_browser` ran all twenty-five fixtures (fourteen compiled-reference fixtures plus eleven hand-authored contextual goldens): **575 computed-value comparisons**, no differences or expected failures. The unchanged original ancestor attribute fixture now reads `margin-left: 1px → 9px → 1px → 1px` on both sides. The checkbox margin probe reads `1px` on both sides across all five phases; the abandoned padding probe is not used to assert native checkbox rendering. The corruption control remains effective (`9px` versus `123px`).

The pseudo slice exposed a public-session regression: `.icon::before` / `.icon:disabled::after` were absent from a declared `.outer .icon .leaf` structural prefix. The bounded restoration includes declared target paths/prefixes in the same layer/condition. Multi-class candidates require a proven descendant ownership prefix; standalone terminal classes can match runtime-derived targets, but sibling path names cannot invent ancestry. Pseudo planning retains winning declaration provenance and authored specificity with target/priority-qualified atoms, and validates accumulated candidates separately per pseudo subject before either commit or preserved fallback. Only a closed bound-predicate set uses authored order (ADR-0027); incomparable coactive ties reject transactionally unless an explicit intersection dominates by importance/specificity. Wrong-order, unrelated and sibling-derived negatives are API-tested.

The production descendant-condition repair binds each target to proven source-prefix embeddings (including negative repeated-name cases), preserves original base/current/ancestor specificity, and resolves declaration effects only inside closed bound-predicate candidate sets. Incomparable equal-priority coactive conflicts fail closed, not by marker name/order. Tests also exercise transactional replacement, registration order, project relocation, layers and registered conditions through the public Compiler seam. At the contextual boundary, source and `:has()` subject markers repeat only the authored path classes they represent; observed arguments keep native specificity. Runtime-edge refinement order breaks ties but does not alter browser specificity or importance. Marker placement/matching is unchanged. No public testing API or accepted GSS semantics changed.

This is **not** the complete state/condition/resource oracle, browser CI, or Pilot. The reference remains deliberately bounded and is not a substitute for production ambiguity validation.

Fast API checks: `corepack pnpm --filter @gss-l/testing test`. Browser files are typechecked but are not automatically browser-executed by `pnpm verify`.

The original 21-fixture / 395-comparison run did not expose two review counterexamples: expanded pseudo targets lost authored specificity, and cross-path equal-precedence coactive states bypassed validation. Both now have public-session red/green regressions, including last-known-good retention, reversed order, invalid intersections and independent subjects. The expanded 25-fixture / 575-comparison parent native run passed with zero differences/literal failures and both negative controls effective. Coactive checked/disabled pseudo ambiguity is compiler/API coverage, not a painted checkbox pseudo-box assertion. Full oracle coverage, browser CI and Pilot remain incomplete.

## Registered-condition/layer acceptance

Parent native `agent_browser` opened the owned strict-port server and read the actual `window.__GSS_REFERENCE_RESULT__`: **status passed, 43 fixtures / 803 computed-value comparisons**, with no differences or literal expected failures. This retains all previous **25 / 575** and adds **18 / 228** (32 compiled-reference fixtures plus 11 handwritten contextual goldens overall). All four corruption controls were detected, including `pseudoNegativeControl.controlsUnchanged === true`. The condition control reports `7px` versus `123px` only at baseline/restored-both with both media queries actually matching. Layer-prelude reversal reports normal blue → red and important/unlayered-important red → blue. Existing element `9px` versus `123px` and pseudo red versus `rgb(1, 2, 3)` controls remain intact.

Focused public reference tests passed (134); workspace `corepack pnpm verify` passed (439 tests, lint/build/typecheck). No Compiler code or public API changed in this slice. Native evidence is bounded manual acceptance, not browser CI, full condition/resource/React oracle coverage or Pilot. Unnamed/max-width container syntax is API-covered; the native container corpus uses named min-width queries. Existing checked+pseudo API-only boundaries remain unchanged.

Review follow-up: the initial 43/803 native corpus missed container-query operators being accepted as names. Public red/green regressions now reject `not`/`and`/`or` and mixed-case variants, both used and unused registrations, with diagnostics only; a positive regression keeps those identifiers valid as layer names. This narrows the implementation to its existing documented grammar, not a new product rule. Parent freshly opened the rebuilt server after the fix: native acceptance again passed **43 fixtures / 803 comparisons**, zero differences/literal failures, all four corruption controls detected and pseudo controls unchanged. No fixture expectations or Compiler code changed.

## Asset reference acceptance

Parent native `agent_browser` freshly opened the owned strict-port page and observed **passed: 46 fixtures / 819 comparisons**, zero differences/literal failures. The original **43 / 803** and all four controls are retained; three compiled-reference fixtures add **16** comparisons (eight native URL readings and eight fetched/decoded-dimension readings). All five controls are effective, with pseudo and asset controls unchanged outside their intended subjects.

The two Module-isolation fixtures bind the same CSS-decoded authored URL to distinct opaque identities, then change only delivery URLs; host assertions compare mappings across deliveries independently on each side. Literal URLs preserve query/fragment, including `%23`, and a CSS hex escape is bound without URI decoding. A third fixture combines an outer named layer, registered media and real button disabled `::before`, sampling wide → disabled → no-match/disabled → restored URLs. Each side separately matches literal URL expectations and literal natural dimensions. The exact-route host serves deterministic owned SVG bytes; unknown resource routes return 404, with no external network or filesystem widening.

The asset-specific control supplies a *successfully decoded wrong Asset*: only atomic `asset-a` changes URL and natural dimensions **3x2 → 11x7**, while `asset-b` remains unchanged. A successful HTTP request/computed URL alone cannot pass this control. `background-image:decoded-dimensions` records decoding of the actual computed URL's bytes via native Image; it does **not** assert background painting, screenshot pixels or platform rendering. Existing element, pseudo, condition and layer controls still pass unchanged.

Public reference API tests passed **226** (134 existing + 92 Asset cases); full workspace verification passed **531 tests**, lint/build/typecheck. No Compiler/Vite production code, public API, condition ordering or resource lifecycle changed. Full oracle/resource/React coverage, browser CI and Pilot remain incomplete.

Review follow-up: the initial passing 46/819 corpus missed two value-trivia boundaries. Leading declaration-value comments hidden by PostCSS in `raws.between` now fail with diagnostics only and zero resolver calls across all Modules; standalone comment nodes and quoted URL comment text stay valid. Ordinary outer declaration CSS whitespace now accepts both `url(a) ;` and `none ;` without trimming URL contents or accepting non-CSS whitespace. Twenty new public regressions cover all five CSS whitespace characters, both forms, bound/unbound preservation, quoted content and leading-comment negatives. Full verification passed 531 tests (226 reference); original fixture expectations and all five controls are unchanged.

Parent freshly reopened the rebuilt strict4178 server after both fixes: native acceptance again passed **46 fixtures / 819 comparisons**, zero differences/literal failures, all five controls detected, and both pseudo/asset controls unchanged. No fixture expectations or production code changed.

## Module-local keyframes and static animation reference slice

The public `compileGssReference` API/result/ports are unchanged. Definitions are **root-only** `@keyframes name { ... }`. Names are case-sensitive unquoted `[A-Za-z_][A-Za-z0-9_-]*`, excluding CSS-wide keywords, `default` and `none` case-insensitively. Unique definitions (including empty definitions and resource-only Modules) are retained independently of use. Duplicate names, even identical definitions, fail. Names use an independent reversible `gss_ref_keyframes_<logical-Module>__<authored-symbol>` namespace, separate from reference classes. Definitions are collected before references, so forward references work; undefined names retain external CSS semantics. Frame selectors never enter ScopeSchema; empty ordinary paths/prefixes remain mapped.

Exact frame grammar: lowercase `from` / `to` or one percentage from 0 through 100. Numbers match `(0|[1-9][0-9]*)(\.[0-9]+)?` (no leading zeros, exponent or leading-dot decimal). Duplicate numeric offsets, including `from`/`0%` and `to`/`100%`, fail. Empty frames are valid. Frame declarations are only nonnegative number `px` width/height, or color/background-color with `red`, `blue`, `green`, `black`, `white` (units/colors case-insensitive). Frame declaration order/grouping stays authored. Duplicate properties, frame `!important`, selector lists, other frame properties, functions/URLs, nesting and comment/escape tokens inside selector/name/value syntax fail; standalone comment nodes remain untouched.

Ordinary ownership rules add these **single-value** longhands (CSS outer whitespace allowed; units/keywords case-insensitive):

- `animation-name`: one symbol as above, or `none`.
- `animation-duration`: nonnegative number `s` / `ms`; `animation-delay`: the same with optional `+` / `-` sign.
- `animation-iteration-count`: nonnegative number or `infinite`.
- `animation-play-state`: `paused` / `running`.
- `animation-timing-function`: `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, `step-start`, `step-end`.
- `animation-direction`: `normal`, `reverse`, `alternate`, `alternate-reverse`.
- `animation-fill-mode`: `none`, `forwards`, `backwards`, `both`.

Ordinary importance/duplicate-property policy is unchanged. Lists, shorthand, quoted names, CSS-wide values, escapes, `var(...)` and other functions or value comments fail explicitly, including comments hidden in PostCSS raws. Quoted ordinary content and standalone comments are not rewritten. Root definitions may be referenced from the already supported registered condition/layer wrappers (**API coverage only**); condition/layer-scoped definitions, vendor definitions and resource combinations inside frames (including Assets) remain excluded. ADR-0024 production support for lists, shorthand, opaque `var(...)` and condition-scoped definitions is unchanged: these are reference coverage boundaries, not product deferrals. Existing background-image bindings and all-input validation before any resolver callback remain intact. No Compiler implementation is imported at runtime or copied.

Browser fixtures add paused, deterministic static metadata only: cross-Module equal symbols with different frames, forward references, reversed Module registration, and percentage offsets. Each side renders identical isolated DOM. A fixture-authored nonanimated probe scope supplies that side's generated name only as transport alignment; it is never a frame/timing expectation. Distinct Module probes must have distinct non-`none` names. Each target requires exactly one actual CSSAnimation, matching computed/probe/animation names and actual KeyframeEffect.target; successful association is normalized to the literal Module/authored-symbol label. Native `Animation.ready` and frame readiness precede readings, with no wall-clock progress sampling. Computed duration/delay/iterations/play-state, actual effect timing, frame count/offsets and exact frame properties independently match literal fixture data. Missing animation/association fails rather than being skipped.

The sixth control locates exactly the A probe's root CSSOM keyframe definition and verifies its removal. It must detect count `1 → 0` and four other missing/mismatched A metadata readings, while A computed declaration metadata, B's animation/frames and unrelated color remain unchanged. Arbitrary exceptions cannot count as detected corruption. This checks resource delivery/association, **not painted pixels**. Existing 46 fixtures / 819 literal comparisons and all five controls remain unchanged. Full oracle/resource/React corpus, browser CI and Pilot remain incomplete.

Public red/green evidence: initial forward-reference failure, plus three PostCSS name/frame-trivia failures before their fixes; **91 new tests / 317 reference tests / 622 workspace tests**, lint/build/typecheck and `git diff --check` pass. The earlier unsupported resource-only width test is now a positive keyframe regression; its unsupported transform counterpart remains negative. No production code or testing public API changed. Parent freshly reopened the owned strict-port page with native `agent_browser`: **passed, 49 fixtures / 875 comparisons**, zero differences/literal failures, all six controls detected; pseudo/asset/keyframes controls unchanged and keyframes definition removal verified. Original 46 / 819 expectations and five controls are retained. Build/typecheck alone is not browser evidence.

Native red/repair evidence: the first expanded run (49 / 870) had four literal `motion-b` timing failures across both sides of the forward/reversed fixtures, with zero atomic/reference differences and all six controls effective. Parent inspected the actual browser: computed animation-timing-function was `ease-in`, effect-level `getTiming().easing` was `linear`, and both keyframe easings were `ease-in`. The harness had conflated CSS per-keyframe easing with effect-level easing. It now retains an independent effect-level `linear` literal and explicitly asserts every frame easing plus computed animation-timing-function (five additional readings, total 875). This is a harness correction, not evidence of a Compiler defect; no expected easing check was removed.

Review follow-up: the passing 49/875 corpus did not cover malformed property/colon punctuation or comments hidden in `raws.important`. Public red/green reproductions showed both frame `width !: 1px` and ordinary `animation-name !: pulse`, plus `!/**/important` and `!important/**/`, wrongly succeeded and invoked an earlier Module's Asset resolver. The reference-only fix validates the complete separator as CSS whitespace, one colon, CSS whitespace, and rejects comment-bearing importance trivia before callbacks. Nine new public regressions assert diagnostics-only/zero-callback failures and preserve all five CSS whitespace characters with mixed-case ordinary `!important`; frame importance remains prohibited. Verification passed **326 reference tests (100 keyframe) / 631 workspace tests**, lint/build/typecheck and diff check. No production/API/harness/fixture/expectation changes. Parent freshly reopened the final rebuilt owned strict4178 page after both fixes and read the actual native result: **passed, 49 fixtures / 875 comparisons**, zero differences/literal failures, all six controls detected; pseudo/asset/keyframes controls unchanged and keyframes definition removal verified. Original 46/819 expectations and five controls remain unchanged. This is bounded final-build native evidence, not full oracle/browser CI/Pilot completion.

## Bounded structural relation contextual goldens

[Structural relation fixtures](browser/structural-relation-fixtures.ts) are **hand-authored contextual goldens**, not an extension of `compileGssReference`. ADR-0013 specifies narrower-relation precedence even when authored first; simply rendering authored CSS order would therefore be an invalid oracle. Each golden instead independently encodes the specified winner and literal computed colors/margins. No production planner supplies expectations or reference CSS.

Twenty fixtures add adjacent versus general siblings in forward/reverse order, adjacent/nonadjacent targets, native checked and equality-attribute entry/exit/restoration, earlier-only repeated source witnesses, predicate refinements, specificity/importance controls, an aligned longer mixed suffix, and four observed/structural native priority controls. Literal repeated classes in the observed controls preserve the accepted ownership-prefix specificity without inventing DOM ancestors. Invalid coactive pairs and LKG are public Compiler-session tests, not browser fixtures that silently skip compilation failures.

Parent native red before production edits passed the original 49 fixtures but failed all six initial relation fixtures: adjacent atomic blue disagreed with independent red (ten differences/literal failures, zero reference literal failures). Latest `corepack pnpm verify` passes **822 tests** (353 Compiler, 326 reference, 23 React, 120 Vite), lint/build/typecheck. Before review corrections, the parent restarted/opened the rebuilt owned strict `http://127.0.0.1:4178/` harness via native `agent_browser` and read **passed: 64 fixtures / 953 comparisons**, zero differences/literal failures and all **seven** controls detected. Original **49 fixtures / 875 comparisons / six controls** are unchanged.

The seventh control requires clean atomic/reference agreement first, then uses CSSOM to move only the general-sibling blue color rule after the adjacent red rule. It throws if the rule was already last. Exactly one reading must change: adjacent red → blue; the distant sibling remains blue. `relationNegativeControl` records `detected`, `ruleReordered`, `controlsUnchanged` and actual differences. Original element, pseudo, condition, layer, Asset and keyframe probes remain intact; pseudo/Asset/keyframe controls report unchanged unrelated readings and keyframe definition removal is verified.

Reproduce after `corepack pnpm build` with `corepack pnpm --filter @gss-l/testing browser:reference` (strict port 4178); the parent owns native browser execution. This bounded check does not establish general observed/functional implication, the complete reference oracle, browser CI or Pilot acceptance.

Review follow-up adds three shared-margin goldens (A→B, B→A, single-Module) with checked `margin-left: 1px` and restored `2px` literals, plus two forward/reverse equal-specificity adjacent intersections with checked red, both green, disabled blue and restored black. These are handwritten expectations, not reference-compiler coverage. Existing fifteen goldens, 49 original fixtures and seven controls are unchanged. Fresh parent native `agent_browser` acceptance after the final build passed **69 fixtures / 972 comparisons**, zero differences/literal failures and all seven controls detected. Parent inspected the five new records: all margin and intersection phase literals pass. Relation rule reordering and unchanged unrelated readings are verified; pseudo/Asset/keyframe controls remain isolated and keyframe definition removal remains effective. No output-affecting edits followed this gate.
