---
status: accepted
---

# 第一版使用全局 GSS module declaration，不生成 per-file d.ts

第一版不为每个 `.gss` 文件生成或要求维护 `.gss.d.ts`，也不实现 TypeScript Language Service 或 IDE plugin。项目通过一个全局 `declare module '*.gss'` 提供宽泛 branded GSS scope 类型；精确的 ScopeSchema仍由Compiler和React Adapter在构建期使用。后续若真实需求证明需要精确IDE提示，再单独设计IDE integration。

## Consequences

- 用户无需创建、编辑、提交或等待生成任何 per-file declaration文件。
- `@gss-l/types`提供用于wildcard declaration的宽泛递归scope类型，例如`GssStyles`/`GssUnknownScope`；类型提示不保证具体scope key和target path存在。
- React Adapter的静态验证不依赖TypeScript类型提示，仍使用Compiler提供的真实ScopeSchema。
- `typeof styles.card`可以表达宽泛GSS scope，但第一版不承诺其为具体Module的精确target类型；ADR-0037的精确推导目标延后到IDE或更完整类型生成能力。
- 全局声明应由集成模板或公共types入口提供，不能覆盖或绕过React Adapter的unknown-path diagnostics。
