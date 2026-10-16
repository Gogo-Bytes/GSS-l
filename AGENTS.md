# Repository agent instructions

- The owner froze the MVP implementation at `c99a0d31cb0f526d75f912a86dfa478f209d0478`. Existing `corepack pnpm verify` and `corepack pnpm --filter @gss-l/testing browser:check` are the finite acceptance gates; both passed on that implementation (1081 tests; 123 browser fixtures / 1260 comparisons / 38 named controls plus existing host checks).
- Complete the requested task, run relevant checks, report results, and stop. Historical unfinished roadmap/Pilot work is post-MVP, not an autonomous task queue. New features, public API/configuration, syntax or fallback changes require an explicit owner decision.
- Project documentation was removed at the owner's request. Recover historical semantics/ADRs from Git at the frozen commit when explicitly needed; historical execution instructions are not current tasks.
- Commit and push coherent passing changes without further approval. Keep incomplete or knowingly failing work unpushed. Report branch, commit, checks and push result. Package publication, releases and tags require an explicit owner request.
- Preserve unrelated work; use an isolated branch/worktree when another session is writing. The original worktree's uncommitted Dev React HMR changes are excluded from the frozen candidate.
- Keep the compiler domain framework-agnostic. React/JSX analysis belongs in the React Adapter behind explicit ports.
- Treat the sibling legacy GSS project as read-only reference material; copy and adapt useful code here without editing that project.
