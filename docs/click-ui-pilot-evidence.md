# Click UI real-project pilot evidence

## Result

The local-only evaluation used ClickHouse's Apache-2.0 `click-ui` repository,
React, and Vite 7, at baseline `00d99f9`. The baseline contained 80 CSS Modules.
Two actual modules were migrated to `.gss` without changing the authored CSS
semantics:

- `src/components/FormContainer/Error.module.gss`
- `src/components/Spacer/Spacer.module.gss`

The repository was built and its Storybook was loaded in a browser. Typecheck,
production build, all **771 unit tests across 72 files**, and Storybook build
passed. This demonstrates that a bounded GSS/Vite integration path can work in
a substantial existing component library; it does not establish correctness
for all 80 modules.

## Failures observed while selecting modules

The attempted candidates exercised real inputs beyond the two successful
modules. Unsupported or unsafe inputs failed closed rather than being rewritten
to force a pass. Observed issues include:

- top-level CSS comments;
- equality attribute selectors and element/universal descendant selectors;
- `:not()` combinations;
- coactive conditions producing ambiguous `background-color` or
  `animation-name` declarations;
- hyphenated CSS class keys emitted as invalid JavaScript identifiers;
- React consumers with dynamic scope expressions.

These are **triage leads**, not a declaration that every occurrence is an MVP
regression. Before fixing any, match the exact source construct to the accepted
positive capability matrix and ADRs. An unsafe combination that is deliberately
outside accepted semantics should keep failing closed; a construct inside the
accepted matrix is an MVP defect and needs a public-seam regression.

The hyphenated-root-key finding was subsequently fixed in the GSS-l Compiler:
invalid JavaScript identifiers now use private generated bindings while the
exported object retains the authored quoted key. Public Compiler regressions
cover `.button-primary`, reserved words, and generated-binding collisions.
The owner explicitly chose to postpone the top-level comment question and the
other Click UI observations until after MVP work; current fail-closed semantics
and the original MVP acceptance gates remain unchanged.

The pilot's successful modules did not cover `@supports`, `@container`,
`@layer`, `@font-face`, CSS asset `url()`, or all eight original Stage 9
inventory areas. No size benefit, author feedback, or full migration acceptance
was established. The report is supplementary real-project evidence only.

A standalone local HTML report is at
`/Users/gan/Desktop/gss-l-click-ui-pilot-report.html`; the local-only project
worktree is `/tmp/gss-vite-pilot-click-ui`, branch `pilot/gss-l-evaluation`,
starting from `00d99f9`. Nothing was pushed to the Click UI repository.

## What the original MVP plan asked for

The accepted plan has not changed. It calls for the complete positive capability
matrix and safety proofs, not merely a working sample. The remaining delivery
sequence is dependency ordered:

1. Complete the accepted parser/IR/diagnostic contract (S2).
2. Complete selector, property-effect, specificity, implication, and rule-order
   safety for accepted compositions (S2–S4); preserve fail-closed behavior for
   unsafe or out-of-scope compositions.
3. Complete host-target compatibility/output evidence and remaining manifest,
   allocator, and source mapping work (S4–S5).
4. Complete constrained React provenance and supported Vite-host acceptance
   (S6–S7).
5. Complete the representative independent browser oracle and its separate
   local browser gate (S8).
6. Then complete Stage 9: migrate 20–50 actual Modules covering the eight
   inventory areas and satisfy all six gates—zero unexplained differences and
   ignored errors, deterministic clean/incremental output, no stale CSS,
   measured raw/gzip/Brotli CSS/JS/supported HTML sizes, and actual author
   feedback.

The roadmap remains **108 original labels / 87 checked / 21 open** (21 partial,
none not implemented). The Click UI experiment does not check any additional
label or satisfy Stage 9.

## Choosing the next cadence

There are two sensible modes, but they should not be collapsed into “fix every
failure found in Click UI”:

### A. Finish the accepted MVP first — recommended default

Take the earliest dependency blocker from the validation plan, and close one
coherent contract with public red/green tests and the independent browser gate
where behavior changes. Keep Click UI as a regression corpus and periodically
re-test selected modules. This is the route that preserves the original goal:

a trustworthy MVP whose *accepted* language is complete and whose unsupported
language fails safely. It avoids widening scope based on one project's syntax.

### B. Capability-gap sprint — only after classifying the gaps

Create a short, bounded triage queue from the Click UI observations. For each
item, record: exact source and construct; accepted-matrix/ADR status; actual
failure mode; public regression; browser reference; and rollback/fail-closed
proof. Fix only those already accepted by MVP semantics. If the construct is not
accepted, seek an explicit product decision before changing semantics or
configuration. Do not equate a pilot's desire to migrate a file with acceptance
of the required CSS feature.

### Decision rule

Do not freeze the product strategy based on the raw “2 of 80” ratio: selection
was intentionally bounded and the candidate modules were not a random or
representative sample. Use the earliest original MVP gate as the next unit of
work, and use Click UI as a practical adversarial source of regressions. Revisit
the full pilot after the relevant S2–S8 gates advance enough to make the 20–50
Module acceptance exercise meaningful. Stage 9 remains open either way.
