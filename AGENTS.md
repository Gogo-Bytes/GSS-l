# Repository agent instructions

## Delivery

After a coherent implementation or documentation stage is complete, run the relevant checks. When they pass and there are no known blockers or unresolved defects in that stage, commit and push the branch directly without requesting additional approval. Report the branch, commit, checks, and push result.

Keep incomplete or knowingly failing work unpushed. Do not publish packages or create releases unless the user explicitly requests it.

## Decision boundary

For MVP work, start from the accepted ADRs and the open gates in `docs/mvp-validation-plan.md`. Implement the smallest testable portion of an already-decided contract. If a derivative question requires new product semantics, supported syntax, public API/config, fallback policy, or a scope trade-off, stop that portion and ask the owner for a concrete decision with options and consequences before changing code or recording an ADR. Continue independent, already-decided work where possible; keep unresolved work uncommitted/unpushed. Distinguish bounded passing evidence from full-stage acceptance.

## Architecture

Keep the compiler domain framework-agnostic. Put React/JSX source analysis in a React adapter behind explicit ports so future Vue, Svelte, and other adapters can reuse the same domain model and compilation use cases.

Treat the sibling legacy GSS project as read-only reference material. Build the new implementation in this repository; when legacy code is useful, copy and adapt it here without editing the legacy project.

Record product semantics in `docs/adr/` and keep `docs/semantic-safety-evaluation.md` synchronized when a decision is accepted. Maintain a positive MVP capability matrix. Update `docs/deferred-capabilities.md` only for capabilities explicitly discussed and deferred or for key non-goals; do not enumerate every unimplemented CSS feature.
