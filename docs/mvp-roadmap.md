# GSS-l MVP roadmap

> Accepted MVP semantics remain the contract, not a claim of complete implementation. This status reconciliation is based on code and test assertions at `7e9b81a` (`feat/compiler-language-mvp`). The exploratory recipe prototype is a historical baseline, not the current implementation.

## Reading status and counts

The counting unit is an **original roadmap checkbox**, not a test, fixture, scope path, acceptance check or future implementation round. All **108** original checkbox labels are retained. Reconciliation changes **82 checked / 26 open → 87 checked / 21 open**: only pure ownership planning and the four Compiler session lifecycle labels become checked. Open labels comprise **18 partial** and **3 not implemented**. No percentage of MVP readiness follows from these counts.

- **Checked:** evidence satisfies the bounded label. Stage 0 records decisions; Stage 1 includes policy/history; Stage 8 includes historical manual gates. These are not 87 interchangeable implementation features.
- **Partial:** some of the original label works, but the remaining contract or acceptance coverage is unfinished; keep it unchecked.
- **Not implemented:** the requested feature has no implementation in the inspected seam (even if adjacent foundations exist); keep it unchecked.
- **Implemented, acceptance incomplete/unverified:** implementation evidence exists, but a stage-wide gate has not been established. This is a separate acceptance axis, not additional unchecked units. Stage 9 has no original checkbox and is tracked separately.

| Stage | Checked | Open: partial | Open: not implemented | Stage acceptance status |
| --- | ---: | ---: | ---: | --- |
| 0 — Decisions | 11 | 0 | 0 | Recorded semantics, not implementation proof |
| 1 — Baseline | 5 | 0 | 0 | Workspace established; historical process assertions not re-audited |
| 2 — Domain/parser | 2 | 5 | 0 | Partial; full capability/IR/diagnostic gate open |
| 3 — Cascade | 7 | 4 | 0 | Partial; full effects/specificity/implication gate open |
| 4 — Planning | 14 | 2 | 3 | Partial; accepted selector and compatibility work remains |
| 5 — Session/output | 7 | 2 | 0 | Lifecycle implemented; full output/determinism gate open |
| 6 — React | 12 | 2 | 0 | Local lowering implemented; cross-file acceptance incomplete |
| 7 — Vite | 12 | 0 | 0 | Listed implementation delivered; stage-wide acceptance incomplete |
| 8 — Oracle | 17 | 3 | 0 | Bounded manual gate only; full corpus and browser CI incomplete |
| **Checkbox totals** | **87** | **18** | **3** | **108 original labels** |

