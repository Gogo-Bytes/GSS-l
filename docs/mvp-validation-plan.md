# MVP validation delivery plan

This is the execution index for the [accepted positive capability matrix](mvp-capabilities.md), [roadmap labels and gates](mvp-roadmap.md), and [semantic safety contract](semantic-safety-evaluation.md). It does **not** reduce accepted MVP scope, create new checkbox units, or turn bounded evidence into stage acceptance. ADRs remain authoritative for product semantics.

## Current baseline and evidence levels

- Original roadmap: **108 labels / 87 checked / 21 open = 19 partial + 2 not implemented**. S4.10 is now partial after the bounded anchored external-target slice; S4.17 and S4.19 remain not implemented. Stage 9 Pilot is separate. Checkbox count is not a readiness percentage.
- Implemented bounded Compiler/session, React-local and Vite-host seams are listed in the [roadmap](mvp-roadmap.md). The present fast verification passed **896 tests** (427 Compiler, 326 independent reference, 23 React, 120 Vite); it does not execute a browser.
- The **local** `corepack pnpm --filter @gss-l/testing browser:check` gate passed **103 fixtures / 1073 comparisons / 21 effective controls**. Reference CSS is independently compiled only within its bounded grammar; contextual fixtures outside that grammar use *hand-authored* native CSS. Never derive reference CSS or literal expectations from Compiler output. The full representative corpus is open.
- `corepack pnpm verify` and `browser:check` are separate local gates. GitHub CI/CD is **not** a requirement. Save attributable browser results and any failure artifact; a past passing count is not evidence for a changed final build.

## Exit rules for every coherent slice

1. Select an original open label or stage acceptance gate and state the **accepted** ADR/capability contract, current seam, and exact missing proof. Do not split or inflate checkbox units.
2. Start with a public-seam failing regression (including a negative/rollback case where applicable). Production changes must preserve unsupported-combination fail-closed behavior; no parser/property/config/global expansion without an accepted product decision.
3. For browser-affecting semantics, add literal expectations and independent hand-authored native reference CSS, then run the local browser gate on the final build. Pure infrastructure/documentation changes need the relevant focused check; do not call an unchanged browser run new semantic acceptance.
4. Run focused tests, `corepack pnpm verify`, `git diff --check`, local documentation-link checks, and an independent review. Run `browser:check` whenever the browser corpus or output behavior changes; inspect actual results and corruption controls. Commit/push only a coherent passing slice; report implemented behavior, bounded evidence, stage acceptance, remaining work, risks, branch/commit/checks/push.

## Delivery order (dependencies, not new milestones or deferrals)

| Order | Remaining contract | Exit evidence; keep open until met |
| --- | --- | --- |
| 1. Safety boundary (S2–S4) | Complete positive/negative accepted selector and parser matrix, property-effect overlaps/resets, specificity, importance/layer/condition and implication proofs. S4.10 has only a class-only anchored external-target slice (including multi-segment owned descendant paths); broader residual/global planning, S4.9 and S4.16 remain partial. | Public-session red/green and transactional rollback, cross-context native literals, source/config/registration reversals; ambiguous unsupported compositions fail closed. Resolve missing global semantics (mounting, ScopeSchema, specificity, cross-Module isolation) in ADR before implementing `:global()`. No full S2–S4 acceptance from isolated fixtures. |
| 2. Compatibility and output (S4.17/S4.19, S5) | Decide target/transformer port and indivisible declaration sequences before compatibility-specific whole-Module preserved fallback; complete allocator identity proof, Compiler CSS maps, source-to-rule tracing and manifest/report fields. | Target-specific sequence/resource/strict/fallback tests, no partial output, randomized live-set convergence and source attribution. Existing property-effect fallback does not stand in for compatibility fallback. |
| 3. React and supported Vite host (S6–S7) | Constrained imported/shared type provenance, multi-hop props, typed escapes and representative supported-host SSR/SSG/client CSS linkage and lifecycle. | Real typed/rendered React fixtures, unchanged external class composition, lazy census and clean/incremental/delete/recovery equivalence; do not claim generic SSR integration. |
| 4. Representative independent oracle (S8) | Expand reference mappings and browser corpus to accepted selector/state/condition/layer/custom-property/resource combinations, including actual React consumers and attributable source diagnostics. | Local `verify` and actual browser gate on the same final build: zero unexplained/literal differences, effective negative controls, nonempty records and reproducible artifacts. Bounded 103/1073/21 remains regression evidence, not full corpus acceptance. |
| 5. Real-project Pilot (S9) | Migrate **20–50 actual style Modules** across the eight original inventory areas. | All six [Pilot gates](mvp-roadmap.md#stage-9--real-project-pilot): zero unexplained differences/ignored errors, deterministic clean/incremental output, no stale CSS, raw/gzip/Brotli CSS/JS/supported HTML sizes and actual author feedback. Synthetic fixtures are not Pilot data. |

Prioritize the earliest blocker of a representative end-to-end validation path. Avoid a succession of tiny isolated tests that does not close one of these gates. Keep [deferred capabilities](deferred-capabilities.md) limited to explicitly accepted deferrals and non-goals; missing MVP work here is **not** implicitly deferred.
