---
status: accepted
---

# 将 semantic reference CSS 作为正式测试能力

GSS-l 第一版提供独立 testing API `compileGssReference()`，生成保持 authored selector/cascade/declaration grouping 的 reference CSS与对应 style mapping，用于和 atomic输出在隔离浏览器环境中做 computed-style oracle比较。Reference能力不进入 production默认输出或 bundle。

## Consequences

- Reference renderer可以共享 parser、selector AST、source range和asset resolver，但不经过 winner pruning、atomic identity、property排序或 contextual atom planner，降低共同错误导致假通过的风险。
- Reference 与 atomic fixture使用相同 DOM/状态脚本和不同 class mapping；比较 touched properties、property-effect longhands、custom properties、pseudo-elements、state、condition、relation和 layer/important结果。
- 快速 CI覆盖 IR/CSS/manifest/reference snapshot；浏览器 CI覆盖代表性 oracle corpus，差异报告 selector path、state、condition、property、两侧值与 source range。
- Keyframe/animation优先比较静态 metadata和可稳定采样结果；font resource使用结构/manifest验证，避免平台字体渲染噪声。
- Testing API置于独立 testing seam/package，production compiler和React Adapter不依赖它。
- Pilot验收要求零未解释 computed-style difference。
