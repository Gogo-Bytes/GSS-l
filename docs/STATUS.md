# GSS 工作状态

已交付宿主基线为 `4b7a982`，核心修复为 `af02efe`，统一固定排序为 `e04327b`：核心收敛、官方 Vite 模板、Declarative 客户端路由和 Framework SSR 的已选任务均已交付。本文保留历史证据，不把旧快照当成未来代码的自动验收。后续工作以 [当前计划](NEXT-STAGE.md) 为准。

有限 MVP 的逐项目标进度及后续 `2f115b1` 基线上的基础验证、演示生产构建结果见 [MVP 进度](MVP-PROGRESS.md)。该核对未新增浏览器验收，也不将历史开放项改判为全部完成。


目录迁移现状：产品代码位于 `compiler/`、`adapters/react/`、`integrations/vite/`、`types/`；测试基础设施位于 `tests/`，Playground 暂仍在其中。最新迁移验证和外部证据见 [当前计划](NEXT-STAGE.md)。同属性独立 rank 已与跨属性输出位置分离，完整安全 shorthand 展开仍未完成；静态 margin／padding／inset／scroll-margin／scroll-padding 同规则与跨单节点 scope 展开已有有界切片，五族逻辑轴 inline/block 的静态双向展开也已加入，范围见当前计划。

静态负 px padding 误剪枝已在 owner 确认后按受限范围修复；原始三引擎反例、适用范围及 compatibility 等未改变路径见 [当前计划](NEXT-STAGE.md)。

属性排序分离切片将同属性版本 `atomRank` 与跨属性输出位置 `orderSlot` 分离；仍由原 effect 竞争族和语义高度规划输出，身份保留位置以限制复用，未展开 shorthand 及 fallback 不变。`verify` 2222 项通过；534 个既有排序 fixtures 去除新身份编码差异后的输出投影与基线一致，source-map 列编码由既有映射测试验证。此前 occurrence 收集重构的完整字节等价证据保留在当前计划。本项原 atom-ranks 三引擎、Chromium browser oracle 125／1267／38 及每引擎 12 项独立原生对照通过，原始日志与边界见当前计划。

此前 shorthand 切片加入静态 scroll-margin／scroll-padding 的四方向展开，保留逻辑别名竞争和不安全值的原路径；未扩大负值过滤、compatibility 或 preserved 范围。`verify` 2259 项、原 atom-ranks 三引擎、Chromium browser oracle 125／1267／38 及每引擎 43 组四侧原生对照通过；具体边界和证据见当前计划。

此前逻辑轴切片加入五族 inline/block 的静态双向展开，生成 start/end 而不映射物理方向；遇其他潜在别名仍保留原路径，排序和 fallback 不变。`verify` 2347 项、原 atom-ranks 三引擎、Chromium browser oracle 125／1267／38 及每引擎 654 组原生／字面对照通过；适用边界及完整运行证据见当前计划。

此前百分比切片在原安全展开边界内支持 margin／padding／inset／scroll-padding 的静态百分比，百分比计算由浏览器负责；scroll-margin 和负百分比 padding 保持原路径。`verify` 2400 项、原 atom-ranks 三引擎、Chromium browser oracle 125／1267／38 及每引擎 648 组原生／字面对照通过，具体验证与限制见当前计划。

最新字体长度切片在原安全展开边界内支持五族简单静态 em／rem，浏览器负责计算；负相对单位 padding 仍沿用原路径。`verify` 2452 项、原 atom-ranks 三引擎、Chromium browser oracle 125／1267／38 及每引擎 810 组原生／字面对照通过，具体验证与限制见当前计划。

最新架构切片提取 scope 路径、schema 和 JS／类型输出到内部模块，marker／atom membership、排序和 fallback 规则保持原流程。`verify` 2452 项及 537 个样本的完整 replacement／finalize 前后等价通过；此行为保持式移动未重跑浏览器 gate，详见当前计划。

## 当前阶段

