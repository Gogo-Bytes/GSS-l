---
status: accepted
---

# 只为运行时结构或状态关系生成双端 contextual marker

GSS-l 区分编译期 ownership descendant 与必须由浏览器判断的 runtime relation。普通 `.father .son` 继续按 ADR-0001 下推为 son 的纯 atom，并由用户遵守 target ownership；`.father > .son`、`.input + .label`、`.input ~ .label` 和 `.father:hover .son` 等结构或状态关系则保留 contextual selector，要求 source/root 与 target 两端都使用对应 style reference 才能生效。

## Consequences

- `.father .son` 的 `styles.father.son` 即使被错误挂在 mother subtree 也可能生效；这是调用方违反 ownership 契约，GSS-l 不分析或阻止。
- `.father > .son` 输出形如 `.fatherMarker > .fatherSonTarget`；缺少 `styles.father`、缺少 `styles.father.son` 或实际 DOM 不是直接父子时均不匹配。
- `.input + .label` 与 `.input ~ .label` 同理要求 source marker、target marker和真实 sibling 关系同时成立。
- 有界链 `.root .input + .label .icon` 与 `.root .input ~ .label .icon` 按 ADR-0010 保留完整 ownership path：source marker 落在 runtime source `input`，并按完整 `root.input` path 重复以保留 ownership specificity；后续 ownership 段分别保留 contextual/target marker，输出保留 runtime combinator 后普通 descendant 空格。只有 `input + label` 或 `input ~ label` 是 runtime relation；其后的一个或多个 descendant edge 是 ownership suffix，不参与 runtime implication。当前 Compiler 接受全 descendant leading ownership prefix、恰好一个已注册 adjacent/general-sibling edge，后接一个或多个 ownership-descendant edges；不由此推及 child edge、additional runtime edges 或其他 interleavings。
- `.father:hover .son` 要求 father marker、father runtime state、son target marker和 DOM relation同时成立；`.button:hover` 这类单节点 pseudo 只需要当前元素自己的 contextual atom。
- Contextual marker 使用完整 relation/path identity，不按 declaration value 与其他关系任意复用；普通 pure atom仍可按 declaration identity 全局复用。
- 用户故意组合不属于同一 ownership branch 的 reference 继续属于 ADR-0004 的保证范围外行为。
