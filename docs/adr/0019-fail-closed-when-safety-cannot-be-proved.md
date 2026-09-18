---
status: superseded by ADR-0031
---

# 无法证明安全时 fail closed

GSS-l 尽量覆盖普通 CSS，但首期对无法证明 cascade、property effect、selector ownership 或输出顺序安全的输入返回 error diagnostic，不自动降级为 scoped/preserved CSS。只有已经正式建模的 contextual/residual/global selector、browserslist 物理兼容展开，以及 ADR-0003 规定的未注册 condition warning 例外可以继续输出。

## Consequences

- Unknown/unsupported property effect、无法建模的 selector、危险组合和不受支持的 scope escape 均明确失败，并给出改写或升级 metadata 的建议。
- Compiler 不提供自动 `preserve`、`raw`、`ignore` 或整块 scoped fallback；因此构建成功代表输入处于明确支持边界内。
- Contextual atom不是 fallback：`>`、`+`、`~`、ancestor state、`:has()` 和已支持 residual selector 都有正式 identity、marker 与 precedence 语义。
- Browserslist transformer把一个 semantic atom扩展为多条兼容 declaration，不改变其不可拆 identity。
- 未来若真实项目出现无法改写的必要场景，可以单独设计显式 opt-in preserve capability；它必须进入 manifest/report、限制 scope，并记录启用原因，不能由 Compiler 静默选择。
