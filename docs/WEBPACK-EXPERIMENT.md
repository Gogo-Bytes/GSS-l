# webpack 5 有界接入实验（2026-11-04）

## 结论与授权

Owner 已批准 React + webpack 5 + MiniCssExtractPlugin + HtmlWebpackPlugin 的最小实验。基于 `27807b8`，主构建 `finishMake + addEntry` 在该组合下可运行：生产双入口、普通 CSS/GSS 顺序、资源、开发更新与错误恢复通过。没有修改 Compiler、排序、fallback、React 作者语法或新增 targets 配置，也没有交付公开 webpack 包。

本轮实验文件位于忽略目录 `artifacts/webpack-experiment/`，不属于已发布产品。使用仓库已构建 Compiler／React Adapter；不是 workspace 外 tarball 消费。当时尚未确定正式架构与公开 API；当前状态见文末实现入口。

当前补充：公共准备模块已按 owner 后续边界要求迁入 `integrations/shared`。实验 prepare.py 改为直接引用该包 dist，不再从 Rspack 复制两个准备模块；最新复验见 `artifacts/host-preparation-boundary/`。下述首次实验结构与日志作为历史证据保留。

## 实验结构

`prepare.py` 复制现有 Rspack dist 中 source-preparation、candidate-snapshot、source-loader、aggregate-loader、publication、stylesheet-io、main-compilation。只将宿主原语改为真实 `compiler.webpack`，虚拟文件使用 webpack-virtual-modules；未伪造 `compiler.rspack`，未引入独立 compiler。该复制只用于证明，不建议作为正式双份实现长期维护。

主构建仍负责模块图、CSS loader、资源输出与更新；不可变聚合 CSS/map payload 经 addEntry 进入 css-loader + MiniCssExtractPlugin。原生 splitChunks 共用 `gss-l` CSS，HtmlWebpackPlugin hook 复用纯标签排序函数，使普通 CSS 在前、GSS 在后。

生产采用 CssMinimizerPlugin 的 Lightning CSS minify，普通 CSS 和 GSS 使用同一份宿主 targets；仅 GSS 排除 LogicalProperties。开发没有配置 Lightning 转换 loader，不能外推为任意开发 PostCSS/兼容处理链均已验证。旧 Safari targets 只作为暴露降级问题的对照，不是新增旧浏览器支持承诺。

## 固定版本

Node 22.22.3；webpack 5.112.2、webpack-dev-server 5.2.7、mini-css-extract-plugin 2.10.2、html-webpack-plugin 5.6.8、css-loader 7.1.5、css-minimizer-webpack-plugin 8.0.0、webpack-virtual-modules 0.6.2、lightningcss 1.33.0、swc-loader 0.2.7、@swc/core 1.16.21、React/ReactDOM 19.2.0。精确依赖与安装锁在实验目录 package.json/package-lock.json；浏览器使用仓库现有 Playwright Chromium。

## 验证与限制

| 证据 | 已证明的范围 |
| --- | --- |
| `production-fixed.log` | 两个真实 HTML 入口均为 GSS 红色、margin-left 2px；普通 CSS 对照经 targets 降级为 1px；GSS link 最后且两入口共用；相对 SVG 的红色 bytes 可获取，无 pageerror |
| 同上 | 最终 CSS map 包含原 `.gss` 文件与 sourcesContent；没有核对每个生成位置，不承诺声明级映射精度 |
| `dev-delivery.log` | GSS 红→蓝、left 2→4；普通 CSS 更新 outline 后 GSS 仍胜出；SVG bytes 红→蓝；GSS 语法错误 overlay 与上一发布对象/页面蓝色保留；同输入恢复后再改红通过；lazy 移除后从发布候选消失 |
| `dev-accept.log` | 在入口用 webpack 原生 `import.meta.webpackHot.accept('./App', ...)` 接收组件更新，上述 GSS 更新、错误恢复及再编辑通过；到这些检查结束没有整页导航 |

默认示例没有 Fast Refresh/模块接收边界，`dev-delivery.log` 实际记录三次导航，属于 dev server 自动刷新；不能称为 React 状态保持。原生 accept 实验只证明热更新通路，不是 Fast Refresh 或组件 state 保持验收。lazy 移除验证的是发布集合，不是卸载已经执行的 JS 模块。两个生产入口共用相同业务入口源码，未覆盖互斥路由样式。

原生 NoEmitOnErrorsPlugin 沿用“任何编译错误保留上一成功版”的已确认策略；本轮实际注入的是 GSS 语法错误。任意 PostCSS 依赖/失败、非 GSS JS 错误、持久缓存、所有 resource URL、自定义 minimizer、SSR、style-loader、Module Federation、CRA、外部包消费均未验收。未重复既有全仓 verify 或三引擎排序；本轮产品代码未变。

## 保留的失败与修正

- `production.log`：构建成功后探针读取 compilation asset Source，遇到 SizeOnlySource。修正探针，从真实输出文件读取 map；没有产品改动。
- `dev.log`、`dev-trace.log`：开发 CSS 使用 `[name].[contenthash].css` 且 output.clean=true，更新时浏览器请求旧 GSS CSS URL，收到 HTML MIME 错误，页面未变蓝。不能将该配置判为通过，也不能据此推断所有 hash 命名均失败。
- 将开发 CSS 文件名改为 `[name].css` 后 `dev-stable.log` 通过；生产保留 contenthash。`dev-delivery.log` 额外记录导航，揭示默认更新会整页刷新。`dev-accept.log` 使用宿主原生接收边界进一步证明无整页刷新更新；GSS 没有添加自定义浏览器 runtime。

复现（在仓库根目录；先确保仓库 dist 已构建，实验脚本会重写自身 fixture）：

```sh
npm ci --prefix artifacts/webpack-experiment
python3 artifacts/webpack-experiment/prepare.py
node artifacts/webpack-experiment/production.mjs
node artifacts/webpack-experiment/dev.mjs
node artifacts/webpack-experiment/dev-accept.mjs
```

这些脚本使用同一 fixture，必须顺序运行。失败日志保留，恢复命令不会覆盖既有日志。artifact 未进 Git，恢复依赖当前工作区保留；版本与结论在本报告留档。

## 当前实现入口

上述为首次实验事实；后续正式集成、共享边界与公开 API 已交付，当前以 [webpack 模块契约](../integrations/webpack/README.md)、[公共准备边界](../integrations/shared/README.md)和 [宿主支持清单](HOST-SUPPORT.md)为准。原实验后的推进建议已被这些实现替代，不再作为待办。
