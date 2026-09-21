---
status: accepted
---

# 将 GSS scope 建模为带品牌的 scope object

GSS scope 在 public TypeScript contract 中表示一个带品牌的 scope object，而不是伪装成 `string` 的交叉类型。`GssScope<TTargets>` 暴露 `self: string` 与递归 target properties，并带有纯类型 phantom brand；只有 `.self` 是 class string。生成的 `.gss.d.ts` 从公共 GSS types 入口导入该类型，React Adapter 后续只对能够证明为 `GssScope` 的 props 做跨组件 `className` lowering。该 brand 不产生 production runtime。

## Consequences

- `styles.card` 的类型与运行时对象一致；`styles.card.self` 明确表示字符串 class。
- 普通 TypeScript 代码不能再把 GSS scope object 隐式当作 `string` 传递，减少运行时 `[object Object]` 风险。
- 需要提供稳定的公共纯类型入口，例如 Compiler public types package；Compiler Domain不依赖React。
- 生成 declaration、React Adapter scope escape diagnostic和后续跨文件 provenance分析都以该 brand为识别边界。
- 这是对早期 `string & TTargets` declaration模型的修正；现有 generated declaration snapshots需要随实现更新。
