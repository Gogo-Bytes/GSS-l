# 现有宿主支持清单

2026-11-04 阶段收尾，代码基线 `eb47522`，整理前文档基线 `f5dcc01`。这是现有能力、配置与证据的统一索引，不是增加支持范围的承诺。四个宿主指 Vite、Rspack、Rsbuild、webpack；Rsbuild 复用 Rspack 核心但单独有配置桥接与消费证据。所有 GSS 包仍为本地 0.0.0/private，未公开发布。

## 配置与版本

下表区分 package.json 的 peer 契约和实际运行版本；版本范围不是逐版本测试证明。React/SWC、CSS/HTML 与资源配置仍由宿主提供。

| 宿主 | 公开入口与配置要求 | 版本及配套 |
| --- | --- | --- |
| Vite | `gss({ adapter: react() })`，与现有 Vite React 插件组合；返回 Plugin[]，标准 plugins 数组用法兼容。虚拟 CSS 由集成管理 | peer `^7.0.0 \|\| ^8.0.0`；workspace 7.3.6；外部 Vite 8.3.5 + plugin-react 6.1.2 的指定模板已验 |
| Rspack | `gss({ adapter: react() })` + `...gssCssMinimizers(existingOptions)`；保留原生 SWC/CSS/HTML/asset rules 和 JS minimizer | peer/实测 @rspack/core 2.3.0；标准原生 CSS 提取和 Lightning CSS 处理 |
| Rsbuild | `pluginGss({ adapter: react() })`，保留 `pluginReact()`；薄封装自动连接 CSS/HTML，无需手配 minimizer helper | peer/实测 @rsbuild/core 2.3.0；外部 plugin-react 2.1.1 |
| webpack | `gss({ adapter: react() })` + `...gssCssMinimizers(existingOptions)`；标准 CSS 提取与 HTML 插件；开发 `[name].css`，生产可 `[name].[contenthash].css` | peer/实测 webpack 5.112.2、HtmlWebpackPlugin 5.6.8；实测 MiniCssExtractPlugin 2.10.2、css-loader 7.1.5；helper 使用 CssMinimizerPlugin 8.0.0、Lightning CSS 1.33.0 |

各源码 Adapter 均显式传入 `@gss-l/react`，保留外部 `.gss` 与当前 scope 引用语法。消费项目直接声明宿主集成、React Adapter、types 和宿主依赖。通用类型入口为 `@gss-l/types/client`；Vite 原 `@gss-l/vite/client` 继续兼容并额外声明 `virtual:gss.css?url`。其他宿主没有这个虚拟 URL。

Rspack/webpack helper 沿用宿主同一份 CSS options/targets，Rsbuild 读取有效宿主配置；不增加 GSS targets。只有 GSS CSS 禁止逻辑属性降级，普通 CSS 保持宿主行为。webpack helper 限定 Lightning minify，不能拿 Rspack options 直接替换；HtmlWebpackPlugin 必须使用同一 peer 实例（hooks 的 WeakMap 属于包实例）。这些要求不外推为 Vite 同样具备该 helper。

详细配置：[Vite 模板](VITE-TEMPLATE-ACCEPTANCE.md)、[Rspack](../integrations/rspack/README.md)、[Rsbuild](../integrations/rsbuild/README.md)、[webpack](../integrations/webpack/README.md)。根 package.json 声明 Node >=20.19.0；外部证据多使用 22.22.3，指定 React Router 8.5.0 验收要求 >=22.22.0，不能用根 engines 替代各宿主/框架要求。

## 能力与证据范围

“通过”仅指对应载体和版本，不代表所有配置/浏览器；“未验证”是证据边界，不是自动待办。

| 项目 | Vite | 原生 Rspack | Rsbuild | webpack |
| --- | --- | --- | --- | --- |
| 生产与 CSS 交付 | workspace 及外部模板；static/lazy、HTML/CSS URL、资源 | 双 HTML 入口共享 GSS CSS、原生链/资源 | 双入口，压缩开/关普通 CSS 原生对照、资源 | 双入口，普通 CSS 原生对照、GSS-only 隔离、资源 |
| 开发与失败恢复 | 既有 dev/LKG/恢复与外部模板证据 | 原生 watch/处理器依赖恢复；早期手动 HMR 探针 | 默认 dev server 的浏览器更新、资源 bytes、overlay/LKG/恢复 | 原生 dev server + 显式 accept 的无整页刷新更新、资源/overlay/恢复；watch 依赖清理 |
| React 状态保持 | 依现有具体报告；class mapping 变化可能 reload，不承诺通用保持 | 不把 watch/手动 HMR 当 Fast Refresh | 默认 React 插件更新通过，不外推所有 state/边界 | 原生 accept 通过；未形成 Fast Refresh/state 保持保证；无接收边界可自动刷新 |
| 外部包消费 | 四包 tarball 官方 React TS 模板/指定 Router | 旧五包基线的类型、生产与两个 Chromium 页面 | 旧五包基线的类型、生产、页面及默认 dev 更新 | 新五包（含公共准备）的 strict 类型、生产页面、dev 更新 |
| 路由/SSR | 指定 React Router Declarative 与 Framework SSR、Chromium；非通用框架保证 | 未验证 | 未验证 | 未验证 |
| 诊断/map | 原有 loc/frame 与映射；SSR/模板按专项范围 | Compiler 原始声明范围保留；宿主 CSS map 接受规则级 | 同左；不宣称 overlay 所有位置精确 | 保留原始诊断；最终 map 已查 sources/content，未逐位置证明 |
| 目录别名 | 按既有 Vite 证据，不借用 webpack 结论 | 不借用 webpack 修复结论 | 不借用 webpack 修复结论 | 稳定符号链接 context 的生产/完整 watch 已修复并验证；运行中重定向未验 |

