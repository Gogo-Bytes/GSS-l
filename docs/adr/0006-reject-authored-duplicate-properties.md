---
status: accepted
---

# 拒绝 authored duplicate property fallback sequence

GSS-l 的 `.gss` 输入默认不允许同一 declaration block 在同一 condition/importance 下重复声明 exact property。Compiler 不把重复值拆成依赖 value 顺序的普通 atom，也不在首个版本提供自定义 fallback sequence atom。标准浏览器兼容转换交给基于 browserslist 的 CSS transformer；业务 feature fallback 使用显式 `@supports` condition 表达。

## Consequences

- `display: -webkit-box; display: flex` 等 authored sequence 返回 diagnostic，作者应只写标准值或改用明确的 feature condition。
- Transformer 可以把一个 semantic atom扩展为包含多条物理兼容 declaration 的 rule，例如 semantic `display:flex` 渲染成 prefixed sequence；该序列作为不可拆的生成结果，不参与跨 Module value-level 排序。
- `@supports` fallback 使用项目级 condition order；未注册 condition 仍遵循 ADR-0003 的 warning 和无顺序保证规则。
- Exact-property 的普通覆盖必须在进入 registry 前解析为单一 winner，不能依赖 class attribute、首次注册或 value hash 顺序。
- 如果未来出现无法由 transformer 或 `@supports` 表达的真实需求，再单独设计显式 declaration-sequence atom。
