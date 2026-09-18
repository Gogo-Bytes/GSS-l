---
status: accepted
---

# 在语义分析前展开标准 CSS nesting

GSS-l 首期支持标准 CSS nesting。Parser/normalizer 在 domain semantic analysis 前把 nested style rule、`&`、nested selector list 和 nested `@media`/`@supports` 展开为普通 selector branch 与 condition context；domain IR 不保留一套独立 nesting 语义。

## Consequences

- `.parent { .child {} }`、`&:hover`、`> .child`、`+ .sibling`、`~ .sibling` 和 nested condition复用展开后的 ownership、runtime relation、state 与 condition规则。
- 展开结果必须通过正向 capability validation；nesting 不允许绕过 local compound、selector 或 condition限制。
- Source range 同时保留 authored nested node 与 normalized selector来源，便于 diagnostic 指回原代码。
- 采用标准 CSS nesting grammar 和 semantics，不创建 Less/Sass 风格的第二套 nesting语言。
