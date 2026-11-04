# 新 session 接续

先读 AGENTS.md、README.md、[STATUS](STATUS.md)、[NEXT-STAGE](NEXT-STAGE.md)，检查 main 工作区与远端。宿主问题按 [HOST-SUPPORT](HOST-SUPPORT.md)定位模块契约、版本与证据；语义问题先读 domain 指南及相关设计文档。

当前 owner 方向：维护 Vite、Rspack、Rsbuild、webpack；四宿主阶段收尾已完成，暂无新能力实施排队。Parcel/更多宿主与框架暂停。Fast Refresh、overlay 精度仅是候选，未授权实施。依据具体反例继续维护；没有明确目标时先澄清，不从归档里寻找任务。

代码基线 `eb47522`，完整 verify 2569 项及该轮 Chromium 生产/dev 检查通过；本次阶段收尾仅文档核对。旧专项证据不等于当前全量重验。公共准备仅含两个算法，宿主生命周期独立；保持排序、fallback、原有 React 用法与宿主单份 targets。

遵循 AGENTS.md 直接在 main 工作，发现不相关改动先协调。通过的完整切片提交并推送；新能力/API/架构/语义决策先反馈，发布需单独授权。

历史接续提示词已归档到 [HANDOFF-HISTORY](HANDOFF-HISTORY.md)，仅用于还原历史上下文，不作为当前执行提示词。旧 worktree/stash 与本机证据恢复见 [STATUS 恢复入口](STATUS.md#本机交接与证据恢复)。
