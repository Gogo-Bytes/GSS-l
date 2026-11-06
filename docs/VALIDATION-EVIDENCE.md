# 验证证据与本机恢复

本页保留当前支持边界仍依赖的旧验证和恢复信息，不是任务队列。2026-11-06 从过期状态快照提炼；没有重跑测试或检查所有归档可恢复性。最新产品验证与各宿主证据见 [HOST-SUPPORT](HOST-SUPPORT.md)。原始失败、独立 oracle、截图和本机 artifacts 不在此次删除范围。

## 浏览器证据

以下为核心一致性／统一排序阶段的历史结果，不能当作当前提交重验。

- 该阶段 Browser oracle：125 fixtures、1267 comparisons、38 controls；Vite host、SSG hydration、multipage lazy/hydration/state controls 通过。
- Task-board 三引擎真实用户路径：每引擎 76 phases、13 exact image pairs、dev HMR/LKG/recovery、父子 implicit `className`、production lazy/CSS census 通过。删除 `.gss` 不属于当前支持契约：独立实验发现 Chromium/Firefox/WebKit 的 overlay/LKG 行为不一致，因此当前只承诺文件修改、非法输入 LKG、恢复和显式重建；删除场景的失败 artifact 保留在 `artifacts/cross-browser-rendering/task-board/2026-10-23T04-10-04.608Z/`，不宣称删除重建已通过。
- 统一固定排序：原 atom-ranks gate 默认三引擎通过，逻辑／物理 carrier 仍为 418 simple／55 semantic、每引擎 2772 paired readings，额外保留 800 次原始 authored-native 断言。原生预期未被改成 GSS 结果：同 fixture 独立记录 raw CSS 值与显式 GSS physical-priority oracle；精确图像和 order corruption controls 保留。
- Article 受扩展 border 复用屏障影响，atomic census 131→132：form／field 的 identical border 不再跨 rank 合并。业务 CSS 未改；现有 per-engine 入口 Chromium／WebKit 各 82 phases／22 exact image pairs 与负对照通过。默认三引擎 Article script 未改，Firefox Article 未运行。更早的 147→131／字节数结果只能按对应 Git 历史和日志引用。
- 统一排序阶段证据：`artifacts/unified-order-core/`（red、transitivity red、verify/browser/playground、Article 两引擎、census delta）；最终三引擎 rank 产物在 `artifacts/rank-integration/browser/`。首次 rank 全套因 300s wrapper 预算不足中断，后一次因 child 1800s session 上限中断，原始产物均已备份；增加有界预算后同入口全套通过，不是 readiness 缺陷修复。
- 安全复用交付：独立审查接受 **Chromium／WebKit** 范围；Article 每引擎 82 phases／22 对精确图像。Firefox Article 的 dev→production 导航问题由 owner 暂缓，不宣称已修复。
- rank 验收曾因两引擎加载器入口失配，意外跑了原三引擎 gate 并通过。已披露执行范围偏差；这不能消除 Article 的历史 Firefox 失败。
- 通用 browser readiness 曾出现 120 秒超时，原因未确定；owner 授权的固定三次未加仪器样本随后通过。不把这些通过说成已找到因果修复，也不允许无限重试直到绿。
- Article 截图曾因 locator 自动滚动丢失 hover；已改为相同全页 clip，并检查截图前后交互／滚动／几何状态，保留负对照。

脚本事实：`browser:check`、`task-board:check`、`article:check`、`atom-ranks:check` 的默认执行范围不能被“Firefox 暂缓”自动改写；尤其 Article 和 atom-ranks 默认跑三引擎。需要两引擎复验时先确认已有入口和运行范围，不能假设存在 skip flag 或私自改默认 gate。该阶段已重新运行 browser oracle 与 Playground gate；Firefox Article 仍未重新启动。

普通场景用独立原生 CSS／literal oracle，所有权／结构语义用明确 GSS oracle。图像在同引擎内精确比较，不增加容差／遮罩，不修改业务 CSS、删 fixture 或削弱断言来换取通过。失败和仪器化试验属于证据，不能覆盖原始失败记录。

## 性能记录（暂缓）

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

## 会话与资源核查证据

基线 `e1cbcdf` 的有界核查未发现新反例；339 项定向检查及该时点 verify 2124 项通过，日志为 `artifacts/lifecycle-consistency/01-session-baseline.log` 至 `05-verify.log`，范围记录在 `inspection.md`。没有新增产品实现或浏览器验证，不证明所有并发时序、map 或资源组合。后续检查以当前支持清单为准。

## 本机交接与证据恢复

以下是本机状态，不是其他开发者必须具备的运行依赖：

- 唯一工作目录：`/Users/gan/Desktop/🥷/css-plugin/GSS-l`，使用 main。额外 17 个 worktree 已归档并移除。
- 完整归档：`../GSS-l-worktree-archive-20261019T160632/`。有 `manifest.json`、逐文件校验、恢复说明和 `repository-refs.bundle`；不含可重装的 node_modules。
- 主要历史证据位于该归档的 `GSS-l-rank-integration.tar.gz` 内 `./artifacts/`：`fixed-module-ranks/`、`logical-physical-order/policy-b/`、`rank-reuse/`、`compiler-scale/`。
- 性能记录：同一压缩包内 `./artifacts/compiler-scale/DEFERRED.md`；修正派生数据在 `./artifacts/compiler-scale/pressure-aware/attempt-01/corrected-derived/`。历史记录中的分支名、未合并状态和旧路径是当时快照，以本文和当前 Git 为准。
- 旧未提交 Dev React HMR 工作的本地 stash 已经 owner 授权删除；当时清理后 stash 列表为空（不代表当前实时状态）。备份仍保存在上述 `repository-refs.bundle` 的 `refs/stash`，对象为 `f4a8330836cc301e0e7a32c69e02e70e37be70f4`。如需恢复，先从 bundle 导入到隔离的恢复位置并审查与现有实现的差异，不直接应用到 main。
- warning 审计目录的未提交修改保存在 `GSS-l-warning-verify-20261016T094553Z.tar.gz`，不视作待合入功能。
- 独立审查报告仍在 `~/.pi/agent/sessions/--Users-gan-Desktop-🥷-css-plugin-GSS-l--/subagent-artifacts/outputs/`。复用最终验收工作流：`dbf137f9-0ca2-4f21-8daa-fc539e0aca0b`；性能审查：`105dafe8-321e-44a3-ae8b-61ab56cd243d`。

恢复证据时只解压需要的文件到单独位置，不覆盖当前源码。历史文档如确有需要，可用 `git show 266a87c:docs/<原文件名>` 读取清理前版本；不批量恢复已删除的 ADR／路线图。
