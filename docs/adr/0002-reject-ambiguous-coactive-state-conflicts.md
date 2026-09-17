---
status: accepted
---

# 拒绝可共存状态中的歧义 property 冲突

GSS-l 不为 `hover`、`focus`、`focus-within` 等状态定义一套替代 CSS 的全局隐式优先级，也不依赖中央 registry 的 rule 顺序决定 winner。当同一 target 上两个能够同时成立、specificity 与 importance 等优先、且为同一 property 给出不同值的状态规则没有明确 winner 时，Compiler 返回结构化 diagnostic，要求作者把条件改为互斥 selector或显式声明交集状态的 winner。普通、互不冲突或由 specificity 明确决定的状态仍可编译为 self/group/peer contextual atom。

## Consequences

- `.father:hover .son { color: red }` 与 `.father:focus-within .son { color: blue }` 在缺少进一步语义时视为歧义，而不是按生成 CSS 的偶然顺序选择结果。
- 作者可以通过 `:not(...)` 使状态互斥，或增加 `:hover:focus-within` 等交集规则明确 winner。
- Compiler 需要保守建模状态是否可能共存、property effect、specificity 和 importance；无法证明互斥时按可能共存处理。
- 该决策优先保证可解释性和确定性，不以兼容普通 CSS 中所有依赖 source order 的写法为目标。
