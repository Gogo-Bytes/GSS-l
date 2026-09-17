---
status: accepted
---

# Target path 累积所有必然匹配规则并预先解析 winner

一个已声明 style reference path 的 token 不只包含 exact selector 的 declaration，还累积所有能够证明在该 path 下必然匹配的更一般 selector。Compiler 在 export 规划阶段按 importance、specificity 和同 Module authored order 解析最终 winner，只把 winner atom放入该 target token；中央 registry 不再负责恢复这些 declaration 的 cascade。

## Consequences

- 对 descendant class path `.father .son .icon`，首期可累积 class path 为其有序子序列且终点相同的规则，例如 `.icon`、`.son .icon`、`.father .icon` 和 exact path。
- `styles.icon`、`styles.father.icon` 与 `styles.father.son.icon` 分别得到在各自已知结构下完成解析的完整目标样式。
- 同 property 的较弱候选不会同时作为 atom返回；specificity 相同的同 Module候选可以用 authored order 在编译期确定 winner。
- Compiler 只为 `.gss` 实际声明的 selector path 生成 reference，不根据可能的 JSX 嵌套自动创造未声明 path，避免组合爆炸和未经声明的结构假设。
- Child、sibling、compound、negative 或 functional selector 不能直接套用 descendant-subsequence 算法；它们需要后续 selector constraint model 给出独立的蕴含判定。
