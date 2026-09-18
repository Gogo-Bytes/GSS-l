# Repository agent instructions

## Delivery

After a coherent implementation or documentation stage is complete, run the relevant checks. When they pass and there are no known blockers or unresolved defects in that stage, commit and push the branch directly without requesting additional approval. Report the branch, commit, checks, and push result.

Keep incomplete or knowingly failing work unpushed. Do not publish packages or create releases unless the user explicitly requests it.

## Architecture

Keep the compiler domain framework-agnostic. Put React/JSX source analysis in a React adapter behind explicit ports so future Vue, Svelte, and other adapters can reuse the same domain model and compilation use cases.

Treat the sibling legacy GSS project as read-only reference material. Build the new implementation in this repository; when legacy code is useful, copy and adapt it here without editing the legacy project.

Record product semantics in `docs/adr/` and keep `docs/semantic-safety-evaluation.md` synchronized when a decision is accepted. Maintain a positive MVP capability matrix. Update `docs/deferred-capabilities.md` only for capabilities explicitly discussed and deferred or for key non-goals; do not enumerate every unimplemented CSS feature.
