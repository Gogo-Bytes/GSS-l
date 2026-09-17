---
status: accepted
---

# 不分析或管理消费侧 class 组合

GSS-l 只编译 `.gss` Module 自身声明的样式语义和生成的 `styles` 导出，不分析、改写或约束消费代码中的 `cx()`、字符串拼接、`props.className` 或其他外部 class。正确性保证覆盖单个 GSS export、已声明的 style branch 及其 root/target token；用户把多个 export 或外部 class 同时挂到一个元素后产生的冲突属于调用方行为，按浏览器 cascade 执行，不在 GSS-l 保证范围内。

## Consequences

- Compiler 不提供 `gssCompose` runtime，也不分析消费侧 class composition。构建 Adapter 可以按 ADR-0008 解析调用点，仅用于把已知 GSS style-scope reference 降低为 class string；该 lowering 不参与冲突或 winner resolution。
- `cx(styles.a, styles.b)` 即使两个值都来自 GSS，也不触发跨 export winner resolution；相关组合若需要保证，应在单个 GSS style branch 内表达。
- `props.className`、第三方 class 和全局 stylesheet 不进入 GSS manifest、conflict analysis 或 computed-style parity 承诺。
- 调用方同时使用互相冲突的 branch/target token，或违反 branch ownership 契约，视为保证范围外的用户行为。
