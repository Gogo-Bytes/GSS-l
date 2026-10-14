---
status: accepted
---

# Anchor simple external tag and attribute targets without owning them

Extend [ADR-0052](0052-anchor-external-targets-without-owning-their-dom.md)'s external **declaration target** to one unnamespaced type selector such as `.editor :global(button)` or one exact-value attribute selector such as `.editor :global([data-mode="ready"])`. The `:global(...)` must remain the final descendant after a pure GSS-owned anchor path. The external node receives no GSS class, ScopeSchema export or imperative update; CSS preserves the authored type/attribute specificity and native dynamic matching. Retain every owned ancestor marker. This is not the separate same-node condition of ADR-0053.

The first bounded attribute shape reuses the existing equality-only attribute grammar: an explicit value, no namespace or case modifier. Retain validated authored CSS escape spelling when emitting the external attribute selector; JSON-style re-escaping of a decoded CSS newline would change what the browser matches. Existence, substring operators, tag/attribute/class compounds, pseudo state, non-descendant placement, unanchored globals and unproved coactive external effects remain fail-closed with last-known-good output retained. This is a positive slice of the accepted tag/attribute residual capability, **not** full S4.10 acceptance or a new preserved fallback. Broader supported shapes require their own semantic and cascade proof before admission.
