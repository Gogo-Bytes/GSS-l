# 新 session 接续提示词

具体状态以 [STATUS.md](STATUS.md)、当前 Git 和 [当前计划](NEXT-STAGE.md) 为准。下述内容可直接用于接续：

```text
请接续 GSS-l，工作目录 /Users/gan/Desktop/🥷/css-plugin/GSS-l。

先完整阅读 AGENTS.md、README.md、docs/STATUS.md、docs/NEXT-STAGE.md，检查 git status、分支和 origin/main。直接使用现有 main；发现其他会话写入或不相关改动先协调，不 reset/stash，不自行创建分支/worktree。

已交付宿主基线4b7a982、核心修复基线af02efe，后续统一排序已完成：有限 MVP、隐式字符串引用和有限 alias、核心 CSS registry/marker 收敛、官方 Vite React TS 外部消费、React Router Declarative 客户端路由与 Framework SSR 均已交付。最近记录的 verify 为 2124 项测试及 lint/build/types；不是本次 session 的新运行证据。浏览器范围与原始失败见 STATUS 及专项报告，不将 Chromium 框架实验外推为全部浏览器/框架支持。

owner 已要求按整体规划实施核心架构与属性排序目标；先读 docs/ARCHITECTURE-DIRECTION.md 和 docs/PROPERTY-ORDER-DESIGN.md。会话提交／失效、贡献准备与快照汇总已分离；产品包已迁至 compiler/、adapters/react/、integrations/vite/ 和 types/，测试基础设施已迁至 tests/；示例职责尚未整理。可原子化 pure ownership 规则内及跨规则累积的已登记逻辑／物理 longhand 对已准入，preserved 模式及其余部分组合仍可能报 GSS1206，排序目标未完成。此前核心核查和统一固定排序已交付，不把历史结果当新目标完成。Astro、Next.js、SWC、更多 Router 模式/浏览器矩阵不是自动任务，不自行新增框架或验收场景。

已确定的使用契约不要重问：静态 scope 使用编译期字符串语法糖，旧 .self 兼容；未知/动态路径保持普通 JS undefined；DOM 关系和匹配由浏览器负责，GSS 按现有准入做 marker rewrite；公共 virtual:gss.css?url 通过宿主正常 stylesheet links 使用；gss() 返回 Plugin[]，标准 plugins:[gss(...)] 不变。SSR URL 的实际有界范围见 docs/FRAMEWORK-SSR-ACCEPTANCE.md。

常规 bug、诊断、必要回归与实施顺序自行完成，不逐切片请 owner 选择。修复复用已有测试载体；不新增框架/演示应用/验收矩阵。需要改变能力、作者体验、语法、公共 API/配置、架构或 fallback 才先给选项和后果。

排序目标不要重问：在原生强度／可比较上下文相同时，已证明 ownership／结构语义优先，同语义高度逻辑先、物理后；同属性 rank 与不同属性固定顺序应分开。无法安全展开的既有输入暂时沿用当前 shorthand 处理和 fallback，不额外拒绝。静态 margin／padding 同规则及跨单节点 scope 展开有受限实现，完整展开范围、独立 rank 与跨属性语义约束的无循环规则尚需设计；不可只删 GSS1206 或假设数值 rank 跨属性可比较。当前实现及历史排序证据见 STATUS，新目标见架构方向。跨文件 scope 推导、跨模块同节点优先级仍跳过；.gss 删除不纳入支持契约；性能和历史 Firefox Article 暂缓。

保留独立 oracle、严格断言、精确图像及失败证据；复现失败后诊断，不循环重试直到绿。浏览器脚本默认范围不变，执行前查实际入口。修复运行相关检查与 verify；宿主/输出改变时加跑受影响的现有 gate。完整且通过后直接提交/push main，报告 commit、检查与结果；不完整/已知失败的实现不推送。发布、release、tag 仍需明确授权。
```
