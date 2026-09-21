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
- [x] Version the property-effect registry and expand its first dataset across box, border, background, typography, flex/grid layout, transition, animation, and mask families.
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
- [x] Emit nested static scope objects and branded object-based consumer types through `@gss-l/types`.
- [x] Provide a global wildcard `.gss` declaration without per-Module declaration files.
- [ ] Emit central CSS, source map, manifest, and report, including Module compilation mode, fallback reasons, and atomic coverage.

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
