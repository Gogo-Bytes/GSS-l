---
status: accepted
---

# 提取 framework-agnostic 的 `@gss-l/types` package

GSS consumer-facing types（包括 branded `GssScope<TTargets>`、scope-related declaration helpers和公共诊断/manifest类型）归入独立的 `@gss-l/types` package。生成的 `.gss.d.ts` 只通过 `import type` 引用该 package，不依赖 React Adapter或Compiler实现package；Scope类型不属于任何特定框架，未来的 Vue、Svelte等Adapter可以复用同一入口。

## Consequences

- `@gss-l/types` 不提供production runtime；brand symbol仅存在于TypeScript类型层。
- Compiler实现、React Adapter与其他framework Adapter可以分别依赖该types package。
- workspace会增加一个小型类型package，并需要保持其版本与生成declaration contract同步。
- 在React Adapter实现前，需要把当前Compiler public consumer types拆分或重新导出到该package。
