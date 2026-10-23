# GSS 工作状态

更新于 2026-10-19。当前实现基线为 main 的 `088811d`；本文保留历史证据与当前交付边界，不把旧快照当成未来代码的自动验收。

有限 MVP 的逐项目标进度及后续 `2f115b1` 基线上的基础验证、演示生产构建结果见 [MVP 进度](MVP-PROGRESS.md)。该核对未新增浏览器验收，也不将历史开放项改判为全部完成。

## 当前阶段

owner 已决定有限 MVP 结项，当前进入核心能力收敛与真实用户路径验收阶段。最新基础验证为 2071 项测试通过；Browser oracle 为 125 fixtures／1267 comparisons／38 controls，Playground 同范围通过。这不覆盖历史 Firefox 失败或完整 production SSR。

新阶段分类、候选与用户路径门禁见 [下一阶段](NEXT-STAGE.md)。owner 已明确先收敛基本核心能力，再接脚手架。当前 native relation selector、nth-of marker、property/state coverage 已有独立回归；剩余 CSS value／at-rule／resource 扩展不自动恢复为任务队列。隐式 className lowering 已按“编译期语法糖 + 轻量 TS 兼容类型”决策，不直接接脚手架，不新建 SSR/SSG Playground。

## 已完成交付

| 阶段 | 关键提交 | 已交付内容 |
| --- | --- | --- |
| 初始有限 MVP | `c99a0d3` | 编译器、React／Vite 及原生 CSS 对照基线；当时 1081 项测试通过 |
| Playground 与真实页面 | `e4ad1ba` 及其祖先，PR #29 | 中文 Playground、Fieldwork task-board、article/comments；真实交互、独立原生参考、精确图像比较；跨模块警告 `GSS2107` |
| 模块内固定排序 | `399444f`，PR #30 | 已准入的同模块多 scope 竞争统一排序，修复 target-local 排序不足 |
| 逻辑／物理属性排序 | `1012d98`，PR #31 | 潜在方向别名参与排序族及语义优先级候选，保留所有权／结构优先级 |
| 安全 rank 复用 | `dc9ad13`，PR #31 | 仅收缩连续、完整且符合条件的同语义 rank 桶，降低真实示例输出 |

上述实现全部已合入 main，不存在待合并的正式交付分支。保留的 `prototype/module-local-atom-ranks` 是独立演示原型，不是待合入代码。

### 输出改善

安全复用前后，业务 CSS 不变：

| 示例 | 原子数 | CSS 字节数 |
| --- | --- | --- |
| Article | 147 → 131 | 21863 → 19545（约 -10.6%） |
| Task-board | 162 → 135 | 24181 → 20453（约 -15.4%） |

这是两个指定示例的结果，不是所有样式表的复用率保证。

## 必须保留的语义契约

1. **模块内排序**：先使用已证明的所有权／结构关系形成语义依赖高度，再按原始规则 source ordinal 和声明位置排序。source order 不是与语义边同等强度的图边，也不存在通用 selector 等级。
2. **原生层叠强度**：rank 不覆盖原生 importance／specificity。layer、条件和伪元素主体等上下文必须保持区分。
3. **来源身份**：共享声明对象不能替代 selector-list 分支身份；保留原始规则、分支、目标／来源／观察绑定，避免错误剪枝或覆盖。部分 shorthand 胜出及 scope membership 也不能丢失。
4. **不透明关系**：owner 已接受 equal-native-strength 的 `:global()`／`:has()` 竞争在缺少既定语义关系时按 source order 决胜；这不是扩大语法准入。
5. **逻辑／物理别名（已接受的 Policy B）**：五类方向属性的潜在重叠用于排序，不代表确定相同 effect；不扩大删除、属性准入或运行时映射。浏览器仍负责 direction／writing-mode 映射。
6. **安全复用**：仅限语义高度为 0、无条件、简单单节点 pure occurrence，完整连续桶的 property／精确 value／importance 相同；保留最早正 rank，不跨越竞争者，不重排后续 rank。五类共 55 个方向属性／效果继续作为复用屏障。
7. **模块边界**：同模块多 scope 组合是支持能力；跨模块同节点优先级仍不支持。`GSS2107` 是保守、非阻塞诊断，不能通过禁用同模块组合来回避排序缺陷。
8. **准入与 fallback**：既有 external-target 保护及 last-known-good 行为保持不变。新语法、API、配置、fallback 或范围取舍需 owner 明确决定。

关键实现：[fixed-module-ranks.ts](../packages/compiler/src/domain/fixed-module-ranks.ts)、[module-order-overlap.ts](../packages/compiler/src/domain/module-order-overlap.ts)、[compiler-session.ts](../packages/compiler/src/application/compiler-session.ts)。回归入口：[fixed-module-rank-reuse.test.ts](../packages/compiler/test/fixed-module-rank-reuse.test.ts)、[logical-physical-order.test.ts](../packages/compiler/test/logical-physical-order.test.ts)。

## 验收与已知边界

### 当前 main 的基础验证

当前 main 已运行 `corepack pnpm verify`：Compiler 1539、React 49、Vite 149、Testing 334，共 2071 项测试，另有 lint／build／类型检查通过。

### 浏览器证据

