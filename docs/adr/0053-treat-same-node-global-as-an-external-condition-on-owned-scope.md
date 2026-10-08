---
status: accepted
---

# Treat same-node global as an external condition on an owned scope

When `:global(...)` immediately follows a GSS-owned class on the same selector node, as in `.editor:global(.ProseMirror-focused)`, the declaration targets the **owned editor node** only while its externally supplied class matches. GSS supplies its own scope class but neither discovers nor changes the third-party class. This differs from [ADR-0052](0052-anchor-external-targets-without-owning-their-dom.md)'s `.editor :global(...)`: the descendant selector targets an external node and the space is semantic, not cosmetic.

The external condition contributes native class specificity and does not create a new export, path, or class-managed external node. Composition with other authored rules and external conditions must fail closed where the compiler cannot prove cascade safety; this decision does not implicitly admit standalone globals, local-local compounds, selector lists inside `:global()`, or arbitrary functional/contextual combinations. Browser matching responds to external class changes without GSS DOM mutation.
