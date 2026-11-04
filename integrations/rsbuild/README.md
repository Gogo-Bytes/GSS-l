# Rsbuild 集成（有限接入阶段）

`css-isolation.ts` 使用 Rsbuild 2.3.0 的公开 `modifyBundlerChain` post hook，按 `CHAIN_ID.MINIMIZER.CSS` 取得已经合并的原生 minimizer options，插入 GSS 专用实例并从普通实例排除 GSS CSS。targets、用户 feature flags 等沿用宿主；没有第二份 Browserslist 或 targets 配置。开发／CSS 压缩关闭时不创建 minimizer。`modifyHTMLTags` 保持普通 stylesheet 在前、聚合 GSS 在后；loader、主构建与错误恢复仍由 Rspack 核心负责。

当前仅支持已核对的单个标准 CSS minimizer。宿主 chain 显式替换该实例或配置多实例时明确失败，避免漏掉后续 logical lowering。任意 `tools.rspack` 后置修改、其他处理器、注入样式模式及 SSR 不在本切片证明范围。不要通过读取 plugin 私有字段或复制 Rsbuild 配置合并算法来扩大范围。

已导出 `pluginGss({ adapter })`，组合本模块与 Rspack 的公开 `gss`。`@gss-l/rspack/internal/css-isolation` 仅供两个同步版本的 workspace 包互通，不是用户配置 API。基础相对资源 IO 已连接；通用类型入口已提供，完整外部宿主消费仍需接续。

回归使用真实 Rsbuild 构建，覆盖压缩启用／关闭、共享双入口、GSS 原生逻辑属性、普通 CSS 与未安装 GSS 的独立宿主构建逐字一致。关闭压缩是必要反例：生产 minimizer 会掩盖 loader options 丢失，不能仅测压缩产物。默认 React HMR 的独立浏览器证据及设计决策见 [架构文档](../../docs/ARCHITECTURE-DIRECTION.md)。


```ts
import { pluginGss } from '@gss-l/rsbuild';
import { react } from '@gss-l/react';
// rsbuild.config.ts；保留原有 pluginReact() 和宿主配置：
// plugins: [pluginReact(), pluginGss({ adapter: react() })]
```

不需要调用 minimizer helper 或填写第二份 targets。当前版本固定 Rsbuild 2.3.0；包未发布。公开入口已用于真实双入口构建与默认 React dev server；继承 Rspack README 的资源／提取 CSS／类型声明及外部消费边界，不宣称所有宿主配置已支持。


TypeScript 项目直接依赖 `@gss-l/types`，在环境声明文件中使用 `/// <reference types="@gss-l/types/client" />`，或在 tsconfig 的 types 中加入该入口。它仅声明 `.gss`，不提供 Vite 虚拟 URL。现有 scope 类型、字符串用法与动态路径边界不变；声明不会执行任何运行时加载。


2026-11-04 已通过已选版本的 workspace 外 tarball 消费；类型、生产双入口及浏览器范围、Rsbuild 开发更新证据见 [消费报告](../../docs/RSPACK-RSBUILD-CONSUMPTION.md)。此记录覆盖此前外部消费待验项的有限范围，不扩大自定义配置或资源语法保证。
