# 新 session 接续

先读 AGENTS.md、README.md、[STATUS](STATUS.md)、[NEXT-STAGE](NEXT-STAGE.md)，检查 main 工作区与远端。宿主问题按 [HOST-SUPPORT](HOST-SUPPORT.md)定位模块契约、版本与证据；语义问题先读 domain 指南及相关设计文档。

当前 owner 方向：维护 Vite、Rspack、Rsbuild、webpack；四宿主阶段收尾已完成。2026-11-06 已将四项后续目标/问题迁入 Issues，恢复时先读 [任务映射](NEXT-STAGE.md#已迁入-github-的跟踪事项)及对应 Issue 最新状态，不从旧文档推断执行授权。Parcel/更多宿主与框架不自动启动；迁移本身没有授权新能力开发。owner 明确保留 main 直提，本轮不使用分支/PR。

代码基线 `eb47522`，完整 verify 2569 项及该轮 Chromium 生产/dev 检查通过；本次阶段收尾仅文档核对。旧专项证据不等于当前全量重验。公共准备仅含两个算法，宿主生命周期独立；保持排序、fallback、原有 React 用法与宿主单份 targets。

遵循 AGENTS.md 直接在 main 工作，发现不相关改动先协调。通过的完整切片提交并推送；新能力/API/架构/语义决策先反馈，发布需单独授权。

过期交接／计划快照已按 owner 要求删除，历史内容仅通过 Git 追溯，不恢复成任务队列。旧 worktree/stash 与本机证据恢复见 [STATUS 恢复入口](STATUS.md#本机交接与证据恢复)。

最近完成 [React 更新只读核查](REACT-UPDATE-REVIEW.md)：保留不同宿主/场景的证据边界，未确认新 bug。不要把核查结论当作 state 保持实施授权。

最近另完成 [诊断与定位只读核查](DIAGNOSTIC-LOCATION-REVIEW.md)：Vite 的 loc/frame 与新宿主的原始 diagnostics 保留不能混同；部分 Adapter 错误无 range。记录展示差距，无新修复/能力任务，未重跑测试。
