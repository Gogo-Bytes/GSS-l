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
- Compiler 协议与 Vite 生命周期实现分离。Vite production 已接入读取、watch、asset emission 和 URL rebasing；dev 已接入受文件权限约束的版本化字节 snapshot、资源 HMR 和 last-known-good 恢复。`gss()` 配置和 React Adapter 接口不变。

## Implementation notes

Dev 通过 Vite middleware 和 `send()` 提供内部资源 URL，而不让原生 CSS pipeline 再解析物理文件 URL：真实 dev 测试证明后者会自动 inline 小 SVG，并误处理文件名中的 `%23`。资源读取前用 `isFileLoadingAllowed(config, physicalPath)` 验证 requested/canonical paths，HTTP 响应前再次验证 Vite 文件权限；不把物理路径交给会截断 `#`/`?` 的 URL 权限检查接口。middleware 位于原生 host/CORS 检查之后。版本来自已验证的字节 snapshot，不参与 Compiler identity；失败时仍可提供已提交字节。当前实现仅短暂保留一个前序交付 generation 供 CSS link 切换，随后释放，server 关闭时清空。URL 形状和缓存保留窗口均是内部实现细节，不构成公共 API。
