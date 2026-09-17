---
status: accepted
---

# 首期拒绝 local-local compound class selector

GSS-l 首期不支持 `.button.primary`、`.card.selected` 等同节点 local class compound selector。Property chaining `styles.a.b` 始终表示 descendant class path `.a .b`，不承担 compound 语义。业务 variant 使用 `data-*`、ARIA、pseudo 或独立完整 style 表达；第三方和历史系统添加的 compound class 通过显式 `:global(...)` residual selector作为 escape hatch。

## Consequences

- `.button[data-variant="primary"]`、`.tab[aria-selected="true"]` 和 `.item:hover` 是首选状态表达，Compiler 可以把它们建模为同一 scope 上的 runtime condition。
- 相互独立且 property 不冲突的 style 可以由用户组合多个 export；组合行为和外部冲突继续属于 ADR-0004 的范围外行为。
- `.button.primary`、`.button.large.primary` 等 local selector 返回带改写建议的 diagnostic，不生成 `styles.button.primary`。
- `styles.button.primary` 无歧义地对应 `.button .primary`，简化 path lookup、类型生成和 ownership。
- `:global(.swiper-slide.swiper-slide-active)` 等外部 compound selector可以保留为 contextual residual；它不产生本地 style path。
- 如果后续真实项目证明 attribute/pseudo/global escape 无法覆盖重要场景，再把 local compound 作为显式 opt-in contextual feature重新评估，而不是默认开启。
