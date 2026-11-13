# 当前计划

## 阶段收尾结果（2026-11-04）

Owner 已要求暂不扩展宿主/能力，先统一现状。本次收尾已完成：

- 四个宿主的入口、配置、peer/实测版本汇总至 [HOST-SUPPORT](HOST-SUPPORT.md)。
- 生产、watch、浏览器更新、外部包消费、SSR/map 的证据分别列出；明确原生 Rspack 与 Rsbuild、原生 accept 与 Fast Refresh 的差别。
- 已接受限制、未验证组合和暂缓事项分清；没有把历史证据升级为本轮验收。
- 历史“下一步”不再混入当前任务；2026-11-06 删除被替代的历史快照，必要恢复信息保留于 [验证证据](VALIDATION-EVIDENCE.md)。

这是文档交付，不包含产品变化、扩大支持或新测试矩阵。最新代码检查仍是 `eb47522` 的 2569 项及独立浏览器检查，见 [STATUS](STATUS.md)。

## 后续已完成的有界核查

Owner 随后授权现有 React 更新链路只读核查，已完成 [代码/证据报告](REACT-UPDATE-REVIEW.md)。没有确认需修复的新反例；没有新增运行验证或能力承诺。本项已结束，不转成无限状态保持验收任务。

Owner 再授权的 [诊断与错误定位只读核查](DIAGNOSTIC-LOCATION-REVIEW.md)也已完成：分清 Compiler/Adapter 范围、宿主包装、overlay 展示与最终 CSS map。存在展示差距，但没有确认新的契约违反；本项仅文档，不自动启动定位能力扩展。

## 当前可以执行的工作

现有 Vite、Rspack、Rsbuild、webpack 契约内的问题驱动维护：读取对应模块契约和失败证据，构造能复现症状的回归，修复后运行受影响检查，更新文档并 commit/push main。若没有具体反例，记录核对范围并结束该项，不持续扩矩阵寻找“下一项”。

当前没有另一项已批准、尚未完成的能力实施。新产品目标需要明确范围；不要从历史路线图自动挑选任务。

## 已迁入 GitHub 的跟踪事项

2026-11-06 owner 要求使用 Issue 维护后续目标与问题，并确认保留 main 直提、暂不采用分支/PR。以下只保留任务映射，动态阶段、阻塞和下一步以对应 Issue 正文为准，不在文档维护第二套进度表。创建 Issue 不等于批准能力扩展或恢复暂缓工作。

| 原文档事项 | 跟踪入口 | 设计／证据 |
| --- | --- | --- |
| 新宿主诊断位置展示 | [#32](https://github.com/Gogo-Bytes/GSS-l/issues/32) | [诊断核查](DIAGNOSTIC-LOCATION-REVIEW.md) |
| React 更新与状态保持目标 | [#33](https://github.com/Gogo-Bytes/GSS-l/issues/33) | [更新核查](REACT-UPDATE-REVIEW.md) |
| Firefox Article 导航历史失败 | [#34](https://github.com/Gogo-Bytes/GSS-l/issues/34) | [验证证据](VALIDATION-EVIDENCE.md) |
| 编译器性能评估线索 | [#35](https://github.com/Gogo-Bytes/GSS-l/issues/35) | [测量与恢复](VALIDATION-EVIDENCE.md#性能记录暂缓) |

没有创建新的 Projects/标签体系；当前凭据缺少 Projects 读取权限，本轮未同步看板。后续实现关联 Issue 和 commit，阶段完成、阻塞或范围变化时同步 Issue；PR 流程须另行获准。

## 明确不做的能力

负责人已明确否决 [#39](https://github.com/Gogo-Bytes/GSS-l/issues/39) 的逐文件 scope 精确类型、补全和拼写诊断。未知 scope 保持普通 JavaScript 行为，不新增 warning/error；这不是暂缓事项，不再列入排序、优化建议或实验队列。只有负责人主动明确改变决定才能恢复，长期契约见 [React 引用与 TypeScript 契约](ARCHITECTURE-DIRECTION.md#react-引用与-typescript-契约)。

负责人也已明确不需要 [#38](https://github.com/Gogo-Bytes/GSS-l/issues/38) 的变量索引式 scope 支持。保持静态路径和条件分支写法，不实现 `styles[variant]` 的动态解析、转换或兜底；不作为暂缓任务重新排期，恢复须由负责人主动提出。具体行为见同一 [React 引用契约](ARCHITECTURE-DIRECTION.md#react-引用与-typescript-契约)。

## 未迁移的范围限制

更多宿主（含 Parcel）、其他 UI 框架/上层框架、新 demo/验收矩阵仍不自动启动。跨模块优先级、更多 CSS/React 静态分析能力及公开 API/fallback 扩展需具体决策，尚未形成明确工程任务，不批量建 Issue。已有受限 shorthand/复用切片及清理已完成，不补造 Issue/PR。包尚未发布，发布/release/tag 需要显式指令。

## 完成标准与参考

维护切片以具体反例关闭、相关检查通过、证据保留、文档准确和提交推送为完成标准。约束不变：排序、fallback、React 用法以及宿主单份 targets。支持范围以 [统一清单](HOST-SUPPORT.md)为准，语义以原设计文档为准。

2026-11-06 owner 授权的仓库文档清理已完成：删除过期进度／交接／研究过程，保留设计决定、测试载体和原始失败证据。清理本身未新增能力任务；随后获准迁移的四项跟踪入口见上表。其余旧逐轮记录通过 Git 历史追溯。
