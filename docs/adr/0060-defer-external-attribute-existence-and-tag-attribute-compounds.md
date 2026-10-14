---
status: accepted
---

# Defer external attribute existence and tag–attribute compound targets

For the MVP, keep [ADR-0059](0059-anchor-simple-external-tag-and-attribute-targets.md)'s anchored external **tag/attribute declaration target** grammar limited to one bare unnamespaced type selector or one explicit exact-value attribute selector. Do not expand that grammar to attribute existence (for example, `.editor :global([data-mode])`) or tag–attribute compounds (for example, `.editor :global(button[data-mode="ready"])`) in this stage. Both remain unsupported and fail closed with the last-known-good Module retained. This narrows the earlier broad tag/attribute residual entry in the positive capability matrix; it does not turn unsupported syntax into preserved fallback or declare S4.10 complete.

The choice favors a testable, native-specificity-safe positive boundary over widening the target and coactivity grammar before representative end-to-end validation. Existing external class and class-compound targets under [ADR-0052](0052-anchor-external-targets-without-owning-their-dom.md), same-node external-class conditions under [ADR-0053](0053-treat-same-node-global-as-an-external-condition-on-owned-scope.md), and owned-node attribute conditions/observations are unchanged. Revisit the deferred forms against real Module demand after core Compiler/Vite/browser validation; any expansion needs an explicit selector/specificity/coactivity contract, public rollback regressions and independently authored native browser controls. Other S4.10 residual/global placement, functional and cross-context proofs remain open rather than being implicitly deferred.
