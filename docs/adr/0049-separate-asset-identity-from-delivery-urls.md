---
status: accepted
---

# 将 Asset identity 与部署 URL 分离

CSS/font URL 的解析与输出由 Vite Adapter 负责。相对 URL 以所属 `.gss` 为基准解析，Asset identity 使用稳定 logical id，与部署 base、输出 hash 和绝对 checkout 目录分离；否则不同目录下同名 URL 会被错误去重，或者部署变化会改变语义名称。

## Consequences

- Adapter 负责文件读取、watch、URL rebasing、资源输出和缓存；Compiler 不访问文件系统，也不依赖 Vite 或 React。
- 本地资源默认独立 emit，第一版不自动 inline；已有 `data:`、远程 URL 和 `#fragment` 保留。
- 根路径 URL 按 Vite `publicDir` 处理；query/fragment 保留。
- 缺失本地资源使当前操作失败。Dev 保留 last-known-good CSS，production 构建失败，不静默留下失效 URL。
- 资源解析必须在提交相应 Module contribution 前成功；不得先提交错误的 URL identity，再异步修补已发布的 CSS。
- 不新增 `gss()` 配置项，不改变 React Adapter 接口。Compiler 与 host 之间的具体 Asset reference 协议需单独确认，不能将文档中的 `AssetResolverPort` 占位视为已冻结的接口。

本 ADR 冻结产品语义，不表示 URL 接线已经实现。
