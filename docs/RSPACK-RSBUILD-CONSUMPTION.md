# Rsbuild／Rspack 外部包消费核对

2026-11-04，以 `9a0f30f` 为产品基线，将 types、compiler、React adapter、Rspack、Rsbuild 五个 workspace 包分别 pnpm pack，在仓库外临时目录 npm install。全部 GSS 包解析到该目录的 node_modules，不通过源码 alias、workspace 链接或内部 dist 路径消费。包尚未发布。

## 已验证范围

| 项目 | 实际检查 |
| --- | --- |
| 类型 | TypeScript 5.9.3、strict、skipLibCheck=false；公开宿主配置、React TSX 与 `@gss-l/types/client` 通过 |
| Rsbuild | 2.3.0 + plugin-react 2.1.1，`pluginGss({ adapter: react() })`，标准生产提取 CSS |
| 原生 Rspack | 2.3.0，原生 SWC／CSS／HTML／asset rules，`gss` + `gssCssMinimizers`，生产构建通过 |
| React | React／React DOM 19.2.0；直接 `className={styles.card}`，通用声明不引用 Vite client |
| 实际页面 | 两宿主各两个 HTML；Chromium 中 React 成功挂载，无 pageerror，两个入口共享 GSS CSS 且后加载 |
| 排序与隔离 | GSS margin-left=2px；普通 CSS 仍经旧 Safari targets lowering 得 1px；同节点 GSS 红色覆盖普通 CSS 蓝色 |
| 资源 | 嵌套目录 SVG 相对引用、fragment、生产输出及实际 HTTP 请求通过 |
| 开发更新 | 外部 Rsbuild 默认 dev server：GSS CSS 红→蓝／边距更新、SVG bytes 更新、非法 GSS overlay／上一成功样式保留、同输入恢复及再次编辑通过 |

运行 Node 22.22.3。旧 Safari targets 用来触发宿主 lowering，实际页面在现代 Chromium 验证，不是旧 Safari 实机兼容保证。浏览器自动化使用仓库已有 Playwright，仅作为测试驱动；被测应用和 GSS／React／宿主依赖均来自外部安装。

## 最小消费形态

消费项目直接声明使用的宿主集成包、`@gss-l/react`、`@gss-l/types` 及宿主／React 依赖。此次安装所有五个本地 tarball，满足尚未发布的 workspace 包之间的版本依赖。

```ts
// env.d.ts；或将该入口放入 tsconfig compilerOptions.types
/// <reference types="@gss-l/types/client" />
```

```ts
// Rsbuild：保留现有 React 插件和宿主配置
import { pluginGss } from '@gss-l/rsbuild';
import { react } from '@gss-l/react';
// plugins: [pluginReact(), pluginGss({ adapter: react() })]
```

```ts
// 原生 Rspack：保留现有 SWC、CSS、HTML、asset rules 和 JS minimizer
import { gss, gssCssMinimizers } from '@gss-l/rspack';
import { react } from '@gss-l/react';
// plugins: [...existingPlugins, gss({ adapter: react() })]
// optimization.minimizer:
// [...existingJsMinimizers, ...gssCssMinimizers(existingCssMinimizerOptions)]
```

宿主仍决定 targets；没有 GSS targets 配置。原生 loader 与 minimizer 自身的目标配置按宿主方式设置。Rsbuild 自动读取有效配置，用户不调用 helper。

## 证据与恢复

本地证据在 `artifacts/external-host-consumption/`：

- `root.txt`：保留的 workspace 外项目路径；`consumer/` 保存最终源码、两个宿主配置、执行脚本、package.json／lock 和资源。
- 五个 `.tgz`、`evidence.json`：tarball SHA-256 和实际包解析位置；`dependencies.json`：安装的直接版本。
- `setup.py`／`setup.log`：打包、创建隔离项目、安装和类型检查；`typecheck.log` 为最终样例的再次类型检查。
- `build.log`：打包前全仓 build；`production-fixed.log`：两个宿主生产构建；`browser.mjs`／`browser.log`／`browser-result.json`：四个实际页面的独立字面预期。
- `dev.mjs`／`dev.log`：外部 Rsbuild 原生 HMR、资源更新和错误恢复；日志中的 GSS1001 是故意写入非法 CSS 的负例。

在 root.txt 指向的外部目录可执行 `node_modules/.bin/tsc -p tsconfig.json`、`node --experimental-strip-types build.mjs`、`node --experimental-strip-types dev.mjs`；后两者分别消费两个公开配置和默认 Rsbuild dev server。生产页面检查从仓库执行 `node artifacts/external-host-consumption/browser.mjs`。重新建立隔离项目可先运行 setup.py，再复制 consumer/build.mjs 与 dev.mjs 到新 root；浏览器脚本从 root.txt 读取新路径。dev 脚本中的 Playwright 路径属于当前机器的测试驱动，迁移机器时应指向该机器已有测试依赖。

首次生产检查失败保留为 `production.log`：样例写了 `styles.card + ' plain'`，触发既有 GSS2105 scope coercion 诊断。修正为支持的直接引用，普通样式用 `[data-probe]` 命中同一元素继续验证覆盖；没有放宽准入或修改产品。此后未发现新的产品缺陷。

## 保留边界

这是两个已选宿主版本、标准提取 CSS 与所列输入的有限消费证明。没有验证原生 Rspack 浏览器 dev server、其他浏览器、任意自定义 CSS 处理器／多 minimizer、纯 hash CSS 文件名、style 注入、SSR／库构建、所有 root/publicDir／URL grammar 或全部 resolver 组合。既有 Vite 与三引擎排序 gate 未重跑，不能将旧证据视为本轮新验收。

本轮产品代码未变，仅补消费证据和文档，因此没有重复全仓 verify；最近产品 verify 为 `9a0f30f` 的 2566 项及 lint/build/types。排序、fallback、targets 和发布授权边界不变。本轮外部消费目标已完成；未验证组合不是自动任务，下一项应由实际产品需求或可复现契约违反驱动。
