---
status: accepted
---

# 只在 className 表达式中 lower GSS reference

React Adapter 不识别或分析 `cx`、`clsx` 或其他 class composition 函数的实现，只在 JSX `className` 表达式内部递归识别静态 GSS scope reference，并将其 lower 为 `.self`；所有非 GSS 表达式原样保留。动态 GSS path、无法证明的 scope provenance 和非 `className` 上下文不被猜测处理。

## Consequences

- `className={cx(styles.card, active && styles.active)}` 可以只改写为 `className={cx(styles.card.self, active && styles.active.self)}`。
- 外部 class、动态字符串和任意函数调用不由 Adapter 分析，GSS 不管理它们的 CSS 冲突。
- `styles[variant]`、`getStyles().card` 等动态或无法证明的 GSS path返回 diagnostic。
- 非 JSX `className`上下文仍要求调用方显式使用 `.self`，除非后续通过 ADR-0033定义的 scope provenance得到证明。
