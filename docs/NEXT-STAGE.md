# 当前进度与后续工作计划

## 当前方向

owner 已决定：**不再新增框架或验收场景**。工作重心从扩展验收矩阵转为现有能力的正确性、契约一致性与真实缺陷修复。

有限 MVP、官方 Vite React TS 外部消费、客户端路由和 React Router Framework SSR 的已选任务均已交付。已交付宿主基线为 `4b7a982`；本轮基于 `451dd5c` 完成现有核心一致性核查与具体 bug 修复，owner 随后确认并已实现统一固定输出排序策略（同语义高度物理属性高于逻辑属性），而不是扩大 source-order overlap 族。历史失败、支持范围之外的输入和未覆盖组合不混计为当前缺陷。

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

## 已完成的收敛工作

### 1. 已完成：统一进度与契约文档

清除仍要求重选已完成类型契约、重做脚手架或继续新增框架的旧指引。保留历史证据及公共 API 变化，明确未测不等于失败。

完成标准：README、STATUS、HANDOFF、核心／CSS 盘点与本计划一致；引用的报告存在；本次整理不宣称新增运行证据。

### 2. 已执行：现有核心实现一致性核查

只核对已交付能力，不从“缺少某条 CSS／某个框架”推导新功能任务。优先检查最近扩展较多的两处：

- **Property effects**：已登记 shorthand/reset/longhand 是否正确，逻辑／物理潜在重叠是否按已批准统一固定策略排序，unknown property fallback 是否保持。
- **Selector marker**：已准入语法中的 local/global identity、嵌套遍历、原生 selector 结构与既有 ownership/schema 是否一致；不推理 DOM，不设计新 selector 语法。

