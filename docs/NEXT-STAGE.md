# 当前进度与后续工作计划

## 当前方向

owner 已决定：**不再新增框架或验收场景**。工作重心从扩展验收矩阵转为现有能力的正确性、契约一致性与真实缺陷修复。

有限 MVP、官方 Vite React TS 外部消费、客户端路由和 React Router Framework SSR 的已选任务均已交付。当前实现基线为 `main` 的 `4b7a982`；没有待合并实现或已确认但未完成的本轮修复。历史失败、支持范围之外的输入和未覆盖组合不混计为当前缺陷。

## 已完成进度

| 项目 | 交付 | 证据与边界 |
| --- | --- | --- |
| 有限 MVP | 框架无关 Compiler、React Adapter、Vite 集成、Playground、Task-board／Article | 历史结项 `847698c`；不是任意 CSS 支持 |
| 核心 CSS 收敛 | property/state registry 扩展、nth-of marker、有界 native relation selectors | 关系匹配由浏览器执行，既有所有权和排序契约不变；准入仍有边界 |
| 引用与类型体验 | 隐式 scope 编译期字符串语法糖、递归类型、有限 alias lowering | 不要求所有静态引用都写 `.self`；未知／动态路径保留普通 JS `undefined` 行为 |
| 真实父子 className | Task-board 父组件传 GSS 引用、子组件接字符串；HMR/LKG／恢复与生产路径 | 三引擎，每引擎 76 phases／13 对精确图像；删除源文件不在契约内 |
| 官方 Vite 模板 | workspace 外安装未修改 tarballs，strict peers、类型、dev/build/preview、资源与 lazy | `c9013d1`；[模板报告](VITE-TEMPLATE-ACCEPTANCE.md)，新模板仅 Chromium |
| Vite 8 兼容 | Rolldown census 缺失字段修复；peer 支持 Vite 7／8 | workspace 保留 Vite 7；不是全版本矩阵保证 |
| 客户端路由 | React Router Declarative／BrowserRouter 导航、history、lazy route、深链接／reload | `f54a963`；19 routing checkpoints，部署仍需 SPA rewrite |
| Framework SSR | 官方 React Router 请求时 HTML/CSS、JS-off、资源、hydration 与路由 | `4b7a982`；[SSR 报告](FRAMEWORK-SSR-ACCEPTANCE.md)，仅指定版本和 Chromium |
| 公共 stylesheet URL | `virtual:gss.css?url` + 宿主标准 `links()`，复用 aggregate CSS | `gss()` 返回 `Plugin[]` 已接受；普通 `plugins: [gss(...)]` 不变；程序化单对象访问需调整 |

## 后续工作顺序

### 1. 当前：统一进度与契约文档

清除仍要求重选已完成类型契约、重做脚手架或继续新增框架的旧指引。保留历史证据及公共 API 变化，明确未测不等于失败。

完成标准：README、STATUS、HANDOFF、核心／CSS 盘点与本计划一致；引用的报告存在；本次整理不宣称新增运行证据。

### 2. 下一实施目标：现有核心实现一致性核查

只核对已交付能力，不从“缺少某条 CSS／某个框架”推导新功能任务。优先检查最近扩展较多的两处：

- **Property effects**：已登记 shorthand/reset/longhand 是否正确，逻辑／物理潜在重叠是否仍按既定 Policy B 排序，unknown property fallback 是否保持。
- **Selector marker**：已准入语法中的 local/global identity、嵌套遍历、原生 selector 结构与既有 ownership/schema 是否一致；不推理 DOM，不设计新 selector 语法。

以现有源码、调用者和测试为入口，输出“已确认问题／证据不足／契约限制”，每个问题给具体输入、独立预期与实际输出。此处是核查目标，不预先认定代码存在缺陷。没有反例时报告未发现问题并结束，不为了填表继续扩大范围。

### 3. 仅对确认的问题实施必要修复

建立最小失败回归，在现有测试载体修复共享根因，保留原始失败；涉及浏览器行为时复用现有 gate，不另建框架、演示应用或验收矩阵。修复完成后运行相关检查和全仓 `verify`；宿主／输出改动再运行受影响的现有 SPA／SSR gate。

常规 bug、诊断和回归由 agent 连续处理，不逐小项询问。若修复需要改变产品能力、作者写法、公共 API／配置、架构或 fallback，先给具体选项和影响再决策。

### 4. 收敛后交付，不自动寻找下一个框架

报告解决的问题、保留的限制、检查范围与 commit/push。没有明确缺陷或用户需求时保持当前能力，不自动进入发布、性能优化或新功能开发。

## 不属于当前代办的事项

| 分类 | 事项 | 处理原则 |
| --- | --- | --- |
| 不扩展验收 | Astro、Next.js、SWC、更多 Router 模式、新浏览器矩阵、流式 SSR、新 SSR/SSG Playground | 仅在 owner 将来提出实际需求并重新授权后讨论；不是待选择队列 |
| 已接受范围 | `.gss` 删除时 overlay/LKG 不一致 | 不承诺支持，不作为待修复缺陷；原始证据保留 |
| 已接受体验 | class mapping 更新允许 reload／React state reset | 个别模板保留状态不升级为公共保证 |
| 暂缓缺陷 | Firefox Article 历史导航问题 | 保留原始失败，未重新授权不启动 |
| 历史未归因失败 | browser readiness 超时 | 不是已修复；在当前任务复现时诊断，不能无限重试取绿 |
| 暂缓 | 性能 profiling／优化 | 不启动性能工作 |
| 本轮不做 | 跨文件 scope 推导、跨模块同节点优先级、精确 IDE path completion | 保持现有字符串使用与诊断边界 |
| 能力储备，非任务 | 更多 at-rule/resource、value grammar、unknown property 注册 API | 有真实需求后再决定；unknown effect 继续整 Module preserved 或按配置 error |
| 单独授权 | 包发布、release、tag | 本地 tarball 验收不是发布 |

## 验证基线与执行边界

`4b7a982` 的已记录验证：Compiler 1539、React 49、Vite 161、Testing 334，共 **2083 项测试**，lint/build/types 通过；browser oracle **125 fixtures／1267 comparisons／38 controls**；外部 SPA／Declarative 和 Framework SSR gate 通过。完整版本、产物和失败历史见对应报告；`verify` 不包含浏览器验收。

沿用独立 literal／原生预期、负对照与同引擎精确图像；不删断言或修改业务样式换取通过。浏览器入口及默认引擎范围保持不变，执行前先核对脚本。普通修复可补必要回归；“不新增验收场景”不是取消现有检查或禁止为真实缺陷补回归。

只在现有 `main` 工作；不自行创建分支／worktree。完成且相关检查通过的改动直接提交并推送；不完整或已知失败的实现不推送。语义契约和历史证据恢复见 [STATUS](STATUS.md)，新 session 从 [HANDOFF](HANDOFF.md) 开始。
