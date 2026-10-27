# 有限 MVP 目标与进度

## 结论与范围

owner 已决定按本文件的有限范围结项，结项基线为 `847698c`；后续工作按 [下一阶段](NEXT-STAGE.md) 确定目标，不扩展本阶段的完成承诺。

当前交接约定的**有限 React/Vite MVP 已交付**。本轮在 `2f115b1` 上核对当前代码、测试入口与交接记录，并重新运行基础验证和三个演示的生产构建，未发现这些检查范围内的待修复缺口；这不是完整语义审计，也不是全浏览器无缺陷证明。

不把有限 MVP 的交付等同于历史路线图全部完成。当前范围与语义以 [STATUS.md](STATUS.md) 为准；历史 `c99a0d3` 的 `docs/mvp-capabilities.md`、`docs/mvp-roadmap.md` 仅用于辨别曾记录的开放项，不恢复为执行队列，不以旧勾选状态覆盖后续实现。

## 目标进度

下表“已交付”均指现有准入范围，不承诺任意 CSS 或任意宿主组合。

| 目标 | 进度 | 当前实现／回归入口 |
| --- | --- | --- |
| 框架无关编译核心：解析、作用域、所有权与结构关系、属性效果 | 已交付 | `compiler/src/domain/`；`postcss-stylesheet-parser`、`descendant-conditions`、`structural-relations`、`property-effects` 测试 |
| 编译会话：事务替换、失效、全量 finalize、资源回收与确定性输出 | 已交付 | `compiler-session.test.ts`、`session-convergence.test.ts` |
| 安全边界：有界准入、整模块 preserved fallback、失败保留 last-known-good | 已交付 | `compiler-session.test.ts`、`external-target.test.ts`、`compatibility-targets.test.ts`；不扩大 fallback |
| 资源、URL 绑定、来源映射和生产元数据 | 已交付有界实现 | `stylesheet-assets.test.ts`、`css-source-map.test.ts`、`diagnostic-ranges.test.ts`；Vite production assets/CSS 测试，不承诺完整 token 级映射 |
| React 引用发现、静态 scope 校验、className lowering 与消费类型 | 已交付有界实现 | `packages/react/test/`、`packages/types/test/`；React 分析不进入编译核心 |
| Vite 开发更新／恢复和生产中央 CSS 输出 | 已交付 | `packages/vite/test/` 的 dev CSS/assets、production CSS/assets 与诊断测试 |
| 中文 Playground | 已交付 | `packages/testing/playground/`、`playground.test.ts` |
| Task-board、Article 真实页面与独立原生参考 | 已交付指定范围 | `packages/testing/acceptance/`；浏览器历史证据与 Firefox 限制见 STATUS |
| 同模块多 scope 固定排序、逻辑／物理潜在别名排序 | 已交付 | `fixed-module-ranks.test.ts`、`logical-physical-order.test.ts` |
| 保守连续 rank 桶复用 | 已交付 | `fixed-module-rank-reuse.test.ts`；方向属性屏障与既定复用限制保持不变 |
| 独立 oracle 与浏览器验收 | 有界覆盖已交付，非全量覆盖 | `packages/testing/test/compile-gss-reference*.test.ts`、`packages/testing/browser/`；不能用编译器自身输出充当独立预期 |

SPA 的已有验收、允许整页 reload 的 HMR 行为与客户端路由覆盖缺口见 [SPA 验收结论](SPA-ACCEPTANCE.md)。

## 尚未完成／不应计入已完成的事项

| 事项 | 当前处置 |
| --- | --- |
| 完整 CSS／关系组合、完整 oracle corpus、完整源码映射与诊断范围 | 没有完整覆盖承诺。旧记录的开放项不是已定位缺陷；扩展前需确定具体输入、预期和验收范围 |
| 更广的 React 跨文件类型来源、多跳 scope 传递及逃逸分析 | owner 本轮决定跳过：主要场景采用父组件 `className={styles.title}`、子组件接收普通字符串，现有 lowering 已支持，无需为此扩展 scope 分析。不宣称全面支持跨文件 scope 类型推导 |
| 更广的 SSR/SSG、多路由生命周期和历史 Pilot 总体验收 | 本轮后续已复验有界 SSG／hydration，并补禁用 JS 的服务端样式检查，详见 [SSR/SSG 验收](SSR-SSG-ACCEPTANCE.md)。不等同于 production SSR／全部历史门禁完成 |
| 跨模块同节点优先级 | owner 本轮决定不扩展：普通字符串 className 传递不要求调用方样式覆盖内部样式。仍不提供 GSS 跨模块优先级保证；保留非阻塞 `GSS2107`，不移除 class，不禁止同模块组合 |
| Firefox Article dev→production 导航问题 | 已知问题，owner 暂缓；不能报告全浏览器验收完成 |
| 性能 profiling／优化 | owner 暂缓；已有 rank 复用不构成性能 SLA |
| 包发布、release、tag、其他框架适配器 | 未授权，不执行 |

因此不计算一个混合实现、覆盖率和发布状态的“完成百分比”。下一项代码工作应是明确的现有契约缺陷，或 owner 选定并确定边界的能力扩展；本轮未发现前者，也未擅自启动后者。

## 本轮实际验证

验证代码基线：`2f115b1`；本轮仅整理文档，不修改生产代码、测试或浏览器 gate。

| 命令 | 结果与边界 |
| --- | --- |
| `corepack pnpm verify` | 通过：lint、workspace build、类型检查；45 个测试文件、1419 项测试（Compiler 884、React 49、Vite 149、Testing 337） |
| `corepack pnpm playground:build` | 生产构建通过；Vite 提示压缩后部分 chunk 超过 500 kB，保留警告，不开展暂缓的性能优化 |
| `corepack pnpm task-board:build` | 生产构建通过 |
| `corepack pnpm article:build` | 生产构建通过 |

生产构建不验证浏览器交互、HMR、像素一致性或 Firefox 导航。本轮未运行浏览器验收；历史证据仅按 [STATUS.md](STATUS.md#验收与已知边界) 的范围引用。既有浏览器脚本可能默认跑三引擎，未来运行前必须核实实际入口，不擅自改 gate 或假设存在 skip flag。
