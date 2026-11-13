# GSS-l

GSS 的有限 MVP：框架无关的 CSS 编译核心，加上 React 源码适配器，以及 Vite、Rspack／Rsbuild 和有界 webpack 集成。当前实现覆盖编译会话、作用域映射、资源与源码映射，以及真实页面中的开发更新和生产输出。

现有四宿主阶段收尾已完成，当前维护既有能力并修复可复现问题，暂不扩展更多宿主或新能力。配置要求、实际版本、验证证据和限制统一见 [宿主支持清单](docs/HOST-SUPPORT.md)；进度见 [STATUS](docs/STATUS.md)，当前授权见 [NEXT-STAGE](docs/NEXT-STAGE.md)。有界验证不等于所有 CSS、框架或浏览器支持。

核心语义与职责见 [架构方向](docs/ARCHITECTURE-DIRECTION.md)和[排序设计](docs/PROPERTY-ORDER-DESIGN.md)。新 session 从 [HANDOFF](docs/HANDOFF.md) 接续，遵循 [AGENTS.md](AGENTS.md)；必要验证及本机恢复信息见 [证据入口](docs/VALIDATION-EVIDENCE.md)，过期过程文档通过 Git 历史追溯。

## 本地运行

需要 Node.js >= 20.19.0，使用仓库声明的 pnpm 版本。

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm verify
corepack pnpm playground
```

真实页面示例：

```sh
corepack pnpm task-board
corepack pnpm article
```

Playground 的 dev、构建、预览及类型检查由 `@gss-l/playground` 工作区负责；独立浏览器参考与验收脚本位于 `tests/`。

`verify` 包括 lint、build、单元测试和类型检查，**不包括浏览器验收**。其他脚本以根目录及 `tests/package.json` 为准；运行浏览器验收前先读 [验收边界](docs/STATUS.md#验收与已知边界)。

## TypeScript 声明

使用通用 `@gss-l/types/client` 声明 `.gss` 导入。在项目的环境声明文件中添加：

```ts
/// <reference types="@gss-l/types/client" />
```

也可以将 `@gss-l/types/client` 加入 tsconfig 的 `compilerOptions.types`。消费项目应将 `@gss-l/types` 声明为直接开发依赖；目前仓库包仍未发布，外部验证使用本地 tarball。

已有 Vite 项目可继续使用 `@gss-l/vite/client`，它引用通用声明并保留 Vite 专属 `virtual:gss.css?url`。Rspack／Rsbuild 不需要引用 Vite client。通用声明沿用现有 scope 类型，也不产生运行时代码。负责人已明确决定不做逐文件 scope 补全或拼写检查：未声明的 `styles.missing` 保持普通 JavaScript 的 `undefined`，不新增相关 warning/error。这不是待补能力，除非负责人主动改变决定，否则不重新提案；详见 [React 引用契约](docs/ARCHITECTURE-DIRECTION.md#react-引用与-typescript-契约)。

## 代码导航

| 位置 | 职责 |
| --- | --- |
| [compiler/src/domain](compiler/src/domain) | 属性效果、所有权／结构关系、模块内排序与原子标识；[模块设计入口](compiler/src/domain/README.md) |
| [compiler/src/application](compiler/src/application) | 编译会话、模块生命周期、资源与输出组织 |
| [compiler/src/public-types.ts](compiler/src/public-types.ts) | 当前编译器公共类型与配置契约 |
| [adapters/react/src](adapters/react/src) | React／JSX 分析和转换，包括跨模块组合诊断 |
| [integrations/vite/src](integrations/vite/src) | 开发更新、生产汇总、资源与宿主集成 |
| [types/src](types/src) | 作用域类型辅助 |
| [examples/playground](examples/playground) | 中文编译器、适配器及生命周期演示；沿用 `tests/` 中的独立参考及验收 |
| [tests/acceptance](tests/acceptance) | task-board、article 和排序验收 |
| [tests/browser](tests/browser) | 原生 CSS 对照及 Vite 宿主浏览器验证 |

官方 create-vite React TS 的 workspace 外 tarball 消费验收：`corepack pnpm vite-template:check`。已验证 Vite 8.3.5 与 React Router 8.5.0 Declarative／BrowserRouter 的有界 Chromium 客户端路由路径，workspace 仍保留 Vite 7；接入步骤与限制见 [模板验收](docs/VITE-TEMPLATE-ACCEPTANCE.md)。

React Router Framework Mode 的真实 SSR 外部验收：`corepack pnpm framework-ssr:check`。通过公共 `virtual:gss.css?url` 与框架正常 `links()` 连接 aggregate CSS；版本、接入步骤及 Chromium 有界范围见 [Framework SSR 验收](docs/FRAMEWORK-SSR-ACCEPTANCE.md)。

## 使用边界

这是有明确准入与 fallback 契约的实现，不是“任意 CSS 都能安全原子化”的承诺。普通场景使用独立编写的原生 CSS 对照；GSS 所有权／结构语义允许与原生 source order 不同，应使用明确的 GSS 预期。

React 中直接写 `<div className={styles.card} />`，子节点使用 `styles.card.title`。升级旧代码时，移除用于取当前节点字符串的 `.self` 后缀。样式表实际声明的 `.card .self` 仍通过 `styles.card.self` 访问。

同一模块的多个 scope 可以组合。不同模块在同一个节点上的优先级仍不受支持；React 适配器对可证明的组合发出非阻塞警告 `GSS2107`，不移除 class。

仓库尚未发布包；发布、release 和 tag 都需要单独授权。

Rsbuild／Rspack 的公开入口与 workspace 外 tarball 有限消费结果见 [新宿主消费报告](docs/RSPACK-RSBUILD-CONSUMPTION.md)，包含最小配置、TypeScript 声明、实际验证及保留边界；包尚未发布。
