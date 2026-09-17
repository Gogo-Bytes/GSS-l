---
status: accepted
---

# 首期使用正向 pseudo-element capability set

GSS-l 首期明确支持 `::before`、`::after`、`::placeholder`、`::marker`、`::file-selector-button`、`::backdrop`、`::first-line`、`::first-letter` 和 `::selection`。Capability matrix 只维护正向支持集合；未注册语法统一遵循 ADR-0019 fail closed，不枚举整个 CSS 规范的反向排除清单。

## Consequences

- Pseudo-element 是 atom/contextual identity 的一部分，并位于 selector target 末尾。
- 支持 `:hover::before` 等 state + pseudo-element 组合，沿用既有 state/relation precedence。
- Vendor spelling 和兼容 declaration 由 browserslist transformer处理。
- Compiler 不自动补 `content`，也不复制浏览器的 pseudo-element property applicability validation。
- Capability 文档与 diagnostics 报告“当前支持集合”，不为每个未实现 CSS pseudo-element 单独创建 deferred 条目。
