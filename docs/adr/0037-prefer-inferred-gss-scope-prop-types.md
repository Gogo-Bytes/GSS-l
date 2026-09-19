---
status: accepted
---

# 优先使用推导的 GSS scope prop 类型

组件 props 默认通过 generated `.gss.d.ts` 推导精确 scope 类型：`import type styles from './Card.gss'` 后使用 `typeof styles.card`。通用组件可以使用 `@gss-l/types` 提供的 `GssScope<TTargets>` 泛型，但第一阶段不要求用户手写完整 target tree，也不鼓励用宽泛的 `Record<string, unknown>` 代替精确结构。两种形式共享同一个 GSS phantom brand，供后续 Adapter provenance 分析使用。

## Consequences

- `.gss` target path变化会自动反映到依赖该类型的组件 props。
- 普通组件不需要重复维护 scope tree；共享组件仍可通过泛型保持复用性。
- 第一阶段优先支持精确 `typeof styles.<scope>` 类型与局部静态绑定，复杂类型别名展开和完整 TypeScript 类型分析后置。
- Adapter的 scope 识别依赖公共 brand和静态来源，不通过宽泛结构类型猜测。
