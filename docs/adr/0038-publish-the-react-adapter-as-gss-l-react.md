---
status: accepted
---

# 将 React Adapter 发布为 `@gss-l/react`

首期 React source Adapter 使用 `@gss-l/react` 作为公开 package 名称，对应 workspace目录 `packages/react`。该package负责React/JSX source analysis与lowering，但保持纯构建期职责；名称简洁不表示production需要GSS runtime，framework-agnostic Compiler Domain与`@gss-l/types`仍保持独立。
