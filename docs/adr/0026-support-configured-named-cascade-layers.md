---
status: accepted
---

# 支持由项目配置排序的命名 cascade layer

GSS-l 首期支持命名 `@layer` block。项目级 `layerOrder` 声明所有已注册 layer 的稳定顺序，Registry统一输出 layer-order statement；Module 注册和编译完成顺序不参与 precedence。未注册 layer允许输出并 warning，但其相对 precedence 不属于 GSS-l 保证。

## Consequences

- Layer canonical name进入 atomic/contextual identity；相同 declaration位于不同 layer 时不能共享 class。
- Nested layer使用完整名称，例如 `framework.base`，并由同一个项目配置排序。
- Unlayered declaration保持原生 CSS cascade；normal unlayered高于 layered normal，`!important` 的 layer order按 CSS 规范反转。
- Layer、condition、selector state、property/value和 importance共同进入完整 cascade model与 manifest。
- Registry order statement和配置参与缓存 key；配置变化触发相关 CSS全量 finalize。
- 本决策不把 authored layer复用为 Compiler 内部实现排序技巧；内部 order机制不得改变 authored CSS layer语义。
