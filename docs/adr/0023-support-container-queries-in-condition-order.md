---
status: accepted
---

# 支持 `@container` 并纳入项目 condition order

GSS-l 首期支持 size、named 和 style container query。Container condition 进入 atomic/contextual identity，并与 `@media`、`@supports` 共用项目级 registered condition-order 机制；未注册和未注册 compound condition沿用 ADR-0003 的 warning 与 precedence 无保证规则。

## Consequences

- `container-name`、`container-type` 等 provider declaration 按普通 property atom与 property-effect规则处理。
- Condition identity包含 normalized container name 与 query；style query 中的 custom property/value 保持 opaque并由浏览器判断。
- Nested `@container` 先经 CSS nesting normalization，再进入相同 target-path、winner 和 registry planning。
- 项目配置、缓存 key、manifest 和 report需把 container condition与 media/supports 一同记录。
- 本 ADR 将 ADR-0003 的 at-rule condition范围从 `@media`/`@supports` 扩展到 `@container`。
