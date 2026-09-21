---
status: accepted
---

# 分阶段支持通过 React props 传递 GSS scope

GSS scope 可以通过 React props 在组件之间传递。第一阶段只支持能够通过显式 GSS scope 类型或局部静态来源证明为 GSS scope 的 props，并在该 prop 最终进入 JSX `className` 时取 `.self`；后续再增加受约束的跨文件直接传递与 prop forwarding。无法证明 provenance、存在 `GssScope | string` 混合、动态组件、任意 spread 或复杂高阶组件传递时，Adapter 返回 diagnostic，不生成 runtime type check。

## Consequences

- `styles.card` 可以作为 scope object 传给子组件；接收方明确声明 GSS scope 后可以在 `className` 中自动 lower 为 `scope.self`。
- 普通字符串 class prop 继续使用 `.self`，GSS scope 与 string 的混合 prop 不自动推断。
- 第一阶段不要求完整 TypeScript TypeChecker 或全项目组件调用图；React Adapter保持 Babel parser + MagicString的局部转换架构。
- 后续跨文件支持必须保持静态、可证明、可缓存，并在无法证明时 fail closed。
