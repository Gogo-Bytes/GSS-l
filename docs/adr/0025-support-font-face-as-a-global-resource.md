---
status: accepted
---

# 将 `@font-face` 作为不可拆全局资源支持

GSS-l 首期支持 `@font-face`。Font-face block进入全局 resource registry，descriptor和 `src` fallback顺序完整保留，不拆为 declaration atom；font family名称保持全局，不做 Module-local rewrite，以便跨 Module引用。

## Consequences

- 完全相同的 canonical face去重；同 family 的不同 weight、style、stretch、unicode-range等 face正常共存。
- 相同 face selection signature但资源定义冲突时返回 diagnostic，不用 registry到达顺序选择。
- `url(...)` 进入 dependency graph，由 Adapter负责 rebasing、asset emission 和缓存。
- Resource registry提供引用计数、Module replacement/removal、稳定 resource-key 输出和 manifest source映射。
- 普通 `font-family` declaration继续作为 atom；family value保持 authored global名称。