- 当前 Browser oracle：125 fixtures、1267 comparisons、38 controls；Vite host、SSG hydration、multipage lazy/hydration/state controls 通过。
- 逻辑／物理修复阶段：三浏览器证据通过，包含 418 个简单 fixture、55 个语义 fixture、每引擎 2772 项读取及方向／writing-mode 动态变化。
- 安全复用交付：独立审查接受 **Chromium／WebKit** 范围；Article 每引擎 82 phases／22 对精确图像。Firefox Article 的 dev→production 导航问题由 owner 暂缓，不宣称已修复。
- rank 验收曾因两引擎加载器入口失配，意外跑了原三引擎 gate 并通过。已披露执行范围偏差；这不能消除 Article 的历史 Firefox 失败。
- 通用 browser readiness 曾出现 120 秒超时，原因未确定；owner 授权的固定三次未加仪器样本随后通过。不把这些通过说成已找到因果修复，也不允许无限重试直到绿。
- Article 截图曾因 locator 自动滚动丢失 hover；已改为相同全页 clip，并检查截图前后交互／滚动／几何状态，保留负对照。

脚本事实：`browser:check`、`task-board:check`、`article:check`、`atom-ranks:check` 的默认执行范围不能被“Firefox 暂缓”自动改写；尤其 Article 和 atom-ranks 默认跑三引擎。需要两引擎复验时先确认已有入口和运行范围，不能假设存在 skip flag 或私自改默认 gate。当前 main 已重新运行 browser oracle 与 Playground gate；Firefox Article 仍未重新启动。

普通场景用独立原生 CSS／literal oracle，所有权／结构语义用明确 GSS oracle。图像在同引擎内精确比较，不增加容差／遮罩，不修改业务 CSS、删 fixture 或削弱断言来换取通过。失败和仪器化试验属于证据，不能覆盖原始失败记录。

## 暂缓事项：不是默认待办

### 性能

owner 已要求先记录、以后再看；不启动 profiling、排序优化或 no-op 快路径。

测量源码为 `dc9ad13`，当时在独立测量分支，不是 main 上的新性能验收。36 场景 × 3 样本，共 108/108，另有 smoke；共享主机、预热 public-session 调用，非 SLA 或最坏情况证明。

| 场景 | replace + finalize 中位数 |
| --- | --- |
| Article | 9.39ms |
| Task-board | 8.80ms |
| 单模块 500 条不同 width 声明 | 78.72ms |
| 单模块 1000 条不同 width 声明 | 248.40ms（样本范围 241.40–403.36ms） |
| 100 模块中修改一个 5 声明模块 | 3.86ms |
| 250 声明 no-op 替换 | 25.17ms |

大型单模块成本、重复值仍有 replace 成本、no-op 重建都是后续研究线索，不是已确认热点。macOS 测量采用 native normal-pressure guard；最初仅凭空闲页的 guard 停止不代表内存耗尽。RSS 派生结果以 `corrected-derived` 为准：未采样／zero-only 记为 null，不当成零值观测；原始数据及所有耗时统计保持不变。

### Firefox 与后续范围

Firefox Article 导航问题仍暂缓。包发布、其他框架适配器、新语法或新 fallback 均未获本轮授权。历史 roadmap 不是自动执行队列；下一阶段方向已确定为缺陷收敛、脚手架扩展、真实 SSR 框架实验，**具体首项实现目标与版本仍待 owner 选择**，见 NEXT-STAGE.md。

## 本机交接与证据恢复

以下是本机状态，不是其他开发者必须具备的运行依赖：

- 唯一工作目录：`/Users/gan/Desktop/🥷/css-plugin/GSS-l`，使用 main。额外 17 个 worktree 已归档并移除。
- 完整归档：`../GSS-l-worktree-archive-20261019T160632/`。有 `manifest.json`、逐文件校验、恢复说明和 `repository-refs.bundle`；不含可重装的 node_modules。
- 主要历史证据位于该归档的 `GSS-l-rank-integration.tar.gz` 内 `./artifacts/`：`fixed-module-ranks/`、`logical-physical-order/policy-b/`、`rank-reuse/`、`compiler-scale/`。
- 性能记录：同一压缩包内 `./artifacts/compiler-scale/DEFERRED.md`；修正派生数据在 `./artifacts/compiler-scale/pressure-aware/attempt-01/corrected-derived/`。历史记录中的分支名、未合并状态和旧路径是当时快照，以本文和当前 Git 为准。
- 旧未提交 Dev React HMR 工作的本地 stash 已经 owner 授权删除；本次清理后 stash 列表为空。备份仍保存在上述 `repository-refs.bundle` 的 `refs/stash`，对象为 `f4a8330836cc301e0e7a32c69e02e70e37be70f4`。如需恢复，先从 bundle 导入到隔离的恢复位置并审查与现有实现的差异，不直接应用到 main。
- warning 审计目录的未提交修改保存在 `GSS-l-warning-verify-20261016T094553Z.tar.gz`，不视作待合入功能。
- 独立审查报告仍在 `~/.pi/agent/sessions/--Users-gan-Desktop-🥷-css-plugin-GSS-l--/subagent-artifacts/outputs/`。复用最终验收工作流：`dbf137f9-0ca2-4f21-8daa-fc539e0aca0b`；性能审查：`105dafe8-321e-44a3-ae8b-61ab56cd243d`。
- Git SSH 已恢复：本仓库 `core.sshCommand` 使用指定密钥、443 和 `UseKeychain=yes`；GitHub 实测认证账号是 Gogo-Bytes。提交署名不等于认证账号；不需要在新 session 重配凭据。

恢复证据时只解压需要的文件到单独位置，不覆盖当前源码。历史文档如确有需要，可从初始冻结提交读取；不批量恢复已删除的 ADR／路线图。
