---
status: accepted
---

# Vite 使用稳定的 GSS virtual JavaScript Module

用户继续通过原始 `.gss` import source 引用样式；`@gss-l/vite` 在内部将 canonical physical Module id映射为稳定的 `\0gss-l:` virtual id。`resolveId`只负责 source/path到virtual id的解析，`load`调用Compiler session并返回`StyleModuleArtifact.moduleCode`；physical source id负责HMR、ScopeSchema lookup和last-known-good生命周期。`.d.ts`发现、central CSS injection、production asset emission与URL处理不在本决策范围内；central CSS只由Vite-managed HTML的Vite Adapter负责，其他SSR/SSG框架由独立Adapter处理。

## Consequences

- 用户源码保持 `import styles from './Card.gss'`，不暴露virtual id。
- 原始GSS源码与生成JS在Vite ModuleGraph中分离，避免普通CSS/JS插件误解析GSS源码。
- Vite Adapter维护 physical id、virtual id、ScopeSchema和Compiler contribution之间的映射。
- Hard diagnostic使`load`失败并保留last-known-good；preserved fallback仍返回generated JS并记录warning。
- HMR以physical source id触发`replaceStylesheet()`，ScopeSchema变化时同时失效virtual importer。
