---
status: accepted
---

# 将可恢复的 atomization failure 自动降级为 preserved Module

GSS-l 对合法且可安全 scope、但因未知 property effect 或不可拆 compatibility sequence 而无法证明 atomic transformation 安全的 Module，自动降级为整 Module preserved output，而不要求用户改成 `.module.css`。Preserved Module 保持 authored rule/declaration order、condition/layer结构、GSS `ScopeSchema` 与静态 Module-local class marker；它不是逐 declaration/rule fallback，也不是把 `.gss` 委托给框架 CSS Modules实现。

## Consequences

- 默认 `atomizationFallback` 为 `preserve-module`；项目可配置为 `error`，CI也可把 fallback warning或preserved Module预算升级为失败。
- Fallback只覆盖可恢复的atomization limitation。Parse failure、无法构建ScopeSchema、不安全selector/scope escape、不可证明的global ordering和global resource conflict继续hard fail。
- 一个Module只能整体处于`atomic`或`preserved`模式；不得混合部分atomic和部分preserved rule，以免未知property effect跨边界竞争。
- Fallback必须产生稳定warning，并在artifact、manifest和report中记录mode、reason与atomic coverage，不能静默deopt。
- Preserved Module仍由Compiler管理transaction、命名、resource、URL dependency、central snapshot和HMR；production不增加GSS runtime。
- ADR-0019被本决策取代：fail-closed现在表示atomic proof失败时禁止atomic输出，preserved proof也失败时才拒绝整个Module。
