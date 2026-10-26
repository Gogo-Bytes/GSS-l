# 新 session 接续提示词

具体状态以 [STATUS.md](STATUS.md)、当前 Git 和 [当前计划](NEXT-STAGE.md) 为准。下述内容可直接用于接续：

```text
请接续 GSS-l，工作目录 /Users/gan/Desktop/🥷/css-plugin/GSS-l。

先完整阅读 AGENTS.md、README.md、docs/STATUS.md、docs/NEXT-STAGE.md，检查 git status、分支和 origin/main。直接使用现有 main；发现其他会话写入或不相关改动先协调，不 reset/stash，不自行创建分支/worktree。

已交付宿主基线4b7a982、核心修复基线af02efe，后续统一排序已完成：有限 MVP、隐式字符串引用和有限 alias、核心 CSS registry/marker 收敛、官方 Vite React TS 外部消费、React Router Declarative 客户端路由与 Framework SSR 均已交付。最近记录的 verify 为 2124 项测试及 lint/build/types；不是本次 session 的新运行证据。浏览器范围与原始失败见 STATUS 及专项报告，不将 Chromium 框架实验外推为全部浏览器/框架支持。

owner 最新要求：不再新增框架或验收场景。Astro、Next.js、SWC、更多 Router 模式/浏览器矩阵不是自动任务。现有核心核查和具体 reset/marker/has bug 已完成；统一固定排序也已按 owner 确认实施。后续只对真实反例做现有核心契约核查：property effects 与已准入 selector marker 等。先给最小输入、独立预期和实际输出，再判断是否存在缺陷；不是新增功能或全 CSS 支持审计。没有反例时报告未发现问题并结束，不制造下一项。

已确定的使用契约不要重问：静态 scope 使用编译期字符串语法糖，旧 .self 兼容；未知/动态路径保持普通 JS undefined；DOM 关系和匹配由浏览器负责，GSS 按现有准入做 marker rewrite；公共 virtual:gss.css?url 通过宿主正常 stylesheet links 使用；gss() 返回 Plugin[]，标准 plugins:[gss(...)] 不变。SSR URL 的实际有界范围见 docs/FRAMEWORK-SSR-ACCEPTANCE.md。

常规 bug、诊断、必要回归与实施顺序自行完成，不逐切片请 owner 选择。修复复用已有测试载体；不新增框架/演示应用/验收矩阵。需要改变能力、作者体验、语法、公共 API/配置、架构或 fallback 才先给选项和后果。

统一排序规则不要重问或改回原生 source order：原生 strength/context 与已证明语义高度优先；同高度潜在竞争属性逻辑先、物理后，同属性同级仍按 authored occurrence。module-order-policy.ts 集中 overlap/priority/reuse barrier/total render key（priority、严格 shorthand 包含深度、名称），替代旧五族 Policy B 的 source-order tie；不将潜在别名当 definite effects 剪枝，GSS1206 准入/LKG不变。保留所有权、来源身份、native importance/specificity 和其余保守 rank 复用契约。跨文件 scope 推导、跨模块同节点优先级仍跳过；.gss 删除不纳入支持契约；性能和历史 Firefox Article 暂缓。

保留独立 oracle、严格断言、精确图像及失败证据；复现失败后诊断，不循环重试直到绿。浏览器脚本默认范围不变，执行前查实际入口。修复运行相关检查与 verify；宿主/输出改变时加跑受影响的现有 gate。完整且通过后直接提交/push main，报告 commit、检查与结果；不完整/已知失败的实现不推送。发布、release、tag 仍需明确授权。
```
