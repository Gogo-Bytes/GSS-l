---
status: accepted
---

# Anchor external targets without owning their DOM

A GSS-owned scope may anchor a selector whose declaration target is an external descendant, e.g. `.editor :global(.ProseMirror-focused)`. The local `.editor` is the anchor and export; `.ProseMirror-focused` remains an externally supplied class and is not a GSS scope, target export, generated marker, or DOM mutation. The Compiler emits scoped CSS so the browser matches existing and future external descendants as their classes change. This preserves CSS's rightmost-target meaning while limiting the rule to an owned root; unlike a `:has()` condition on `.editor`, it styles the external descendant itself.

The Compiler does not discover, add classes to, or imperatively style external nodes. Matching depends on the external DOM/class contract, stylesheet presence and native cascade; GSS does not promise to win against outside higher-priority declarations. The anchor must be a declared GSS ownership path; standalone unanchored globals do not enter the MVP. Syntax beyond a safely validated anchored external target and ambiguous coactive declarations must stay fail-closed until their placement and cascade proofs are established. [ADR-0053](0053-treat-same-node-global-as-an-external-condition-on-owned-scope.md) separately accepts a bounded same-node external class **condition** on an owned target; it does not make same-node selectors external declaration targets. This decision does not turn external nodes into `ScopeSchema` exports or change React Adapter ownership.
