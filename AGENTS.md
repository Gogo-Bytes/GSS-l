# Repository agent instructions

- On session handoff or delivery planning, read `README.md` and `docs/STATUS.md` for the merged implementation, semantic contracts, validation boundaries, deferred work, and local evidence recovery. `docs/HANDOFF.md` contains the next-session prompt. Current documentation is a concise owner-requested handoff, not a restored historical roadmap.
- Complete the requested task and run relevant checks. Historical unfinished roadmap/Pilot work is not an autonomous task queue. Confirm the next goal with the owner when none is specified. New features, public API/configuration, syntax or fallback changes require an explicit owner decision.
- Performance optimization/profiling and the historical Firefox Article issue are deferred. Existing browser scripts retain their default engine scope; verify the actual entry point before an owner-scoped run. Preserve independent oracles, exact image comparisons and failed-run evidence.
- Commit and push coherent passing changes without further approval. Keep incomplete or knowingly failing work unpushed. Report branch, commit, checks and push result. Package publication, releases and tags require an explicit owner request.
- Work directly on the existing `main` checkout. Creating branches or worktrees requires owner approval. If another session is writing or unrelated changes are present, stop and coordinate rather than overwrite, reset or automatically stash. Old uncommitted work and removed-worktree evidence are preserved as described in `docs/STATUS.md`.
- Keep the compiler domain framework-agnostic. React/JSX analysis belongs in the React Adapter behind explicit ports.
- Treat the sibling legacy GSS project as read-only reference material; copy and adapt useful code here without editing that project.