## 验证账本与恢复入口

本轮整理没有重跑产品测试或浏览器。最近产品验证为 `eb47522` 的完整 verify **2569 项**及 lint/build/types；verify 不包含浏览器 gate。

| 基线/阶段 | 可追溯证据 | 能证明什么、不能证明什么 |
| --- | --- | --- |
| `eb47522` webpack 路径修复 | `artifacts/webpack-linked-context/`：red、green、watch、verify、browser-production、browser-dev 日志 | 显式目录别名的原生对照与 GSS 修复；完整 verify 2569；现有 Chromium 生产/dev。不是其他宿主符号链接验收 |
| `a0e3610` webpack 公开入口 | `artifacts/webpack-public/`：verify-delivery、production-peer、dev-peer、external、external-types、external-dev；external-path.txt | 2568 项；公开入口与仓库外五包消费。首次双 HTML 插件副本失败保留；外部 dev 使用原生 accept |
| `c63199e` / `d422296` 宿主边界 | `artifacts/host-preparation-boundary/`；[公共准备契约](../integrations/shared/README.md) | 两个算法共享，生命周期独立；webpack snapshot 依赖恢复。四包外部核对仅解析/准备调用，不替代完整 Rsbuild 复验 |
| `c62532a` 打包导出修复 | `artifacts/package-boundary-audit/`：before、after、tests；check.py | 八个产品 tarball 的 20 个导出目标存在，公共准备 20 项；不是八包全部运行时消费矩阵 |
| `9a0f30f` Rsbuild/Rspack 外部基线 | [外部消费报告](RSPACK-RSBUILD-CONSUMPTION.md)，`artifacts/external-host-consumption/` | 两宿主生产/类型/四个 Chromium 页面；默认 dev 证据属于 Rsbuild。该报告早于公共准备包提取，不冒充当前六包外部完整复验 |
| `405f736` 资源交接 | `artifacts/asset-url-boundary/`，Rspack README 资源解码边界 | 百分号双解码 red/green、2566 项及资源更新；宿主输出文件名的原生 URL 限制另记 |
| Vite 外部模板/路由 | [模板报告](VITE-TEMPLATE-ACCEPTANCE.md)，`artifacts/vite-template/2026-10-26T09-05-50.220Z/` | Vite 8.3.5、React 19.3.1、指定 Router 的 Chromium 有界路径；不是本次新验收 |
| Vite Framework SSR | [SSR 报告](FRAMEWORK-SSR-ACCEPTANCE.md)，`artifacts/framework-ssr/2026-10-26T09-05-07.674Z/` | React Router 8.5.0、请求级 SSR、无 JS 样式/资源、hydration、负对照；不覆盖任意 streaming/server graph |
| 核心浏览器历史 | [历史浏览器证据](STATUS-HISTORY.md#浏览器证据) | 独立 oracle 125 fixtures/1267 comparisons/38 controls 及指定三引擎排序检查；Firefox Article 历史失败不因此通过 |

artifacts 为本机忽略目录；历史日志、独立 oracle 与首次失败需保留，Git 文档不等于完整证据已上传。外部临时目录按报告中的 root.txt/external-path.txt 恢复；旧 worktree/stash 备份位置见 [本机恢复记录](STATUS-HISTORY.md#本机交接与证据恢复)。重跑会改 fixture 的脚本应顺序执行并另存新日志；版本、环境、脚本事实以专项报告和实际入口为准。

## 已接受限制与当前政策

- CSS 排序保持原生强度/上下文及已证明语义优先；同语义高度逻辑先、物理后。同属性 atomRank 与跨属性 orderSlot 分离；未安全展开 shorthand 保持既有源码覆盖。范围详见 [排序设计](PROPERTY-ORDER-DESIGN.md)。
- unknown effect 的 preserved/error 与现有 fallback 不放宽；不承诺通用无效 CSS 兜底。跨模块同节点统一优先级未支持，保留 GSS2107 非阻塞诊断；动态引用/alias 保持既有静态分析边界。
- `.gss` 删除不属当前支持契约；文件修改、非法输入保留及恢复仍需正确。Rspack/Rsbuild/webpack 已接受任何编译错误均不发布本轮产物的策略。
- 新宿主标准 CSS 提取配置之外的 style 注入、多 minimizer、任意后置处理器、纯 hash CSS 文件名和通用 SSR 不在保证内。普通 CSS 的后处理不能悄然改成 GSS 规则。
- 特殊资源 URL、root/publicDir 与自定义 resolver 依专项范围，不承诺任意组合；规则级最终 CSS map 的接受不意味着放弃 Compiler 原始诊断范围。
- Parcel 与更多宿主/框架暂停；性能与 Firefox Article 历史问题继续暂缓；包发布、release/tag 需另行授权。Fast Refresh 和更精确 overlay 只是候选，不是已批准待办。

## 维护入口

当前工作仅为已支持契约内的具体问题修复、必要回归与文档维护。新发现先保留反例再归因；没有反例时不从“未验证”自动扩矩阵。当前计划见 [NEXT-STAGE](NEXT-STAGE.md)，宿主专属决策维护在对应模块 README，语义决策维护在原权威设计文档。
