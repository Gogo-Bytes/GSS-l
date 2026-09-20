---
status: accepted
---

# Root 外的样式文件使用 project-relative logical identity

允许通过相对 import、alias 或 symlink 引用 Vite project root 外的 `.gss`。Host 将 root 和 source canonicalize，Compiler 使用相对 project root 的 logical id（例如 `../shared/Card.gss`）生成 Module-owned names，而不是拒绝 root 外文件或把绝对路径编码进输出。

## Consequences

- Physical id 继续作为 virtual JS 映射、ScopeSchema lookup、transaction 和 last-known-good 的 key；logical id 只承担稳定的 Module identity。
- 工作区整体移动但 app/shared 相对布局不变时，Module-owned CSS、keyframe names 和 JavaScript 保持一致；改变相对布局可以改变 identity。
- 路径转换是 framework-agnostic 的纯字符串操作；文件读取、realpath、alias 和 symlink resolution 留在 Vite Adapter。
- 无法表达相对路径时（例如不同 Windows drive 或 UNC share），按 fail-closed 原则返回 diagnostic，不退回 absolute identity。
- 本决策不扩大 Vite 的文件访问权限，也不新增 filesystem allowlist API。
