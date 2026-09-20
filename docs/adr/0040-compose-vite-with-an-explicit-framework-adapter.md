---
status: accepted
---

# Vite Adapter 使用显式 framework Adapter 组合

`@gss-l/vite` 不默认绑定 React，而是通过显式配置组合 framework Adapter：`gss({ adapter: react() })`。Vite plugin拥有构建工具生命周期和Compiler session，framework Adapter拥有对应语言的source analysis与lowering；未来可以以同一组合方式接入Vue、Svelte等Adapter。

## Consequences

- React项目需要显式组合`@gss-l/vite`与`@gss-l/react`。
- Vite plugin不隐式承担React语义，也不把React依赖带入所有Vite用户。
- Adapter contract必须提供source transform、scope/reference integration和相关diagnostic能力。
- 插件组合配置成为Vite集成的公开API，后续需要稳定其类型和错误报告行为。
