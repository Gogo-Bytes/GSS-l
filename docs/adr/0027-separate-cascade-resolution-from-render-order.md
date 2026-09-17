---
status: accepted
---

# 分离 cascade resolution 与 deterministic render order

GSS-l 采用接近原生 CSS 和主流原子框架的 precedence：在 author origin 内先按 importance/cascade layer band，再按 selector specificity，最后用稳定的 semantic source-order vector `[registered condition rank, relation rank, property-effect rank]` 处理原本依赖 order-of-appearance 的等优先级候选。Winner resolution 与物理 CSS 排序是两个 domain service；canonical identity只稳定输出，绝不充当 winner。

## Consequences

- Normal layer按配置由早到晚增强，unlayered normal最高；important declaration使用 CSS 规定的 layer reversal，unlayered important低于 layered important。
- Specificity保留浏览器语义，包括 `:where()` 零 specificity和 pseudo-element type specificity；输出顺序不模拟 specificity。
- 完整 registered at-rule condition context拥有明确 rank；condition rank先于 relation/property source-order rank，使已注册 responsive/theme override能够覆盖 base effect。
- 同 condition 下，可证明更窄的 relation拥有更高 relation rank；不可比较且可共存的冲突报 diagnostic。
- Property-effect rank最后处理 shorthand/longhand overlap，不给普通同 property不同 value建立 value/hash顺序。
- 只在已知必然同时匹配的封闭 target candidate set内使用 authored ordinal预先解析 winner；不把 Module source ordinal带入全局 registry作为偶然 precedence。
- `CascadeResolver` 输出 winner或 ambiguity，`RuleOrderPlanner` 只排序已证明安全的 rule。若结果依赖 canonical hash、registry插入或 worker完成顺序，视为 Compiler invariant failure。
