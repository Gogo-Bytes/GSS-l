---
status: accepted
---

# Functional pseudo 不接受 local class condition

GSS-l 首期支持 `:not()`、`:is()` 和 `:where()`，但其参数只允许已支持的 pseudo、attribute 和显式 `:global(...)`；参数中的 local class 返回 diagnostic，避免通过 functional pseudo 绕过 ADR-0014 的 local compound 限制。`:has()` 表达跨节点关系，留作独立决策。

## Consequences

- `.button:not(.disabled)`、`.button:is(.primary, .secondary)` 和 `.button:where(.large, .small)` 不支持，优先改写为 `data-*`、ARIA 或标准 pseudo condition。
- `.button:not(:disabled)`、`.button:is(:hover, :focus-visible)` 和 attribute 分支可以保留为 contextual condition。
- `:is()` 记录 OR condition；`:not()` 记录 negative condition；`:where()` 除 condition semantics 外必须保留零 specificity，不能按普通 `:is()` 处理。
- `:global(...)` 内的第三方 class 可以作为显式 external condition 保留，不生成本地 style path，也不进入 local ownership。
- Functional selector 的多个分支设置的是同一 declaration；若它与其他可共存 condition 冲突，继续使用 relation implication 或歧义 diagnostic规则。
