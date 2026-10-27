# GSS-l

GSS 的有限 MVP：框架无关的 CSS 编译核心，加上 React 源码适配器和 Vite 集成。当前实现覆盖编译会话、作用域映射、资源与源码映射，以及真实页面中的开发更新和生产输出。

有限 MVP、已选官方脚手架、客户端路由与有界 Framework SSR 实验已交付。当前正推进[核心工作流与架构方向](docs/ARCHITECTURE-DIRECTION.md)及[属性排序目标](docs/PROPERTY-ORDER-DESIGN.md)；目标尚未全部完成。进度与边界见[当前计划](docs/NEXT-STAGE.md)，不自行新增框架或验收场景。有界实验不等于所有框架／浏览器正式支持。

有限 MVP 的目标进度与本轮验证见 [MVP 进度](docs/MVP-PROGRESS.md)；当前交付状态、语义边界和已暂停事项见 [工作状态](docs/STATUS.md)。新 session 从 [接续提示词](docs/HANDOFF.md) 开始；协作规则见 [AGENTS.md](AGENTS.md)。这些文档是当前状态整理，不是恢复历史路线图。

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

`verify` 包括 lint、build、单元测试和类型检查，**不包括浏览器验收**。其他脚本以根目录及 `packages/testing/package.json` 为准；运行浏览器验收前先读 [验收边界](docs/STATUS.md#验收与已知边界)。

## 代码导航

| 位置 | 职责 |
| --- | --- |
| [compiler/src/domain](compiler/src/domain) | 属性效果、所有权／结构关系、模块内排序与原子标识 |
| [compiler/src/application](compiler/src/application) | 编译会话、模块生命周期、资源与输出组织 |
| [compiler/src/public-types.ts](compiler/src/public-types.ts) | 当前编译器公共类型与配置契约 |
| [packages/react/src](packages/react/src) | React／JSX 分析和转换，包括跨模块组合诊断 |
| [packages/vite/src](packages/vite/src) | 开发更新、生产汇总、资源与宿主集成 |
| [packages/types/src](packages/types/src) | 作用域类型辅助 |
| [packages/testing/playground](packages/testing/playground) | 中文编译器、适配器及生命周期演示 |
| [packages/testing/acceptance](packages/testing/acceptance) | task-board、article 和排序验收 |
| [packages/testing/browser](packages/testing/browser) | 原生 CSS 对照及 Vite 宿主浏览器验证 |

官方 create-vite React TS 的 workspace 外 tarball 消费验收：`corepack pnpm vite-template:check`。已验证 Vite 8.3.5 与 React Router 8.5.0 Declarative／BrowserRouter 的有界 Chromium 客户端路由路径，workspace 仍保留 Vite 7；接入步骤与限制见 [模板验收](docs/VITE-TEMPLATE-ACCEPTANCE.md)。

React Router Framework Mode 的真实 SSR 外部验收：`corepack pnpm framework-ssr:check`。通过公共 `virtual:gss.css?url` 与框架正常 `links()` 连接 aggregate CSS；版本、接入步骤及 Chromium 有界范围见 [Framework SSR 验收](docs/FRAMEWORK-SSR-ACCEPTANCE.md)。

## 使用边界

这是有明确准入与 fallback 契约的实现，不是“任意 CSS 都能安全原子化”的承诺。普通场景使用独立编写的原生 CSS 对照；GSS 所有权／结构语义允许与原生 source order 不同，应使用明确的 GSS 预期。

同一模块的多个 scope 可以组合。不同模块在同一个节点上的优先级仍不受支持；React 适配器对可证明的组合发出非阻塞警告 `GSS2107`，不移除 class。

仓库尚未发布包；发布、release 和 tag 都需要单独授权。
