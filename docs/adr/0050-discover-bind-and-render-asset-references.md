---
status: accepted
---

# 通过 discovery、binding 和 rendering 三步处理 Asset references

在 ADR-0049 的语义基础上，Compiler 提供 `discoverStylesheetAssets({ id, source })`，返回 CSS-decoded URL 列表和 diagnostics。Host 异步解析后，在 `replaceStylesheet()` 的可选 `assetReferences: [{ url, identity }]` 中提交稳定 logical reference identity；`finalize({ resolveAssetUrl })` 再同步获取部署 URL。这样无需把异步 IO 放进 Compiler，也不会让输出 hash/base 参与 atom 或 resource identity。

## Consequences

- `url` 是 CSS 转义解码后的 authored URL；`identity` 是 host 提供的不透明稳定引用标识，包含 query/fragment 的语义。Compiler 不读取资源，也不执行 URI/file resolution。
- Binding 在 contribution 提交前验证。空字段、未发现的 URL 或同一 URL 的冲突绑定产生 `GSS1501`，不改变已提交状态。
- Bound value 使用带类型的 identity 表示，在 class allocation 和 resource conflict detection 前生效；不得与恰好相同的 authored text 混淆，也不得对不透明 Asset identity 做 Unicode NFC 合并。
- 渲染中的 bound reference 缺少非空输出 URL 时明确失败；finalization 不修改已提交 contribution。Resolver 在每个 snapshot 内按 identity 缓存，CSS 与 manifest declaration value 使用一致的渲染值。
- Pure/contextual declarations、preserved blocks、keyframes、font-face 和 property registrations 使用同一协议。输出 URL 按 CSS string 规则转义，不生成可被 authored text 伪造的占位符。
- 无绑定的现有 Compiler 调用保持兼容，继续保留原始 URL 值并报告依赖。它们不自动解析本地资源；Host 必须完成 ADR-0049 规定的解析与失败检查。
- 本阶段只交付 Compiler 协议。Vite 的读取、watch、asset emission 和 URL rebasing 后续接线；`gss()` 配置和 React Adapter 接口不变。
