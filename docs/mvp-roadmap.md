# GSS-l MVP roadmap

> The product semantics are frozen for the first implementation pass. Implementation status starts from zero; the existing uncommitted recipe-oriented prototype is exploratory and does not count as completed work.

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

Completion criteria:

- table tests cover every entry in `mvp-capabilities.md`;
- unsupported fixtures fail closed without partial Module contribution;
- normalized IR snapshots are byte-stable and contain no React types.

## Stage 3 — Declaration and cascade resolution

- [x] Establish the data-driven `PropertyEffectRegistry` seam with margin/padding effect families.
- [x] Resolve exact-property and registered shorthand/longhand winners per closed target candidate set.
- [x] Version the property-effect registry and expand its first dataset across box, border, background, typography, layout, transition, animation, and mask families.
- [ ] Complete shorthand classification for the full positive property set; unclassified effects must not enter atomic output and must be classified as unknown rather than singleton longhands.
- [x] Detect registered logical/physical property conflicts, including conflicts introduced by ownership target accumulation.
- [ ] Implement importance and authored cascade layer semantics.
- [ ] Implement selector specificity, including `:where()` zero specificity.
- [x] Implement registered at-rule condition rank for deterministic rule planning.
- [x] Reject equal-precedence coactive current-state conflicts unless an explicit intersection resolves them.
- [ ] Implement full relation implication and remaining incomparable-condition diagnostics.
- [x] Accumulate descendant-class selectors whose paths provably match a declared target and resolve their exact-property winners.

Completion criteria:

- no winner depends on value, emitted name, registry insertion, or worker completion order;
- reversing Module registration order produces identical resolved IR;
- representative results match the browser reference cascade.

## Stage 4 — Rule and resource planning

- [ ] Plan ownership declarations as pure atoms.
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

Completion criteria:

- every planned rule traces to source and semantic identity;
- each CSS rule contains one semantic declaration;
- resource replacement/removal tests leave no stale output.

## Stage 5 — Compiler session and deterministic output

- [ ] Implement `createGssCompilerSession()`.
- [ ] Implement transactional `replaceStylesheet(id, source)`.
- [ ] Implement `invalidate(id)` and reference-count cleanup.
- [ ] Implement full-census `finalize()`.
- [x] Implement `RuleOrderPlanner` separately from `CascadeResolver`.
- [ ] Implement reversible readable names behind `NameAllocatorPort`.
- [ ] Emit nested static scope objects and branded TypeScript declarations.
- [ ] Emit central CSS, source map, manifest, and report, including Module compilation mode, fallback reasons, and atomic coverage.

Completion criteria:

- failed replacement retains the last committed contribution;
- add/change/delete sequences converge to the same snapshot as a clean build;
- output is byte-identical across randomized Module registration orders;
- no absolute path, timestamp, random value, or iteration-order artifact appears.

## Stage 6 — React style-usage Adapter

- [ ] Detect `.gss` imports in React/TypeScript source.
- [ ] Resolve longest static scope path.
- [ ] Lower direct references inside JSX `className` to `.self`.
- [ ] Lower nested GSS references inside `className` expressions such as `cx(...)`.
- [ ] Propagate accepted local immutable direct, conditional, and property aliases.
- [ ] Emit path and scope-escape diagnostics with `.self` suggestions.
- [ ] Preserve non-GSS expressions and produce source maps.

Completion criteria:

- transformed code contains no scope object where React receives a class string;
- arbitrary `cx()` and external class semantics remain untouched;
- unsupported escape fails explicitly rather than producing runtime object coercion;
- TypeScript fixture projects pass with generated declarations.

## Stage 7 — Vite integration, production asset, and HMR

- [ ] Implement `.gss` virtual JavaScript/declaration Modules.
- [ ] Connect Vite module lifecycle to Compiler replace/invalidate.
- [ ] Emit one central production CSS asset for all reachable main/lazy Modules.
- [ ] Emit the build manifest needed by SSR.
- [ ] Implement one dev style owner and full ordered snapshot replacement.
- [ ] Implement last-known-good rollback and generation ordering.
- [ ] Handle CSS and font URL dependencies through the Adapter.

Completion criteria:

- production contains no GSS runtime;
- SSR and client hydration use the same names and CSS asset;
- lazy route loading cannot change cascade order;
- HMR add/change/delete and compile-error recovery produce the expected final stylesheet.

## Stage 8 — Independent semantic oracle

- [ ] Implement `compileGssReference()` outside the atomic planner.
- [ ] Generate reference style mappings for the same React fixtures.
- [ ] Run reference and atomic output in isolated browser documents.
- [ ] Compare touched properties and property-effect longhands.
- [ ] Cover pseudo-elements, browser states, attributes, relations, media/supports/container, layers, custom properties, keyframes metadata, and resources.
- [ ] Produce actionable difference diagnostics.

Completion criteria:

- the representative corpus has zero unexplained computed-style differences;
- deliberately broken planner fixtures make the oracle fail;
- fast snapshots and browser tests run as separate CI jobs.

## Stage 9 — Real-project pilot

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

## After the MVP

Use pilot evidence—not assumptions—to prioritize deferred work in [`deferred-capabilities.md`](deferred-capabilities.md), including additional framework Adapters, CSS code splitting, editor integration, broader raw escape capabilities, and short/hash naming.
