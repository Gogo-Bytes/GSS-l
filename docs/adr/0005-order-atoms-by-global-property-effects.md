---
status: accepted
---

# 使用全局 property-effect order key 排列 shorthand 与 longhand atom

GSS-l 在单个 export 内先按 authored declaration 顺序和 property effect 删除确定的 loser，再把剩余 shorthand/longhand 注册为独立 atom。中央 registry 不使用首次注册顺序决定物理 CSS 位置，而是根据全局固定的 property-effect order key 排序：影响范围更广的 shorthand 位于更具体的 longhand 之前，例如 `margin < margin-inline < margin-left`。因此早已被其他 Module 注册的 longhand 也会在最终 stylesheet 中被重新定位到对应 shorthand 之后。

## Consequences

- Exact-property 冲突必须在 registry 前解析，不能同时返回两个值不同的同 property atom并依赖全局顺序。
- Authored longhand 后接 shorthand 时，前面的 longhand 若被完全覆盖则不会进入该 export；这不会形成与全局 shorthand-before-longhand 顺序相反的要求。
- Registry 的注册、class name 分配和最终 CSS 排序相互分离；production 需要全局 census/finalize，dev/HMR 使用单一有序 snapshot，不能 append-only。
- Property-effect graph 和 order key 是 Compiler 语义的一部分；无法安全建模的 property 关系不能猜测为互不冲突。
- 普通 opaque shorthand value（包括未证明类型的 `var(...)`）默认保持原声明，不通过字符串拼接展开；只有具备静态证明且有体积收益时才允许额外 lowering。
- CSS code splitting 必须继续保持全局 order key；若 Adapter 无法保证跨 asset 顺序，需要中央 atomic asset、稳定 cascade layer/order bucket 或受控重复等后续方案。
