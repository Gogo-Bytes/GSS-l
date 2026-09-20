---
status: accepted
---

# 将 Vite Adapter 与 React Adapter 分离

`@gss-l/react` 只负责 React/TypeScript source analysis、GSS scope lowering和相关诊断；Vite plugin、virtual Module、Compiler session lifecycle、central CSS asset、HMR、SSR manifest与URL/asset orchestration归入独立的`@gss-l/vite` package。React source transformation与构建工具集成是正交职责，不让React入口承担Vite生命周期。

## Consequences

- workspace新增`packages/vite`，公开package名为`@gss-l/vite`。
- `@gss-l/react`可以脱离Vite被测试或被其他bundler Adapter复用。
- `@gss-l/vite`组合Compiler、React Adapter和Vite hooks，但不把Vite类型或生命周期引入Compiler Domain。
- `.gss` virtual JS/declaration Module、central CSS snapshot、HMR和asset dependency处理由`@gss-l/vite`拥有。