owner 已决定有限 MVP 结项，已批准并完成官方 create-vite React TS 外部消费、Vite 8 实验及同模板 React Router Declarative／BrowserRouter 客户端路由验收。最新基础验证为 2452 项测试通过；Browser oracle 为 125 fixtures／1267 comparisons／38 controls，Playground 同范围通过。另已按 owner 授权完成 React Router Framework Mode 的有界 request-time SSR 实验；不覆盖历史 Firefox 失败或通用／完整 SSR。

owner 已要求按整体规划推进核心架构与排序目标，确认更强 GSS 语义优先、同高度逻辑先／物理后；[架构方向](ARCHITECTURE-DIRECTION.md) 和 [属性排序设计](PROPERTY-ORDER-DESIGN.md) 区分目标与当前行为。会话提交／失效、贡献准备与快照汇总已分离；产品包已迁至 `compiler/`、`adapters/react/`、`integrations/vite/` 和 `types/`，测试基础设施已迁至 `tests/`，示例职责尚待整理。可原子化的 pure ownership 规则内及跨规则累积的已登记逻辑／物理 longhand 对已准入。preserved 模式、shorthand 及其他上下文仍可能报告 GSS1206，同属性 rank／输出位置已分离，完整安全展开仍未完成。无法安全展开的既有输入暂时沿用当前 shorthand 处理和 fallback，不额外拒绝。

owner 仍要求**不自行新增框架或验收场景**。隐式 className 类型、native marker 策略和公共 stylesheet URL／插件数组返回值均已决策；不重复要求重选。property effects、selector marker、统一排序及会话事务／资源生命周期的有界核查已交付；遗留问题和授权边界见 [当前计划](NEXT-STAGE.md)。

## 会话事务／资源生命周期有界核查