Stage 9 remains an uncompleted **20–50 actual style-Module Pilot plus its six gates**, not another checkbox total. Stage-local evidence below uses original item positions (for example, S4.1 is Stage 4's first checkbox) to keep completed and remaining portions traceable without splitting/inflating units.

**Evidence levels:** inspected code/assertions are linked below; prior `631` workspace tests and the native **49 fixtures / 875 comparisons / six effective controls** are recorded historical baseline evidence in [testing README](../packages/testing/README.md), not a fresh browser run by this reconciliation. Local `verify` runs fast tests/build/lint/typecheck, not the native browser corpus. Historical Vite browser smoke checks in [semantic safety §18](semantic-safety-evaluation.md#18-implementation-status) are separate from both the independent oracle and full host/Pilot acceptance.

## Stage 0 — Product semantics and architecture

- [x] Keep authored `.gss` CSS-native rather than recipe/object DSL.
- [x] Define React style-scope references and `.self` lowering.
- [x] Define ownership target paths and path accumulation.
- [x] Define pure atoms, contextual atoms, and relation markers.
- [x] Define selector, pseudo, condition, layer, declaration, and resource semantics.
- [x] Define fail-closed safety policy.
- [x] Define property-effect and cascade precedence.
- [x] Define single central CSS asset and snapshot HMR.
- [x] Define readable first-version naming behind `NameAllocator`.
- [x] Define reference CSS and browser oracle testing seam.
- [x] Record deferred capabilities and non-goals.

Completion evidence:

- [`language-design.md`](language-design.md)
- [`compiler-interface.md`](compiler-interface.md)
- [`mvp-capabilities.md`](mvp-capabilities.md)
- [`deferred-capabilities.md`](deferred-capabilities.md)
- [`adr/`](adr/)

## Stage 1 — Establish the new implementation baseline

- [x] Treat the sibling legacy GSS project as read-only reference material.
- [x] Discard the uncommitted recipe-oriented prototype created during early exploration in this repository.
- [x] Create the initial Compiler workspace boundary from the accepted Domain/Application/Adapter architecture.
- [x] Copy legacy utilities or tests into this repository only when they express an accepted invariant, adapting them to the new interfaces.
- [x] Establish install, typecheck, lint, test, and build commands for the new workspace.

Status evidence: [workspace commands](../package.json), [Compiler layers](../packages/compiler/src/), [React Adapter](../packages/react/src/index.ts) and [Vite Adapter](../packages/vite/src/index.ts) establish the present boundary. Source inspection finds no active recipe DSL. The read-only legacy rule and selective-copy rule are policies; this reconciliation does not independently reconstruct prototype deletion/copy provenance or sibling history. Historical passing verification is not a newly performed install.

Completion criteria:

- no file in the sibling legacy project is modified;
- repository search finds no active recipe/variant/slot language contract;
- workspace install, typecheck, lint, tests, and build pass;
- `git status` contains no unexplained exploratory files.

## Stage 2 — Domain model and syntax normalization

Use test-first vertical slices.

- [ ] Define value objects for logical Module id, selector path, declaration, condition, layer, relation, specificity, semantic identity, and diagnostics.
- [ ] Implement standard CSS parsing behind `CssParserPort`.
- [x] Normalize selector lists into independent semantic branches.
- [x] Normalize standard CSS nesting before selector-path analysis.
- [ ] Build `ScopeTree` and positive capability validation.
- [ ] Parse attributes, pseudo states, functional pseudo conditions, pseudo-elements, combinators, residual selectors, and explicit globals in the accepted set.
- [ ] Return stable diagnostics for unsupported or unsafe input.

### Reconciled evidence and remaining acceptance

| Original item | Status and existing evidence | Remaining gate for that same item |
| --- | --- | --- |
| S2.1 — Value objects/domain model | **Partial; first bounded slice implemented.** [Domain-owned IR/source spans](../packages/compiler/src/domain/parsed-stylesheet.ts), [logical Module identity](../packages/compiler/src/application/module-identity.ts), [naming identities](../packages/compiler/src/domain/readable-name.ts) and [public schema/diagnostics](../packages/compiler/src/public-types.ts) exist. [Parser tracers](../packages/compiler/test/postcss-stylesheet-parser.test.ts) pin CRLF/Unicode offsets, nesting/list origins and repeat/relocation-stable normalized IR. | Complete framework-independent invariants for all named concepts; paths/layers/specificity still use arrays/strings/numbers. Current internal spans cover declaration/rule/resource/frame nodes; bounded public diagnostic projections now exist, but exact normalized selector tokens and CSS mappings remain open. Classes or branding alone are not the gate. |
| S2.2 — CSS parsing behind port | **Partial; internal seam implemented.** [CssParserPort](../packages/compiler/src/application/css-parser-port.ts) is required by the session; [default composition](../packages/compiler/src/compiler.ts) supplies [PostCSS/nesting](../packages/compiler/src/infrastructure/postcss-stylesheet-parser.ts) outside the use case. [Port tests](../packages/compiler/test/css-parser-port.test.ts) exercise actual replace/finalize, diagnostic rollback and thrown adapter errors. | Complete acceptance across the accepted syntax/resource matrix and broader port/error target; this bounded internal seam is not a public `GssCompilerPorts` constructor or the full S2 gate. |
| S2.5 — ScopeTree/positive validation | **Partial.** [Scope construction](../packages/compiler/src/application/compiler-session.ts#L1032) and pre-commit capability checks work; [nested-scope tests](../packages/compiler/test/compiler-session.test.ts#L1771) and [ambiguity rollback tests](../packages/compiler/test/descendant-conditions.test.ts#L198) cover bounded behavior. | Positive/negative whole-Module fixtures for every accepted capability, including remaining residual/global/interleaved combinations; no partial contribution after any invalid branch. |
| S2.6 — Full accepted selector parsing | **Partial.** [Selector parser](../packages/compiler/src/infrastructure/postcss-stylesheet-parser.ts) and [session assertions](../packages/compiler/test/compiler-session.test.ts#L1168) cover local paths, equality attributes, states, simple functional branches, pseudos and simple observations. | General residual and explicit-global syntax, interleaving and accepted mixed compositions. Functional arguments currently have one pseudo/attribute per branch; observed branches have one node, optionally one local state. Implement normalization and safety validation together, not acceptance by emission alone. |
| S2.7 — Stable diagnostics | **Partial; bounded public ranges implemented.** Optional [GssSourceRange](../packages/compiler/src/public-types.ts) and [public range tracers](../packages/compiler/test/diagnostic-ranges.test.ts) cover original caller UTF-16/BOM/CRLF/astral syntax positions, enclosing authored selector rules and repeated duplicate declarations. [Parser-boundary regressions](../packages/compiler/test/parser-boundary.test.ts) retain code/id/order, path-clean syntax messages and LKG. [ADR-0051](adr/0051-expose-bounded-original-css-diagnostic-ranges.md) specifies parser-reported zero-width points and honest omission. | Remaining diagnostic-site/source-path attribution, deterministic range/code/path sorting and matrix-wide diagnostics/rollback. Unreliable/map-helper origins and config/resource/registry/multi-origin sites remain unranged; id intentionally stays caller-supplied (possibly physical). CSS maps and IDE integration remain open; native Vite consumption is the bounded Adapter follow-up below, not full S2 diagnostics acceptance. |

The checked list/nesting labels remain bounded normalization work, not proof of every accepted nesting/composition form. Mixed valid/invalid selector-list rollback is now covered through the public session. The first internal parser/provenance slice does not change the 108 original labels or 87 checked / 21 open totals; full S2 matrix/value/diagnostic acceptance remains open.

Bounded slice validation: `corepack pnpm verify` passes **648 workspace tests** (218 Compiler, including 17 new parser/port/public regressions; 326 independent reference; 23 React; 81 Vite), lint/build/typecheck and diff checks. Complete public result/snapshot goldens captured from baseline `6864013` remain equal after rebuilding. Parent freshly opened the rebuilt strict4178 harness with native `agent_browser`, took a snapshot and read the actual result: **passed, 49 fixtures / 875 comparisons**, no differences or literal failures, all six controls detected; pseudo/Asset/keyframe controls unchanged and keyframe definition removal verified. Reference implementation, browser fixtures and literal expectations are unchanged. This does not establish matrix-wide S2 or full oracle/Pilot acceptance.

Initial review follow-up corrected leading U+FEFF/U+FFFE caller offsets and inline map decode/schema failures with 28 tests (**676 workspace tests**, 246 Compiler); parent native acceptance then passed **49 fixtures / 875 comparisons**, no differences/literal failures, all six controls detected, pseudo/Asset/keyframe controls unchanged and keyframe definition removal verified. Further review exposed lazy mappings: consumer construction alone does not validate `?`/`AA`, and an error lookup escaped. The Adapter now guards only the current inline-map consumer's `originalPositionFor`, using normal public Input construction and PostCSS's exported Parser for nonempty inline maps ([dependency boundary](architecture.md#diagnostics)). [Source-map regressions](../packages/compiler/test/source-map-annotations.test.ts) add 19 tests for malformed CSS/selector diagnostics, LKG/schema/generation and Asset discovery, valid CSS with the same lazy malformed maps, `A` controls, per-instance isolation and unexpected parser failures. Baseline 6864013 accepted the valid-CSS controls and diagnosed unclosed CSS; malformed selectors already threw at that baseline and are not claimed as a historical success. All 13 schema/encoding/precedence compatibility rows remain unchanged; BOM spans and output goldens still pass. **695 workspace tests** pass (265 Compiler), plus lint/build/typecheck. There is no new dependency, public source-map capability or reference/oracle change, no eager mapping validation and no global patch. Parent freshly reopened the rebuilt strict4178 page after the lazy-lookup repair, took a native snapshot and read the actual result: **passed, 49 fixtures / 875 comparisons**, zero differences/literal failures, all six controls detected; pseudo/Asset/keyframe controls unchanged and keyframe definition removal verified. No output-affecting edits followed this gate.

Bounded public range follow-up: [ADR-0051](adr/0051-expose-bounded-original-css-diagnostic-ranges.md) adds only optional `GssSourceRange` to Compiler diagnostics, reusing the existing IR. Supported sites are CSS/selector syntax `GSS1001`, unsupported-selector `GSS1101` and repeated-declaration `GSS1204`; other sites omit ranges. Input coordinates never follow upstream maps. No public constructor/port/source-adapter/path/sorting changes, CSS maps, reference coupling or full-S2 completion claim. The **108 original labels / 87 checked / 21 open** units remain unchanged. Public red/green and the unchanged malformed-selector/inline-map/exception matrix guard no partial commits and LKG. `corepack pnpm verify` passes **735 workspace tests** (305 Compiler, 326 independent reference, 23 React, 81 Vite), lint/build/typecheck; diff and local documentation link checks pass. Parent freshly reopened the verified strict4178 page with native `agent_browser`, took a snapshot and read the actual result: **passed, 49 fixtures / 875 comparisons**, no differences/literal failures, all six controls detected; pseudo/Asset/keyframe controls unchanged and keyframe definition removal verified. Independent reference/harness fixtures and expectations remain unchanged. This bounded gate does not close full S2 acceptance.

Completion criteria:

- table tests cover every entry in `mvp-capabilities.md`;
- unsupported fixtures fail closed without partial Module contribution;
- normalized IR snapshots are byte-stable and contain no React types.

### Bounded Vite diagnostic consumption follow-up

The [Adapter presenter](../packages/vite/src/diagnostics.ts) now formats optional Compiler ranges into native physical-file `loc`/`frame` from exact replacement/census snapshots, not later reads or active JSX source maps. [21 public host regressions](../packages/vite/test/diagnostic-location.test.ts) cover cold transform/load, actual build/watch errors, native watcher duplicate/syntax payloads, LKG and recovery, snapshot races and census warnings; [18 private defensive tests](../packages/vite/test/diagnostics.test.ts) pin unreliable/EOF/UTF-16/frame constraints. Verification passes **774 workspace tests** (305 Compiler, 326 independent reference, 23 React, 120 Vite), lint/build/typecheck and diff checks. Existing tests and **49 fixtures / 875 comparisons / six oracle controls** are unchanged, not rerun or enlarged by this host slice.

Native acceptance exposed an existing same-schema recovery reload through a non-accepting JS importer, independently reproduced with `5aca280` in an isolated archive. The approved bounded repair retains graph invalidation for current-failure safety but propagates only native CSS after the latest successful unchanged-ScopeSchema replacement; changed schema/deletion still propagate to JS. Parent native checks establish physical-file overlay/code/frame, retained LKG, same-source overlay clearance without boot/DOM replacement, one central link and no appended styles, with changed-schema propagation as a positive control. This is bounded host acceptance, not full lifecycle/SSR/hydration/Pilot acceptance. Remaining attribution sites, semantic paths/sorting, IDE integration and Compiler CSS maps remain open. **108 original labels / 87 checked / 21 open** are unchanged.

## Stage 3 — Declaration and cascade resolution

- [x] Establish the data-driven `PropertyEffectRegistry` seam with margin/padding effect families.
- [x] Resolve exact-property and registered shorthand/longhand winners per closed target candidate set.
- [x] Version the property-effect registry and expand its first dataset across box, border, background, typography, flex/grid layout, transition, animation, and mask families.
- [ ] Complete shorthand classification for the full positive property set; unclassified effects must not enter atomic output and must be classified as unknown rather than singleton longhands.
- [x] Detect registered logical/physical property conflicts, including conflicts introduced by ownership target accumulation.
- [ ] Implement importance and authored cascade layer semantics.
- [ ] Implement selector specificity, including `:where()` zero specificity.
- [x] Implement registered at-rule condition rank for deterministic rule planning.
- [x] Reject equal-precedence coactive current-state conflicts unless an explicit intersection resolves them.
- [ ] Implement full relation implication and remaining incomparable-condition diagnostics.
- [x] Accumulate descendant-class selectors whose paths provably match a declared target and resolve their exact-property winners.

### Reconciled evidence and remaining acceptance

| Original item | Status and existing evidence | Remaining gate for that same item |
| --- | --- | --- |
| S3.4 — Full property-effect classification | **Partial.** [Versioned classifier](../packages/compiler/src/domain/property-effects.ts#L164), [effect tests](../packages/compiler/test/property-effects.test.ts) and [strict/preserved session tests](../packages/compiler/test/compiler-session.test.ts#L416) prove unknowns cannot enter session atomic output. | Audit the full positive dataset and shorthand overlap/reset effects with table coverage. Family presence/sample winners are not completeness proof. Lower-level `effectsOfProperty()` still has a singleton fallback; do not confuse it with `classifyPropertyEffect()`'s explicit unknown result. |
| S3.6 — Importance/layers | **Partial.** [Closed-target resolver](../packages/compiler/src/domain/resolve-target-declarations.ts), [descendant priority tests](../packages/compiler/test/descendant-conditions.test.ts#L183), [layer output tests](../packages/compiler/test/compiler-session.test.ts#L628) and [native layer fixtures](../packages/testing/browser/condition-layer-fixtures.ts) support the implemented normal/important/unlayered slice. | Nested canonical-layer acceptance and cross-context candidates composed with the complete specificity/condition/relation model. Preserve native important-layer reversal; do not rebuild the already present layer emitter. |
| S3.7 — Specificity including where | **Partial.** [Descendant planner](../packages/compiler/src/domain/plan-descendant-conditions.ts) and [where test](../packages/compiler/test/compiler-session.test.ts#L1281) preserve bounded ownership/predicate specificity. | General accepted-selector specificity, including residual/global and functional/observed list maxima, and cross-layer/condition candidate acceptance. Ownership-only groups currently emit single-class atoms; emission snapshots alone do not prove cross-context priority. |
| S3.10 — Full implication/ambiguity | **Partial.** [Predicate planner](../packages/compiler/src/domain/plan-descendant-conditions.ts#L45) and [ambiguity tests](../packages/compiler/test/descendant-conditions.test.ts#L198) handle bounded same-source predicates. | Structural implication/coactivity, conflicting adjacent/general sibling pairs, mixed/observed predicates, intersections/exclusions and transactional fail-closed tests. [Current relation rank](../packages/compiler/src/application/compiler-session.ts#L640) counts edges/state/attribute presence; equal-length `+` and `~` chains have equal rank, not ADR-0013 implication proof. Names must never resolve an unsafe conflict. |

Existing checks for versioned families, closed-target winners, logical/physical conflicts, registered query ranks and bounded state/descendant handling stand at their tested scope. They do not close the full cascade acceptance criteria.

Completion criteria:

- no winner depends on value, emitted name, registry insertion, or worker completion order;
- reversing Module registration order produces identical resolved IR;
- representative results match the browser reference cascade.

## Stage 4 — Rule and resource planning

- [x] Plan ownership declarations as pure atoms.
- [x] Plan direct-child chains and adjacent/general sibling relations as contextual atoms with path-specific markers.
- [x] Lower a leading ownership prefix before a child/sibling runtime-relation suffix.
- [x] Plan the positive current/ancestor pseudo-state set and compose source state with runtime-relation suffixes.
- [x] Plan current, ancestor, and runtime-source attribute/ARIA equality conditions.
- [x] Plan the positive pseudo-element set, including current-state composition.
- [x] Plan `:not()`, `:is()`, and `:where()` conditions with supported pseudo-state and attribute-equality branches.
- [x] Plan local-class and residual tag/attribute/pseudo `:has()` observations, including selector lists and supported combinators.
- [ ] Plan interleaved ownership/runtime chains and explicit-global functional/`:has()` branches.
- [ ] Plan residual and explicit-global selectors.
- [x] Implement custom property provider and global `@property` resource semantics with transactional conflict detection and reference-counted output.
- [x] Implement module-local keyframes, condition/layer-aware resource output, and static `animation-name`/`animation` reference rewriting.
- [x] Implement global `@font-face` resources, face-signature conflict detection, reference counting, and URL dependency extraction.
- [x] Plan registered `@media`, `@supports`, and `@container` wrappers across all currently supported pure and contextual atom forms; warn on unregistered queries.
- [x] Plan configured named layers across pure and contextual atoms, emit the global order prelude, and warn on unregistered layer names.
- [ ] Implement full registered condition precedence and remaining cascade-order planning.
- [ ] Keep compatibility declaration sequences indivisible after browserslist transformation.
- [x] Replan unregistered property-effect failures as one whole preserved Module while retaining ScopeSchema, resources, authored order, conditions/layers, and transactional replacement.
- [ ] Extend whole-Module preserved fallback to indivisible compatibility declaration sequences.

### Reconciled evidence and remaining acceptance

| Original item | Status and existing evidence | Remaining gate for that same item |
| --- | --- | --- |
| S4.1 — Pure ownership atoms | **Completed; newly checked.** [Ownership planning](../packages/compiler/src/application/compiler-session.ts#L470) creates pure identities/tokens; [session tests](../packages/compiler/test/compiler-session.test.ts#L20) assert pure output and sharing, with [accumulation/nested targets](../packages/compiler/test/compiler-session.test.ts#L1727). | None for this bounded label; full cascade and source tracing remain separate gates. |
| S4.9 — Interleaved chains/global branches | **Not implemented.** [Session validation](../packages/compiler/src/application/compiler-session.ts#L355) rejects ownership after runtime edges; [functional/observed parser](../packages/compiler/src/infrastructure/postcss-stylesheet-parser.ts) has no global branch. [Prefix test](../packages/compiler/test/compiler-session.test.ts#L1554) proves only a leading ownership prefix. | Implement accepted interleaved marker/scoping and explicit-global functional/observed branches with positive and ambiguity/rollback fixtures. |
| S4.10 — Residual/global planning | **Partial.** Bounded residual observation exists in [has parser](../packages/compiler/src/infrastructure/postcss-stylesheet-parser.ts) and [session tests](../packages/compiler/test/compiler-session.test.ts#L872). | General residual tag/attribute and explicit-global contextual placement/scoping with positive and negative tests; do not treat the bounded observed residual as the entire item. |
| S4.16 — Full condition/cascade order | **Partial.** [Rule order planner](../packages/compiler/src/domain/rule-order-planner.ts) and [registered-query tests](../packages/compiler/test/compiler-session.test.ts#L605) implement per-kind query ranks and wrapper-position comparisons. | Full canonical context/explicit compound registration and warnings, cross-kind/nested ordering and implication-safe conflict checks per [semantic safety §9](semantic-safety-evaluation.md#9-at-rule-conditions) and ADR-0027. Current [config](../packages/compiler/src/public-types.ts#L96) cannot express that full contract. |
| S4.17 — Compatibility sequences | **Not implemented.** [Parsed declarations](../packages/compiler/src/domain/parsed-stylesheet.ts) are single physical declarations; no Compiler transformer/browserslist port/config exists. [Duplicate rejection](../packages/compiler/test/compiler-session.test.ts#L115) is authored-input validation, not lowering. | Accepted transformer/target port, one semantic declaration to indivisible physical sequence, target-dependent transformation and order tests. |
| S4.19 — Compatibility preserved fallback | **Not implemented.** [Fallback reason](../packages/compiler/src/public-types.ts#L21) supports property effects only; [fallback tests](../packages/compiler/test/compiler-session.test.ts#L394) cover that implemented case. | Compatibility-specific recoverable proof/reason, whole tentative atomic-plan discard, transformed sequence/resource/order preservation, strict-mode and transactional replacement tests. Depends on S4.17. |

Checked relation/state/attribute/pseudo/functional/observed labels describe their bounded accepted forms, not arbitrary composition or full implication. Preserve the resource implementation: [resource planning](../packages/compiler/src/application/compiler-session.ts#L774), [font/keyframes/property tests](../packages/compiler/test/compiler-session.test.ts#L189) and [asset cleanup tests](../packages/compiler/test/stylesheet-assets.test.ts#L111). Remaining acceptance probes include native custom-property inheritance, shared-owner removal/replacement per resource, keyword-like animation shorthand names, and multiple condition/layer keyframe definitions. The current shorthand rewrite scans words and resources sort by identity; neither establishes full resource cascade semantics. Likewise, separate `:has()` branch emission does not prove maximum selector-list specificity. These are static coverage/risk findings, not newly reproduced failures.

Completion criteria:

- every planned rule traces to source and semantic identity;
- each CSS rule contains one semantic declaration;
- resource replacement/removal tests leave no stale output.

## Stage 5 — Compiler session and deterministic output

- [x] Implement `createGssCompilerSession()`.
- [x] Implement transactional `replaceStylesheet(id, source)`.
- [x] Implement `invalidate(id)` and reference-count cleanup.
- [x] Implement full-census `finalize()`.
- [x] Implement `RuleOrderPlanner` separately from `CascadeResolver`.
- [ ] Implement reversible readable names behind `NameAllocatorPort`.
- [x] Emit nested static scope objects and branded object-based consumer types through `@gss-l/types`.
- [x] Provide a global wildcard `.gss` declaration without per-Module declaration files.
- [ ] Emit central CSS, source map, manifest, and report, including Module compilation mode, fallback reasons, and atomic coverage.

### Reconciled evidence and remaining acceptance

| Original item | Status and existing evidence | Remaining gate for that same item |
| --- | --- | --- |
| S5.1 — Session factory | **Completed; newly checked.** [Internal factory](../packages/compiler/src/application/compiler-session.ts) owns the contribution map/generation; [public-session test](../packages/compiler/test/compiler-session.test.ts#L20) exercises it. | None for the factory label. Internal parser injection is implemented; the broader public port suite remains a target. |
| S5.2 — Transactional replacement | **Completed; newly checked.** [Prepare-before-commit](../packages/compiler/src/application/compiler-session.ts#L105) and [LKG test](../packages/compiler/test/compiler-session.test.ts#L71), plus resource/ambiguity rollback tests, prove replacement. Actual API is `replaceStylesheet({ id, source, assetReferences? })`. | None for the preparation/commit mechanism; comprehensive diagnostic exception containment remains S2.7. |
| S5.3 — Invalidation/reference cleanup | **Completed; newly checked.** [Invalidation](../packages/compiler/src/application/compiler-session.ts#L144) removes contributions; [finalization](../packages/compiler/src/application/compiler-session.ts#L1070) reconstructs live references rather than mutating counters. [Asset tests](../packages/compiler/test/stylesheet-assets.test.ts#L124) assert last-owner cleanup for atomic/preserved/resource inputs. | None for the mechanism; shared-owner decrement/replacement coverage across every resource remains the stage-wide stale-output gate. |
| S5.4 — Full-census finalization | **Completed; newly checked.** [Finalizer](../packages/compiler/src/application/compiler-session.ts#L1056) enumerates every committed contribution; [multi-Module test](../packages/compiler/test/compiler-session.test.ts#L140) and [history/relocation test](../packages/compiler/test/descendant-conditions.test.ts#L249) verify bounded convergence. | None for the Compiler's committed census. Reachability is the Stage 7 host's responsibility; broad randomized determinism remains below. |
| S5.6 — Reversible allocator port | **Partial.** [Readable helpers](../packages/compiler/src/domain/readable-name.ts) and [naming/relocation tests](../packages/compiler/test/module-identity.test.ts) exist, but session code calls helpers directly. | Accepted `NameAllocatorPort` wiring/strategy contract and canonical identity round-trip/collision proof, including the encoder's NFC normalization boundary. Readability is not reversibility proof. |
| S5.9 — CSS/map/manifest/report | **Partial.** [Snapshot type](../packages/compiler/src/public-types.ts#L61), [finalizer](../packages/compiler/src/application/compiler-session.ts#L1117) and [mode/coverage assertions](../packages/compiler/test/compiler-session.test.ts#L506) prove CSS and current manifest/report; atomic coverage is a Module ratio. | Compiler CSS source maps and source-declaration/range-to-rule tracing; remaining [manifest/report target fields](compiler-interface.md#manifest) (condition/layer/order, dependencies/diagnostics, declaration/size/class costs). React source maps and Vite version-1 envelopes do not supply these fields. |

The separate order planner and branded nested exports/wildcard declarations are implemented, but do not prove all planner inputs safe. Determinism below concerns semantic/artifact output for equivalent live inputs; the session generation counter intentionally records mutation history, not byte-equivalent history. Include randomized registration/replacement/deletion/resource sequences and path hygiene in acceptance rather than inferring them from a single reverse-order test.

Completion criteria:

- failed replacement retains the last committed contribution;
- add/change/delete sequences converge to the same snapshot as a clean build;
- output is byte-identical across randomized Module registration orders;
- no absolute path, timestamp, random value, or iteration-order artifact appears.

## Stage 6 — React style-usage Adapter

- [x] Detect default `.gss` imports in React/TypeScript source through the React Adapter port.
- [x] Expose `react()` through the shared `GssSourceAdapter` port with import discovery followed by synchronous lowering.
- [x] Resolve direct static scope paths against `ScopeSchema`.
- [x] Lower direct references inside JSX `className` to `.self` with source maps.
- [x] Lower nested static GSS references anywhere inside `className` expressions without interpreting `cx(...)` or other non-GSS code.
- [x] Propagate direct immutable local scope aliases and diagnose mutable aliases.
- [x] Propagate all-scope conditional aliases and property-destructured scope aliases; diagnose mixed scope/string branches.
- [x] Lower destructured component props explicitly typed as `typeof styles.<scope>` through a local type alias.
- [x] Extend typed scope props to inline annotations and direct `props.scope` reads.
- [x] Support direct parent-to-child scope passing when the child explicitly imports `typeof styles.<scope>`.
- [ ] Extend typed scope props to multi-hop forwarding, shared type aliases, and constrained cross-file provenance.
- [x] Emit static path and implicit scope-string escape diagnostics with `.self` suggestions.
- [ ] Extend scope-escape diagnostics to all proven typed cross-file contexts.
- [x] Preserve non-GSS expressions and produce high-resolution source maps for direct and nested reference lowering.

### Reconciled evidence and remaining acceptance

[React lowering](../packages/react/src/index.ts) and [transform tests](../packages/react/test/transform-react-gss-usage.test.ts) establish the checked local syntax slices. The parent/child test transforms two files separately; the child explicitly imports its own GSS type. It is not an inter-file provenance resolver or rendered React acceptance.

| Original item | Status and existing evidence | Remaining gate for that same item |
| --- | --- | --- |
| S6.11 — Multi-hop/shared/cross-file props | **Partial.** [Typed-prop collector](../packages/react/src/index.ts#L420) recognizes current-file literal aliases; [typed-prop tests](../packages/react/test/transform-react-gss-usage.test.ts#L153) cover inline/local/direct props. No project type/import graph is supplied to the transform. | Constrained shared/imported alias provenance and multi-hop forwarding with representative positive/negative TypeScript fixture projects and actual React className use. Repeating independently explicit local types is not full cross-file support. |
| S6.13 — All proven typed escapes | **Partial.** [Escape tests](../packages/react/test/transform-react-gss-usage.test.ts#L251) cover direct/local coercion. | Cover all proven typed cross-file escape contexts and explicit `.self` recommendations; prove non-GSS expressions remain unchanged. Depends on S6.11. |

The completion criteria remain open across the full accepted typed-provenance scope. Unrecognized imported/shared typed references can remain untouched; do not claim every unsupported escape is currently diagnosed. The [branded wildcard consumer fixture](../packages/vite/test/consumer/index.ts) proves object/string/readonly typing, not a rendered TSX fixture project with React className typing.

Completion criteria:

- transformed code contains no scope object where React receives a class string;
- arbitrary `cx()` and external class semantics remain untouched;
- unsupported escape fails explicitly rather than producing runtime object coercion;
- TypeScript fixture projects pass with the global `.gss` declaration and branded consumer types.

## Stage 7 — Vite integration, production asset, and HMR

- [x] Implement stable `.gss` virtual JavaScript Modules and the global `@gss-l/vite/client` type entry (no per-file declarations).
- [x] Implement explicit `gss({ adapter })` composition and compile-on-demand before synchronous source transformation.
- [x] Fail virtual load/source transform on hard diagnostics while retaining last-known-good; return preserved fallback JavaScript with warnings.
- [x] Connect dev physical file change/delete/recreate to Compiler replace/invalidate and source/virtual Module cache invalidation.
- [x] Emit one central production CSS asset from the full main/lazy Rollup Module census and inject the shared asset into every emitted HTML entry.
- [x] Emit `gss-manifest.json` and `gss-report.json` version-1 envelopes with output-relative CSS linkage and current Compiler snapshots.
- [x] Rebuild production registry state from current source snapshots, including cached preserved Modules whose JS does not change.
- [x] Implement one dev stylesheet owner per HTML document, base-aware MPA injection, and full ordered snapshot replacement through Vite CSS HMR.
- [x] Implement last-known-good rollback and generation ordering for asynchronous reads, including deletion and late HMR connection synchronization.
- [x] Implement the Compiler discovery/binding/rendering protocol for stable Asset references, transactional validation and late URL resolution.
- [x] Handle production CSS/font URLs through the Vite Adapter: asynchronous preparation, canonical identities, final-census resource emission, relative/public/CDN URL handling and asset watch rebuilds.
- [x] Handle dev CSS/font resource URLs, asset HMR and last-known-good recovery through the Adapter, including identical-byte restoration, source-generation ordering and unchanged file-access policy.

### Implementation evidence versus acceptance

All twelve listed implementation labels remain checked. [Vite hooks](../packages/vite/src/index.ts), [plugin tests](../packages/vite/test/vite-plugin.test.ts), [production CSS tests](../packages/vite/test/production-css.test.ts), [dev CSS tests](../packages/vite/test/dev-css.test.ts), [production assets](../packages/vite/test/production-assets.test.ts) and [dev assets](../packages/vite/test/dev-assets.test.ts) cover the host pipeline. In particular, real watch-build tests update cached preserved CSS, remove contributions and revalidate cached JSX schemas: incremental implementation is not missing.

Stage acceptance is **implemented in substantial slices but incomplete/unverified as a whole**:

- Static virtual JS establishes the no-GSS-runtime slice. Full-census lazy/MPA build behavior has integration tests and historical preview smoke evidence.
- [Semantic safety §18](semantic-safety-evaluation.md#18-implementation-status) records prior native HMR/error recovery, lazy loading and resource smoke checks. Keep those bounded results; they are not a reproducible full lifecycle/React/Pilot gate, nor freshly rerun here.
- SSR/client hydration name **and CSS-asset linkage** acceptance is unverified; deterministic naming alone does not establish it. No SSR render/hydration fixture was found. Apply the criterion below within [ADR-0044](adr/0044-scope-vite-adapter-to-vite-managed-html.md)'s Vite-managed SPA/MPA/Vite-based SSG HTML scope; arbitrary SSR responses and non-Vite framework integration are not newly required. A supported-host SSR/SSG/client-linkage fixture must establish the applicable server/client and hydration claims, not assume generic SSR support.
- Broader clean-versus-incremental artifact/resource convergence and native change/delete/recreate/error/asset recovery, one-current-stylesheet behavior and lazy cascade stability remain acceptance work for the representative host/Pilot corpus.

Completion criteria:

- production contains no GSS runtime;
- SSR and client hydration use the same names and CSS asset;
- lazy route loading cannot change cascade order;
- HMR add/change/delete and compile-error recovery produce the expected final stylesheet.

## Stage 8 — Independent semantic oracle

- [x] Implement the first bounded `@gss-l/testing` `compileGssReference()` slice outside the atomic compiler: plain local classes/descendants, basic color/display/size and physical margin/padding declarations; no partial output and explicit unsupported syntax/config failures.
- [x] Generate reference `ScopeSchema` mappings for identical framework-independent DOM fixtures (per-Module authored class namespace; browser-native accumulation).
- [x] Run the bounded ownership/Module isolation, ADR-0011 descendant, and shorthand/longhand corpus in isolated browser documents; native `agent_browser` acceptance passed with zero differences and a detected atomic-CSS corruption negative control.
- [x] Compare explicitly touched properties and all four physical margin/padding longhands, including order/importance variations and literal expected values in that bounded corpus.
- [x] Implement bounded reference native checked/disabled and single data-/ARIA equality syntax on current/ancestor ownership paths; preserve class-looking comment/attribute text and unchanged public testing API.
- [x] Accept bounded native state/attribute and descendant-cascade phases: parent native browser passed nineteen fixtures / 213 comparisons (eight compiled-reference fixtures plus eleven hand-authored contextual goldens) with literal expectations on both sides and effective corruption control. Original `9px` ancestor regression and checkbox `1px` margin probe pass; repeated-source bindings, forward/reversed specificity, important physical effects and simultaneous conditions are covered. Compiler repair preserves embedding/provenance and resolves only safe closed-predicate winners.
- [x] Add bounded terminal before/after reference syntax and opaque content, retaining the public API and base ScopeSchema paths. Parent native browser passed 21 fixtures / 395 comparisons, preserving the prior 19 / 213; new host/before/after literal readings cover Module isolation, importance, absent content, descendant/subsequence/structural prefixes and native button disabled entry/exit. Page success requires both element and pseudo-only corruption controls. Checked + pseudo is API-only. The red prefix regression was restored with same-layer/condition declared-path ownership proof, not inferred sibling ancestry.
- [x] Repair the two pseudo expansion P1 review regressions: preserve declaration provenance/native specificity on target-qualified atoms; validate accumulated coactivity separately per pseudo subject before commit/fallback, retaining LKG on ambiguity. Public red/green tests cover reverse order, importance, valid/invalid intersections and isolation. Expanded parent native gate passed 25 fixtures / 575 comparisons with four additional button priority cases and both corruption controls; the original 21 / 395 alone did not cover these counterexamples.
- [x] Add bounded registered-condition/named-layer reference coverage using the unchanged public seam: one nonempty kind, flat registered width/supports wrappers, optional outer configured simple-name layer, independent base-first/config-rank group ordering and native layer prelude. Public red/green tests verify wrappers/order/namespacing/empty paths and fail-closed exclusions. Parent native gate passed **43 fixtures / 803 comparisons** (original 25 / 575 retained), zero differences/literal failures, all four corruption controls effective. New fixtures cover source/config/Module registration reversal, actual media/container match/nonmatch/restoration, true/false supports probes, native layer normal/important/unlayered priority and layer+media. No Compiler edits; 134 reference tests / 439 workspace tests and lint/build/typecheck pass.
- [x] Add bounded independent Asset binding/background-image support through the existing resolver port: one `url(...)` or `none`, CSS-only decoding, exact opaque identity and Module-local keys, safe output escaping, per-invocation caching, unbound preservation and diagnostics-only failure before partial output. All inputs validate before host callbacks; no production Compiler/Vite/API changes. Public red/green tests: 226 reference / 531 workspace tests plus lint/build/typecheck.
- [x] Accept native Asset reference gate: parent `agent_browser` passed **46 fixtures / 819 comparisons**, original 43 / 803 and four controls retained, zero differences/literal failures. Three fixtures add literal URLs + decoded natural dimensions for Module isolation across delivery changes and layer/media/disabled-before composition. Exact host-owned SVG bytes, no external network or filesystem widening. Fifth control detects successfully decoded wrong Asset **3x2 → 11x7**, leaving other Module readings unchanged; evidence is fetched/decoded dimensions, not painted pixels.
- [x] Repair review-discovered Asset value-trivia boundaries with 20 public red/green regressions: leading value comments fail before callbacks, outer declaration CSS whitespace accepts URL/none, quoted URL contents and standalone comments remain preserved. Reference-only correction; no fixture/expectation changes. Parent freshly reopened the rebuilt post-fix server: **46 / 819** passed again, zero differences/literal failures, all five controls detected and pseudo/asset controls unchanged.
- [x] Implement bounded independent root-only Module keyframes/static animation longhands via the unchanged testing seam; forward/external names, empty resources/mappings and exact frame/animation grammar fail closed outside ADR-0030 scope. 91 new public tests / 317 reference / 622 workspace tests, lint/build/typecheck passed; PostCSS name/frame trivia has public red/green regressions. No Compiler/API changes.
- [x] Accept expanded paused keyframe native gate: parent freshly reopened native page passed 49 fixtures / 875 comparisons, original 46 / 819 and five controls retained; independent probe-based symbol transport plus literal actual effect association/timing/frames; sixth verified definition-removal control. Zero differences/literal failures, all six controls detected, pseudo/asset/keyframes controls unchanged and definition removal verified. Initial 49 / 870 native red exposed a harness effect-vs-frame easing conflation: independent computed/effect/frame easing literals now all pass; no Compiler change.
- [x] Repair reviewed keyframe fail-closed gaps: validate complete property/colon separator and reject importance-suffix comments before any Asset callback. Nine public red/green regressions cover both reported failures and legitimate CSS whitespace/mixed-case ordinary importance; 326 reference / 631 workspace tests plus lint/build/typecheck pass. No production/API/harness or expectation changes.
- [x] Revalidate the unchanged 49/875 native corpus after separator/importance fixes: parent freshly reopened final-build native page passed, zero differences/literal failures, all six controls detected, pseudo/asset/keyframes controls unchanged and definition removal verified. Full oracle/browser CI/Pilot remain incomplete.
- [ ] Expand reference syntax/config coverage and mappings to the representative React fixture corpus.
- [ ] Cover pseudo-elements, browser states, attributes, relations, media/supports/container, layers, custom properties, keyframes metadata, and resources.
- [x] Report Module/path/node/property, phase/actual native state, and both computed values for the bounded browser harness.
- [ ] Extend difference diagnostics across the full oracle corpus and source ranges.

The bounded reference slices and forty-nine-fixture native browser acceptance are not the complete oracle or Pilot gate. The targeted production descendant-condition repair is implemented; contextual source/observed subject emission now preserves the same ownership-prefix specificity without changing marker placement/matching, at-rule semantics or resources. `packages/testing/README.md` documents its exact input limits, reproducible startup and machine-readable browser result. `resolveAssetUrl` now renders only bounded background-image bindings; other resources and condition/layer configurations outside the exact ADR-0030/testing README slice fail explicitly. Missing resolver, empty output or callback exceptions return reference diagnostics only; prior callback side effects are not rolled back. Cross-kind/compound/nested reference ordering, the full React corpus, browser CI and Pilot remain incomplete; no new production capability was deferred.

### Remaining original oracle deliverables

| Original item | Status and existing evidence | Remaining gate for that same item |
| --- | --- | --- |
| S8.17 — Representative React reference corpus | **Partial.** [Independent API](../packages/testing/src/index.ts) and [browser harness](../packages/testing/browser/main.ts) exist; the [README](../packages/testing/README.md) explicitly uses framework-independent DOM, not React lowering/rendering. | Authored Modules plus real adapter-transformed React consumers, equivalent independent reference mappings, real states/composition, and the exact reference syntax/config needed by that representative corpus. Keep handwritten contextual goldens identified separately. |
| S8.18 — Full feature-family corpus | **Partial.** Prior manual gate covers bounded ownership/state/attribute/before-after, eleven child/has goldens, flat registered conditions/simple outer layers, one-URL background images with decoded dimensions, and root keyframes with paused association/effect/frame metadata. [Fixture/harness source](../packages/testing/browser/) and [reference tests](../packages/testing/test/) corroborate those slices. | Representative positive selector/state/attribute/relation/pseudo combinations, custom-property inheritance/registration, fonts/resources, broader keyframe/resource combinations and mixed/compound/nested condition/layer cases. The existing metadata/dimension probes are not animation progression, painted pixels or full resource semantics. Reference exclusions do not defer production scope. |
| S8.20 — Full diagnostics/source ranges | **Partial.** [Comparison records](../packages/testing/browser/main.ts#L175) already report Module/path/node/subject/property, phase/state and both values. | Original-source ranges and attribution throughout the representative corpus; deliberate mismatches must identify the correct source/subject/state, not merely report unequal values. |

**CI gate: not implemented/evidenced in this repository.** [Root verify](../package.json) runs local lint/build/fast tests/typecheck. [browser:reference](../packages/testing/package.json) starts a Vite server; it is not a browser runner. No checked-in CI workflow was found. Add separate fast and actual browser jobs with reproducible setup, retained results/artifacts and failure on compile/frame/runtime/timeout/empty results, unexplained differences, literal failures and ineffective corruption controls. External CI configuration was not audited. This is an existing stage acceptance criterion, not a new checkbox unit.

Completion criteria:

- the representative corpus has zero unexplained computed-style differences;
- deliberately broken planner fixtures make the oracle fail;
- fast snapshots and browser tests run as separate CI jobs.

## Stage 9 — Real-project pilot

**Pilot not implemented/evidenced as a deliverable.** No checked-in real-project migration inventory, Pilot report, size measurements or developer-feedback record was found. Compiler/Vite tests and synthetic oracle fixtures are foundations, not migrated Modules. Select a real baseline and record the actual Module inventory across all eight areas below; count Modules, not tests or scopes. Publish attributable browser/diagnostic results, reproducible clean/repeated/incremental artifact and resource comparisons (including lazy routes), native stale-output/recovery evidence, before/after raw/gzip/Brotli sizes, and actual authoring/React feedback. SSR HTML measurements apply to the accepted supported-host boundary in Stage 7; do not invent savings or generic SSR integration.

Migrate 20–50 representative style Modules containing:

- simple declarations and shared atoms;
- nested ownership paths;
- state and structural contextual relations;
- media, supports, container, and layers;
- shorthand/longhand families;
- custom properties;
- keyframes, fonts, and asset URLs;
- React branch aliases and external `className` composition.

Pilot gates:

- zero unexplained browser-oracle difference;
- zero ignored error diagnostic;
- deterministic clean and incremental builds;
- no stale CSS after Module change/removal;
- measured CSS, JavaScript, and SSR HTML raw/gzip/Brotli sizes;
- documented developer feedback for authored and React usage.

## Prioritized remaining execution gates

These are dependency groups over the original labels and stage criteria, **not new progress units or a fixed number of rounds**. Keep all accepted MVP scope; no new deferrals are introduced.

1. **Domain/parser and diagnostic boundary (S2).** Establish the accepted ports/IR and source attribution, then matrix-backed positive/negative normalization/rollback fixtures, including adversarial selector errors. Gate: stable framework-free normalized IR and deterministic path-clean diagnostics with no partial contribution. Source tracing is a dependency of CSS maps and oracle ranges.
2. **Selector/cascade safety and planning (S2–S4).** Finish full effect classification, specificity, structural implication and canonical compound condition precedence jointly with residual/global/interleaved lowering. Gate: every accepted composition has positive and conflict/rollback evidence; names never select an unsafe winner; nested layers, functional/has list specificity, native inheritance and resource-cascade probes match independent expectations. Preserve already working native layer, resource and bounded predicate behavior.
3. **Compatibility and complete Compiler output (S4–S5).** Implement browserslist transformer/indivisible sequences, then whole-Module compatibility fallback; wire allocator and complete source maps/manifest/report targets. Gate: target/sequence/strict/fallback tests, identity round-trip/collision proof, source-to-rule mapping assertions, and randomized live-set convergence/resource cleanup. Depends on the domain/source boundary and semantic proof above.
4. **React provenance and supported-host acceptance (S6–S7).** Complete constrained cross-file props/escapes with typed React fixtures; exercise real hydration/linkage where applicable to Vite-managed HTML, lazy census and native lifecycle/resource recovery. Gate: supported class strings and diagnostics, unchanged external composition, shared CSS linkage and clean/incremental convergence. Existing server/watch/smoke evidence is retained, not rebuilt from zero.
5. **Representative independent oracle and browser CI (S8).** Expand independent syntax/mappings alongside the completed production slices and React corpus, add source ranges, and run separate fast/browser CI. Gate: zero unexplained differences, both-side literal expectations where needed, effective deliberate corruptions, complete attributable results and reproducible actual browser execution. The prior 49/875/six-control gate stays as bounded regression evidence, not full acceptance.
6. **Real-project migration (S9).** After the relevant semantic/adapter/oracle gates, migrate 20–50 real Modules covering the original inventory and publish all six Pilot outcomes. Gate: zero unexplained differences/ignored errors, deterministic clean/incremental outputs, no stale CSS, measured raw/gzip/Brotli CSS/JS/supported SSR HTML and developer feedback.

## After the MVP

Use pilot evidence—not assumptions—to prioritize deferred work in [`deferred-capabilities.md`](deferred-capabilities.md), including additional framework Adapters, CSS code splitting, editor integration, broader raw escape capabilities, and short/hash naming.
