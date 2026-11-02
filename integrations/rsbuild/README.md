# Rsbuild 配置桥接（内部阶段）

`css-isolation.ts` 使用 Rsbuild 2.3.0 的公开 `modifyBundlerChain` post hook，按 `CHAIN_ID.MINIMIZER.CSS` 取得已经合并的原生 minimizer options，插入 GSS 专用实例并从普通实例排除 GSS CSS。targets、用户 feature flags 等沿用宿主；没有第二份 Browserslist 或 targets 配置。开发／CSS 压缩关闭时不创建 minimizer。`modifyHTMLTags` 保持普通 stylesheet 在前、聚合 GSS 在后；loader、主构建与错误恢复仍由 Rspack 核心负责。

当前仅支持已核对的单个标准 CSS minimizer。宿主 chain 显式替换该实例或配置多实例时明确失败，避免漏掉后续 logical lowering。任意 `tools.rspack` 后置修改、其他处理器、注入样式模式及 SSR 不在本切片证明范围。不要通过读取 plugin 私有字段或复制 Rsbuild 配置合并算法来扩大范围。

包仍无公开插件导出；本模块将由 `pluginGss` 组合，不是完整接入。`@gss-l/rspack/internal/css-isolation` 仅供两个同步版本的 workspace 包互通，不是用户配置 API。自动资源 IO 与最终公开入口仍需接续。

回归使用真实 Rsbuild 构建，覆盖压缩启用／关闭、共享双入口、GSS 原生逻辑属性、普通 CSS 与未安装 GSS 的独立宿主构建逐字一致。关闭压缩是必要反例：生产 minimizer 会掩盖 loader options 丢失，不能仅测压缩产物。默认 React HMR 的独立浏览器证据及设计决策见 [架构文档](../../docs/ARCHITECTURE-DIRECTION.md)。
