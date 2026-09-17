---
status: accepted
---

# 支持 selector list，并展开为独立 RuleIR branch

GSS-l 首期支持逗号 selector list。Parser/normalizer 将每个 complex selector 展开成共享 declarations、source range 和 authored ordinal 的独立 RuleIR branch；每个 branch 单独计算 path、specificity、condition 与 relation identity，但 selector list 中的位置不表示 precedence。

## Consequences

- `.button, .link` 可以分别导出并复用相同 pure atom；descendant、pseudo、runtime relation 和 residual branch 按各自语义规划。
- 所有 branch 必须通过 capability validation；任一 branch 不支持时整条 authored rule失败，不生成部分 CSS。
- Contextual marker/identity 不因两个 branch 的 declaration 相同而跨不同 relation错误合并。
- 展开后的 branch 保留同一 authored ordinal；后续 winner resolution 使用各自 specificity、importance、condition 和 relation，而不是 selector list顺序。
- Diagnostic 指向失败的 branch，同时说明整个 selector-list rule按 fail-closed 被拒绝。