本轮已沿上述入口核对并修复八类具体缺陷：mask reset-only effects、corner-shape family、nth-of global compound、functional 字符串空白、嵌套 global、runtime-source marker、CSS 属性控制字符 escape，以及复杂 has list 的 native specificity。只在现有文件补回归；独立原生期望和 red/green 证据见 [STATUS](STATUS.md#本轮核心一致性修复)。view-timeline-inset 与 background-blend-mode reset 经主资料核对后保留，未为扩大覆盖随意调整。

owner 已确认：既有语义高度优先，同高度潜在竞争属性固定逻辑先／物理后；同属性同级 authored tie 不变。统一核心集中处理 overlap、priority、reuse barrier 与无循环的属性 render key；原 GSS1206 准入不扩展，潜在别名不剪枝为同一 effect。后续核查仍区分“可复现违约／证据不足／契约限制”，不为了填表继续扩大范围。

### 3. 已实现：统一固定输出排序核心

`module-order-policy.ts` 是属性竞争、优先级与复用屏障的单一内部入口，module ranks 采用“语义高度 → 属性 priority → source ordinal／声明位置”；最终属性比较使用“priority → 严格 shorthand 包含深度 → 名称”的总键，消除旧 pairwise containment／lexical comparator 循环。

已登记五族 box、sizing/minmax、border/radius、overflow/overscroll 采用同一规则。物理属性后发只在原生强度／上下文与语义高度同级时决胜；不覆盖 important／specificity／更强 ownership。same-block 已拒绝的 margin/padding/inset 组合仍 GSS1206；已准入 sizing/border/radius/scroll 组合有回归。方向别名只用于排序与保守屏障，保留两侧写入应对运行时 writing-mode／direction。

现有逻辑／物理 browser carrier 保留 raw native oracle，并独立断言 GSS fixed-priority oracle，没有新增 fixture／项目／矩阵。下一步仅处理真实反例；没有新的已确认问题时，本任务结束，不自动扩功能或新建验收场景。

常规 bug、诊断和回归由 agent 连续处理，不逐小项询问。若修复需要改变产品能力、作者写法、公共 API／配置、架构或 fallback，先给具体选项和影响再决策。

### 4. 已交付

核心一致性修复 `af02efe`、统一排序 `e04327b` 均已提交并推送 main；没有待合并实现。以下遗留盘点与后续计划以 `e04327b` 为基线，不把已完成的 property/marker/排序核查重新排进任务队列。

## 遗留问题清单

| 分类 | 遗留项与影响 | 证据状态／处理方式 |
| --- | --- | --- |
| 已知历史失败，暂缓 | Firefox Article 的 dev→production 导航问题；该页面的 Firefox 验收仍不能宣称通过 | 原始失败保留；不是已证明的 compiler 根因，需 owner 明确恢复才诊断；其它三引擎 gate 通过不能替代它 |
| 未归因风险 | 通用 browser readiness 曾超时，影响验收稳定性与结果可信度 | 后续样本通过不是因果修复；先查已有失败证据。当前任务再现时保留现场并定位，不反复重试取绿 |
| 性能线索，暂缓 | 大型单模块及 no-op replace 成本；增量工作是否重复仍需测量 | 历史共享主机数据不是当前排序核心的基准或 SLA；不据此声称已有确定热点，不启动 profiling／优化 |
| 已接受限制 | 跨模块同节点竞争没有受支持的统一优先级 | 保留 `GSS2107` 非阻塞 warning；改变语义需单独决策，不靠 class 顺序解决 |
| 已接受限制 | `.gss` 删除的 overlay／LKG 不一致；class mapping 修改可能 reload／丢失 React state | 删除不属支持契约；文件修改、非法输入 LKG、恢复仍必须正确，不将限制扩大到这些受支持路径 |
| 有界能力缺口 | 部分 selectors／attributes、条件／layer／at-rules、复杂 values 与 resources 不支持通用推理 | 详见 [CSS 边界](CSS-CAPABILITY-AUDIT.md)；unknown effects 保持整 Module preserved 或配置 error，不能放宽 fallback 掩盖缺口 |
| 有界能力缺口 | React 可变 alias、跨文件 scope/data-flow、精确 IDE path completion | 保持当前有限静态 lowering；动态／未知路径保留普通 JS undefined。扩展属于能力与作者体验决策 |
| 验证／部署边界 | 外部 SSR 只覆盖指定 React Router／版本／Chromium；任意 server/client graph、相对 base、streaming 未获保证 | 沿用 [SSR 报告](FRAMEWORK-SSR-ACCEPTANCE.md)；本轮排序交付未重跑外部 SPA／SSR，不把历史证据视为最新重验 |
| 发布状态 | 包尚未公开发布，仍使用本地 tarball 验收 | publication／release／tag 需单独授权；不是实现缺陷 |

**本次盘点没有新复现的阻塞性产品 bug，也没有未完成的排序修复。** 上表不等于全部都要实现：历史失败、证据不足、已接受限制与能力缺口必须分别处理。

## 后续工作顺序

本次规划授权的是整理与排序，不自动恢复 Firefox Article／性能，也不启动新框架、验收场景或能力扩展。下一轮工程目标建议为：**受支持编辑路径下的会话事务与资源生命周期一致性**，不重做已经完成的 CSS 排序核查。

### 1. 第一优先：会话事务／恢复的一次有界核查

- 从现有 `compiler-session`、`session-convergence`、`dev-css`、`stylesheet-url` 等测试与对应实现入手，核对修改 → 非法输入 → LKG → 恢复 → finalize 的现有契约；不加入 `.gss` 删除要求。
- 重点检查失败更新是否污染已提交 CSS／schema／导出映射，恢复后是否遗留旧 rank、scope 或诊断；对已有 clean-build／增量对照核查是否比较了完整公共结果，而不只比较规则数量。
- 这些是待核对风险，不是已确认缺陷。先读实现与已有断言；发现具体反例后才在已有测试文件补 red→green 回归并修复，不为增加覆盖而新建浏览器场景。
- 完成标准：每个发现都有独立预期、最小反例、修复与相关 checks；未发现反例则记录入口和结论并结束此项，不承诺全量组合正确。

### 2. 第二优先：同一编辑链路中的资源／输出一致性

- 复用已有 `stylesheet-assets`、`dev-assets`、`production-assets`、`production-census` 与 `stylesheet-url` 载体，核对现有支持范围内的资源引用、旧资源回收、static/lazy census 与 CSS URL／hash／manifest 的一致性。
- 只检查当前实现声明支持的资源与宿主路径；不顺带增加 URL grammar、at-rules、route CSS extraction 或 server/client graph 能力。
- 同样先定位反例再改代码；没有发现则结束。若改动实际触及 Vite 宿主／URL 输出，复验受影响的既有外部 SPA／SSR gate；仅文档盘点不启动这些外部项目。

### 3. 验收稳定性：证据驱动，不独立扩矩阵

先整理现有 readiness 失败的阶段、日志与可用网络／页面证据，区分 harness／进程／服务就绪和真实样式错误。证据不足时明确未归因，不猜根因、不盲加 timeout。仅在当前受影响 gate 再现时做定向诊断，保留首次失败和负对照；不循环重跑直到绿。

### 4. 每项完成即交付；无反例即停止

实际修复运行相关测试和全仓 `verify`；浏览器行为／宿主输出改变时按既有入口执行受影响 gate，保留独立 oracle、精确图像和失败记录。通过后 commit/push main；报告问题、范围、检查和剩余限制。

两处有界核查结束后，没有具体缺陷就结束本轮。Firefox Article、性能、跨模块语义、新能力和发布均保持下方授权边界，不自动成为下一项。

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

本轮核心修复的新验证：Compiler 1580、React 49、Vite 161、Testing 334，共 **2124 项测试**，lint/build/types 通过；现有 browser oracle **125 fixtures／1267 comparisons／38 controls** 与 Playground dev/preview 重跑通过。原 atom-ranks 默认三引擎已重跑，逻辑 carrier 418／55 不变，保留 2772 paired+800 authored-native readings/engine；受 border 屏障影响 Article census 为132，Chromium/WebKit 现有入口各82 phases／22 exact image pairs通过，Firefox Article未重启。外部 SPA／Declarative 和 Framework SSR 的已交付证据仍保留，本轮没有重跑这两个外部项目。完整版本、产物和失败历史见对应报告；`verify` 不包含浏览器验收。

沿用独立 literal／原生预期、负对照与同引擎精确图像；不删断言或修改业务样式换取通过。浏览器入口及默认引擎范围保持不变，执行前先核对脚本。普通修复可补必要回归；“不新增验收场景”不是取消现有检查或禁止为真实缺陷补回归。

只在现有 `main` 工作；不自行创建分支／worktree。完成且相关检查通过的改动直接提交并推送；不完整或已知失败的实现不推送。语义契约和历史证据恢复见 [STATUS](STATUS.md)，新 session 从 [HANDOFF](HANDOFF.md) 开始。