基于 `e1cbcdf`，按[当时的核查顺序](NEXT-STAGE.md#已完成的会话资源核查顺序)先读现有测试与实现，再执行定向检查；没有新增运行时代码、测试、fixture、配置或公共契约。

- 会话入口：`compiler-session` 的 prepare／commit／finalize 与对应测试、`session-convergence`；宿主入口：Vite 插件 replacement 编排、`dev-css`、`stylesheet-url`。失败贡献在 commit 前退出，已提交 schema／CSS／export 不被替换；rank／scope 为新 contribution 局部数据。最新 task 身份防止旧异步读取反向覆盖；成功恢复清除失败标记，identical-byte recovery 仍更新 native CSS owner。既有输入未复现污染或恢复遗留。
- 资源入口：compiler `stylesheet-assets`／`asset-values` 与 Vite `stylesheet-assets`、`dev-assets`、`production-assets`、`production-census`、`production-output` 及已有测试。核对绑定身份、共享资源所有者、失败时字节快照保留、成功替换、static／lazy 可达集、aggregate CSS href／hash／manifest；未发现违约。dev 的一代旧 URL／30 秒退休保留既有 in-flight 契约，fallback 保留 URL 不构成问题。
- 断言不是只比较数量：convergence 比较 CSS、完整 manifest／report、单独 generation，target-aware 路径另比较 schema；但通用 helper 不比较 sourceMap，也不穷举每步 module code／诊断。已有失败全快照与 Unicode 顺序断言含 map，production watch／fresh 比较 manifest／CSS／map／report 并有独立字面预期。此处记录覆盖限制，不把未测组合认作 bug 或为扩覆盖新增测试。
- 四组定向检查 **339** 项通过；`corepack pnpm verify` 在重新 build 后再次覆盖这些测试，共 **2124** 项（1580／49／161／334）及 lint／build／types 通过。原始日志 `artifacts/lifecycle-consistency/01-session-baseline.log` 至 `05-verify.log`，详细检查及证据索引 `inspection.md`。无反例，无 root-cause fix／red→green。
- 仅复核已保存的 core-consistency browser initial／final 成功日志及历史 readiness 未归因记录；没有据通过样本宣称因果修复。本轮无 timeout，不新增采样或 browser／外部 SPA／SSR 执行。代码／宿主输出／排序均未改，无受影响浏览器 gate；历史浏览器证据仍是历史证据。

该轮已按两处有界核查的停止标准结束，不证明任意 CSS、并发时序或资源组合正确；`.gss` 删除、reload／state 保证、跨模块优先级、Firefox Article、性能及发布边界不变。新的架构和排序目标见当前阶段。

## 本轮核心一致性修复

基于 `451dd5c` 核对现有 registry、selector parser/emission 与相关排序规划器，修复 `mask` 缺失 mask-border reset-only effects、`corner-shape` 错判 singleton、nth-of global compound 误改 local、functional attribute 字符串／CSS escape 被破坏、嵌套 global wrapper 遗留及 runtime-source 漏做 marker rewrite。各修复在现有测试文件保留 red→green 回归；没有新框架、fixture 项目或验收矩阵。

owner 已明确将复杂 `:has()` 丢失 native specificity 作为 bug 修复：仅对已准入复杂 residual 保留完整原生 `:has(list)`，每条 emission 另用零 specificity 的 branch witness 保留观察身份；planner 不再用猜测的 class/type 数做这类 list 的强度判断。简单已有路径不变，不新增语法或 DOM 推理。独立 Chromium native/literal 对照在 weaker-only／stronger／both／none 及规则正反序均通过，分支来源与 LKG 回归保留。

owner 已确认统一固定策略：原生 strength／layer／condition／pseudo 上下文不变；已证明 ownership／结构语义高度优先，同高度潜在竞争属性按逻辑先、物理后输出，而不是原生 source order。相同属性及同类型同级声明仍按 authored occurrence 决胜。`module-order-policy.ts` 集中定义潜在重叠、属性优先级、保守复用屏障和属性输出总排序键（优先级／严格 shorthand 包含深度／稳定名称）。已覆盖原五类 box、size/min-size/max-size、border 各 aspect／radius、overflow／overscroll 的已登记方向 effects。潜在别名仍不当作 definite effect 剪枝，GSS1206 原准入／LKG 不变，无新语法／配置。

证据目录：`artifacts/core-consistency/2026-10-26-audit/`（baseline/remaining probes、各阶段 red logs、最终 verify/browser/playground logs、has-native-red/green）。该核心 bug 修复阶段的 browser oracle 125／1267／38 与 Playground dev/preview gate 重跑通过，未新增外部 SPA／SSR／Article 执行证据；后续统一排序阶段的 Article 两引擎复验见下文。

## 已完成交付

| 阶段 | 关键提交 | 已交付内容 |
| --- | --- | --- |
| 初始有限 MVP | `c99a0d3` | 编译器、React／Vite 及原生 CSS 对照基线；当时 1081 项测试通过 |
| Playground 与真实页面 | `e4ad1ba` 及其祖先，PR #29 | 中文 Playground、Fieldwork task-board、article/comments；真实交互、独立原生参考、精确图像比较；跨模块警告 `GSS2107` |
| 模块内固定排序 | `399444f`，PR #30 | 已准入的同模块多 scope 竞争统一排序，修复 target-local 排序不足 |
| 逻辑／物理属性排序 | `1012d98`，PR #31 | 潜在方向别名参与排序族及语义优先级候选，保留所有权／结构优先级 |
| 安全 rank 复用 | `dc9ad13`，PR #31 | 仅收缩连续、完整且符合条件的同语义 rank 桶，降低真实示例输出 |
| 核心 CSS／引用收敛 | 至 `088811d` | 隐式字符串引用、有限 alias、property/state 扩展、nth-of 和有界 native relation marker |
| 官方模板／Vite 8 | `c9013d1` | workspace 外公开 tarball 消费及 Rolldown census 修复，保留 Vite 7 回归 |
| 客户端路由 | `f54a963` | 官方模板中的 Declarative／BrowserRouter 用户路径 |
| Framework SSR／公共 CSS URL | `4b7a982` | 真实请求时渲染、无 JS 样式、hydration；`virtual:gss.css?url` 与 `gss(): Plugin[]` |
| 核心一致性修复 | `af02efe` | shorthand/reset、local/global marker、CSS 文本序列化与复杂 has 原生 specificity |
| 统一固定排序核心 | `e04327b` | 同语义高度逻辑先／物理后，统一潜在竞争／复用屏障，消除属性比较器循环 |

上述实现全部已合入 main，不存在待合并的正式交付分支。保留的 `prototype/module-local-atom-ranks` 是独立演示原型，不是待合入代码。

### 输出改善

安全复用前后，业务 CSS 不变：

| 示例 | 原子数 | CSS 字节数 |
| --- | --- | --- |
| Article | 147 → 131 | 21863 → 19545（约 -10.6%） |
| Task-board | 162 → 135 | 24181 → 20453（约 -15.4%） |

这是两个指定示例的结果，不是所有样式表的复用率保证。

## 必须保留的语义契约

1. **模块内排序**：先使用已证明的所有权／结构关系形成语义依赖高度，再按固定属性优先级（逻辑先、物理后），最后按原始规则 source ordinal 和声明位置规划 `orderSlot`。`atomRank` 只在同属性内计数，不作为跨属性排序键；source order 不是与语义边同等强度的图边，也不存在通用 selector 等级。
2. **原生层叠强度**：rank 不覆盖原生 importance／specificity。layer、条件和伪元素主体等上下文必须保持区分。
3. **来源身份**：共享声明对象不能替代 selector-list 分支身份；保留原始规则、分支、目标／来源／观察绑定，避免错误剪枝或覆盖。部分 shorthand 胜出及 scope membership 也不能丢失。
4. **不透明关系**：owner 已接受 equal-native-strength 的 `:global()`／`:has()` 竞争在缺少既定语义关系时按 source order 决胜；这不是扩大语法准入。
5. **逻辑／物理别名（统一固定策略替代旧 Policy B 的 source-order tie）**：潜在重叠用于排序，不代表确定相同 effect；同语义高度物理后发，不扩大 definite 删除、属性准入或运行时映射。浏览器仍负责 direction／writing-mode 映射。
6. **安全复用**：仅限语义高度为 0、无条件、简单单节点 pure occurrence，完整连续桶的 property／精确 value／importance 相同；同时保留最早的同属性 rank 和输出位置，不跨越竞争者，不重排后续编号；生成身份和汇总 key 均保留输出位置，不能仅按属性／值／局部 rank 合并。所有已建模方向 effects（含 shorthand）统一作为保守复用屏障；不再维护分散的五族正则。
7. **模块边界**：同模块多 scope 组合是支持能力；跨模块同节点优先级仍不支持。`GSS2107` 是保守、非阻塞诊断，不能通过禁用同模块组合来回避排序缺陷。
8. **准入与 fallback**：既有 external-target 保护及 last-known-good 行为保持不变。新语法、API、配置、fallback 或范围取舍需 owner 明确决定。

关键实现：[fixed-module-ranks.ts](../compiler/src/domain/fixed-module-ranks.ts)、[module-order-policy.ts](../compiler/src/domain/module-order-policy.ts)、[compiler-session.ts](../compiler/src/application/compiler-session.ts)。回归入口：[fixed-module-rank-reuse.test.ts](../compiler/test/fixed-module-rank-reuse.test.ts)、[logical-physical-order.test.ts](../compiler/test/logical-physical-order.test.ts)。

## 验收与已知边界

### 当前 main 的基础验证

本轮统一排序已运行 `corepack pnpm verify`：Compiler 1580、React 49、Vite 161、Testing 334，共 2124 项测试，另有 lint／build／类型检查通过。

### 浏览器证据

- 官方 React Router Framework Mode 8.5.0／Vite 8.3.5 workspace 外未修改 tarballs：Chromium dev 与实际 production server、请求级 loader token、无 JS 初始样式/资源、hydration/interactivity、导航/history/deep-link/reload 与负对照通过。新增公开 `virtual:gss.css?url` 通过标准 emitted asset URL 对接框架正常 `links()`；不声称 native route CSS extraction 或 streaming 验收。`gss()` 现在返回 plugin array，标准 Vite 配置不变，直接访问单插件 hooks 的消费者需调整。详见 [Framework SSR 验收](FRAMEWORK-SSR-ACCEPTANCE.md)。

- 官方 create-vite 9.3.1 React TS 在 workspace 外安装本地未修改 tarballs，Vite 8.3.5／plugin-react 6.1.2／React 19.3.1／TypeScript 6.0.3；Chromium install／类型／dev／build／preview、跨文件 implicit string className、资源、lazy、overlay／LKG／恢复及 state 记录通过。Rolldown census 缺失 implicit-load 字段已修复，Vite peer 扩展为 7 或 8；workspace 保留 Vite 7。详见 [验收报告](VITE-TEMPLATE-ACCEPTANCE.md)。
- 同一外部官方模板的 React Router 8.5.0 Declarative／BrowserRouter：Chromium dev 與 production preview 的 Link 导航、back/forward、lazy route、直接深链接／reload、route GSS literal style／资源和 central CSS census 通过，保留六个 HMR/LKG phases，新增 19 个 routing checkpoints／route corruption control。证据 `artifacts/vite-template/2026-10-26T06-45-04.945Z/`；Node >=22.22.0，部署依赖 SPA rewrite，不代表 SSR 或通用 host 已配置。详见 [验收报告](VITE-TEMPLATE-ACCEPTANCE.md#客户端路由验收后续-owner-授权)。
- 当前 Browser oracle：125 fixtures、1267 comparisons、38 controls；Vite host、SSG hydration、multipage lazy/hydration/state controls 通过。
- Task-board 三引擎真实用户路径：每引擎 76 phases、13 exact image pairs、dev HMR/LKG/recovery、父子 implicit `className`、production lazy/CSS census 通过。删除 `.gss` 不属于当前支持契约：独立实验发现 Chromium/Firefox/WebKit 的 overlay/LKG 行为不一致，因此当前只承诺文件修改、非法输入 LKG、恢复和显式重建；删除场景的失败 artifact 保留在 `artifacts/cross-browser-rendering/task-board/2026-10-23T04-10-04.608Z/`，不宣称删除重建已通过。
- 统一固定排序：原 atom-ranks gate 默认三引擎通过，逻辑／物理 carrier 仍为 418 simple／55 semantic、每引擎 2772 paired readings，额外保留 800 次原始 authored-native 断言。原生预期未被改成 GSS 结果：同 fixture 独立记录 raw CSS 值与显式 GSS physical-priority oracle；精确图像和 order corruption controls 保留。
- Article 受扩展 border 复用屏障影响，atomic census 131→132：form／field 的 identical border 不再跨 rank 合并。业务 CSS 未改；现有 per-engine 入口 Chromium／WebKit 各 82 phases／22 exact image pairs 与负对照通过。默认三引擎 Article script 未改，Firefox Article 未运行。历史 147→131／字节数表保留为当时结果，不是本轮数字。
- 本轮证据：`artifacts/unified-order-core/`（red、transitivity red、verify/browser/playground、Article 两引擎、census delta）；最终三引擎 rank 产物在 `artifacts/rank-integration/browser/`。首次 rank 全套因 300s wrapper 预算不足中断，后一次因 child 1800s session 上限中断，原始产物均已备份；增加有界预算后同入口全套通过，不是 readiness 缺陷修复。
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

Firefox Article 导航问题仍暂缓。包发布、其他框架适配器、新语法或新 fallback 均未获本轮授权。已选模板、路由和 SSR 任务已完成；Astro／Next.js／SWC 等不是下一项候选队列，owner 已要求停止新增验收场景。当前已讨论的架构和排序目标及未决事项见 [当前计划](NEXT-STAGE.md)。

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
