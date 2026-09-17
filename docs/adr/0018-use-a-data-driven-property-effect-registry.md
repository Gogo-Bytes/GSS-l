---
status: accepted
---

# 使用数据驱动 property-effect registry

GSS-l 使用版本化、数据驱动的 property-effect registry 描述 shorthand 写入的 longhand effect slot，并在 export 内消除 loser、为剩余 atom生成全局 property order。Declaration value 默认保持 opaque，不因识别 shorthand 而展开 `var()` 等值。首期无法证明的 property relation 不猜测或 warning 后原子化，而是返回 diagnostic。

## Consequences

- Registry 覆盖标准 box、border、background/mask、typography、layout、alignment、overflow、list、animation/transition 及其他已登记 shorthand family；关系不散落在条件分支中。
- Authored 顺序为 longhand 后接覆盖它的 shorthand 时删除 loser；shorthand 后接 longhand 时保留二者并保证 shorthand-before-longhand。
- 可能映射到同一 used side 的 logical/physical property 混用首期报错，例如 `margin-left` 与 `margin-inline-start`；未来只有具备足够 writing-mode 证明时才放宽。
- `all` 按规范记录 effect 及 custom property、`direction`、`unicode-bidi` 等例外；custom property 继续由 ADR-0007 独立处理。
- Unknown property effect、known-but-unimplemented shorthand 和未登记 vendor property 首期报错；标准兼容前缀由 browserslist transformer生成。
- 每个 family 需要表驱动的正反 authored-order、importance、opaque value 和浏览器 computed-style oracle 测试。
