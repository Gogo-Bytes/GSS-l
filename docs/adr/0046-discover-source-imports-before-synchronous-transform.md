---
status: accepted
---

# 先发现 source imports，再同步 transform

Framework Adapter 通过 `GssSourceAdapter` 暴露 `supports(id)`、同步 `discoverImports({ id, source })` 和同步 `transform({ id, source, resolveScopeSchema })`。Vite 在 discovery 与 transform 之间异步解析并按需编译 GSS dependencies，避免 TSX transform 早于 `.gss` load 时缺少 ScopeSchema；保留现有同步 resolver，不将文件系统或 Vite 异步生命周期带入 React lowering。

## Consequences

- Contract 位于 `@gss-l/compiler` 的公开 application ports，使用框架无关的 `ScopeSchema`、`SourceMapArtifact` 和 `SourceAdapterDiagnostic` 数据结构。
- `react()` 返回该 Adapter，复用现有 React source analysis 和 `transformReactGssUsage()`，不依赖 Vite。
- `discoverImports()` 返回原始 import specifier，不读取文件；Vite 负责解析为 canonical physical id。
- Compiler 或 source transform 的 error 阻止当前转换；warning 继续。Failed replacement 保留 last-known-good，但不能使用旧 schema 掩盖当前输入错误。
- `gss({ adapter })` 必须显式接收 Adapter；同一 session 服务按需编译与 virtual JS load。
