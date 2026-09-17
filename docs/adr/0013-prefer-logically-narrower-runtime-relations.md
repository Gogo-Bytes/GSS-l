---
status: accepted
---

# 可证明包含时由更窄 runtime relation 获胜

GSS-l 为结构化 selector condition 建立逻辑偏序，而不使用首次注册或偶然 source order。若 condition A 必然蕴含 condition B，则 A 更窄，并在两者同时成立且修改同一 target/property 时优先；例如 direct child 高于 descendant、adjacent sibling 高于 general sibling、`child:hover` 高于 child。可共存但互不蕴含的等优先级 condition 继续按 ADR-0002 返回歧义 diagnostic。

## Consequences

- `.father .son` 与 `.father > .son` 同 property 冲突时，直接子元素稳定使用 `>` 的值，即使 authored order 相反；这是 GSS-l 的语言级 relation precedence。
- `.input + .label` 在相邻时高于 `.input ~ .label`；非相邻 subsequent sibling 只匹配 `~`。
- Base relation 低于增加 runtime state 的相同关系，例如 child 低于 `child:hover`。
- 可证明互斥的 condition 不需要 winner；可能共存但不可比较的 hover/focus、attribute/state 等冲突需要作者写互斥条件、显式交集或其他明确 precedence。
- `!important`、明确 specificity 和已注册 at-rule condition order 仍进入完整 cascade order；relation implication 不能覆盖更高 cascade origin/importance。
- Compiler domain 使用结构化 constraint 和 implication 判定生成稳定 order key，不从 selector 字符串或 registry 插入顺序猜测优先级。
