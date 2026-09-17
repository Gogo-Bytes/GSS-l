---
status: accepted
---

# 将 `:has()` 作为 observed contextual relation 支持

GSS-l 首期支持受约束的 `:has()`。Declaration 仍作用于 subject scope；`:has()` 内的 local class 是独立 observed marker，通过自己的 top-level `styles.<class>` 挂到实际元素，而不是 subject 的 descendant target path。Compiler 保留 relative selector，由浏览器判断 descendant、child 或 sibling relation，不下推为 subject 的无条件纯 atom。

## Consequences

- `.card:has(.error)` 使用 `styles.card` 与 `styles.error`，生成形如 `.cardToken:has(.errorMarker)` 的 contextual atom。
- 支持简单 local class、`>`、`+`、`~`、attribute、tag、pseudo、local-class-plus-pseudo 和 selector list；attribute/tag/global residual 不产生本地 marker。
- Observed local compound 如 `:has(.field.error)` 首期拒绝，优先改写为 attribute condition；显式 `:global(...)` compound 可以作为外部 residual 保留。
- 不支持嵌套 `:has()`；除 Compiler constraint 复杂度外，原生 CSS 也不允许 `:has()` nesting。
- 多个可共存且不可比较的 `:has()` condition 修改同一 target/property 时，按 ADR-0002/0013 返回歧义 diagnostic；作者可增加显式交集或改写为互斥条件。
- `:has()` observed marker 是 relation identity 的一部分，不与无条件 pure atom混用。
