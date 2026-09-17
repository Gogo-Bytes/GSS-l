---
status: accepted
---

# 支持 module-local `@keyframes` 与静态 animation reference

GSS-l 首期支持 `@keyframes`。Keyframe block 作为不可拆全局 resource保留，不把 frame declaration生成为 class；Module 内静态 `animation-name` 和 `animation` shorthand reference解析为 local symbol并重写为 registry 分配的稳定名称。没有对应 local definition 的 animation name保持为外部 CSS 名称。

## Consequences

- 支持 `from`、`to`、percentage frame selector、多 animation list 和 condition-scoped keyframes。
- Animation shorthand使用 CSS value parser识别名称，不做字符串替换；`var(...)` 保持 opaque，不推断其中的 keyframe reference。
- Resource registry负责稳定命名、引用计数、Module replacement/removal、deterministic output 和 manifest authored/generated name映射。
- Keyframe resource identity包含 canonical frames 与 condition context；其 naming namespace与 class namespace分开管理。
- 普通 declaration仍把 rewritten animation value作为 atom identity的一部分。
