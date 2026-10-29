# 当前进度与后续工作计划

## 当前方向

owner 已要求开始推进核心架构与属性排序目标；[架构方向](ARCHITECTURE-DIRECTION.md) 记录当前实现、优先级、阶段状态和验证要求，[属性排序设计](PROPERTY-ORDER-DESIGN.md) 记录排序目标。会话提交／失效已从贡献准备与快照汇总中拆出，保持公共接口及行为。可原子化的 pure ownership 规则内及跨规则累积的已登记逻辑／物理 longhand 对已准入；preserved 模式、shorthand 和其他上下文仍可能报 `GSS1206`，同属性 rank 与跨属性输出位置已分离，完整安全展开及更宽复用仍未完成。

已确认原生强度／上下文和已证明的所有权／结构语义优先，同语义高度时逻辑属性先、物理属性后；同属性 rank 已与跨属性输出位置分开；shorthand 完整展开及更宽复用仍需设计。不能安全展开的既有输入暂时沿用原 shorthand 处理和 fallback，不额外拒绝。owner 仍要求**不自行新增框架或验收场景**；保留独立 oracle、历史失败及现有验证边界。

结构关系输出边界切片：将 atomic 输出中已规划结构实例的 source／中间／target marker、组合符和 selector 输出移至 [structural-emission.ts](../compiler/src/application/structural-emission.ts)。关系证明、scope 路径、specificity、逐声明排序绑定、fallback 与错误顺序不变；见 [架构方向](ARCHITECTURE-DIRECTION.md#原子与关系-marker-输出边界)。

结构／descendant／external／排序／会话／source map 定向 **673** 项及完整 `verify` **2454** 项（Compiler 1909／React 49／Vite 162／Testing 334）、lint／build／types 通过；541 个样本（含中间 marker 与 sibling 关系）的 parser／replacement／finalize 逐字段一致，四个歧义及两种 compatibility fallback／失败／恢复序列一致。首次 verify 因未使用类型导入在 lint 失败，已移除导入，保留失败 `verify.log` 与最终 `verify-final.log`；对照脚本和日志见 `artifacts/structural-emission-boundary/`。行为保持式提取未重跑浏览器 gate，不扩大结构 selector 或复用范围。

`:has()` 输出边界切片：将 atomic 输出中的 observation 生成移至 [observed-emission.ts](../compiler/src/application/observed-emission.ts)，共享声明身份类型移至 [planned-declaration.ts](../compiler/src/application/planned-declaration.ts)。逐 observation 排序绑定、本地 marker membership、复杂 list 的 native specificity 与多分支 witness 保持原逻辑；不改变准入、planner、排序或 fallback。

`:has()`／关系／排序／会话／source map 定向 **654** 项和完整 `verify` **2454** 项（Compiler 1909／React 49／Vite 162／Testing 334）、lint／build／types 通过；540 个样本（包括复杂 `:has(button, .error)`）的 parser／replacement／finalize 逐字段一致，四个歧义及两种 compatibility fallback／失败／恢复序列一致。脚本与日志见 `artifacts/observed-emission-boundary/`；行为保持式移动未重跑浏览器 gate，不扩大 `:has()` 能力。

Selector 形态准入切片：将 condition 组合及 pseudo／observation／属性／状态位置的既有检查集中到 selector-admission，保留两个调用点：条件形态在声明和逻辑／物理冲突前，其余形态在后。仍使用原 parser 规则判断 selector 形态、既有 atomicRules 判断声明；诊断优先级、语法准入与 fallback 不变，详见 [架构方向](ARCHITECTURE-DIRECTION.md#external-selector-上下文准入)。

selector／external／关系／会话／排序定向 **650** 项和完整 `verify` **2454** 项（Compiler 1909／React 49／Vite 162／Testing 334）、lint／build／types 通过；539 个样本 parser／replacement／finalize 逐字段一致，另有 7 个 selector／声明冲突优先级及 LKG 场景前后对照。脚本与日志见 `artifacts/selector-shape-admission-boundary/`；内部行为保持式移动未重跑浏览器 gate。

External selector 准入切片：将 local／external target／同节点 external 分类、`:global()` 检测及已有 external 限制移至 [selector-admission.ts](../compiler/src/application/selector-admission.ts)，保持其位于条件／声明与关系规划前。纯 ownership 外部路径及单 longhand base refinement 原限制、后续 marker／排序与 preserved 防线不变；见 [架构方向](ARCHITECTURE-DIRECTION.md#external-selector-上下文准入)。

external／结构／状态／会话及排序定向 **641** 项和完整 `verify` **2454** 项（Compiler 1909／React 49／Vite 162／Testing 334）、lint／build／types 通过；539 个样本 parser／replacement／finalize 及四个歧义／两种兼容 fallback 序列前后逐字段一致。日志和脚本见 `artifacts/selector-admission-boundary/`；行为保持式提取未重跑浏览器 gate，不扩展 external selector 准入。

原子／marker 输出边界切片：将贡献准备中已准入规则的 ownership、状态、pseudo、`:has()`、结构与 external 输出移至 [atomic-emission.ts](../compiler/src/application/atomic-emission.ts)，集中产出 atom、关系 marker、selector 和 scope membership。关系证明、排序规划、fallback 选择和 session 提交保持原阶段；每种输出分支、source、asset、条件和 external 拒绝仍沿用原规则。具体职责与反例见 [架构方向](ARCHITECTURE-DIRECTION.md#原子与关系-marker-输出边界)。

关系／排序／复用／external／会话定向 **735** 项和完整 `verify` **2454** 项（Compiler 1909／React 49／Vite 162／Testing 334）、lint／build／types 通过；539 个样本 parser／replacement／finalize 逐字段一致，四个关系／external 歧义诊断及两种兼容设置的 fallback／失败／恢复序列一致。初次定向运行因提取时遗漏主流程仍需要的 `classifyPropertyEffect` 导入导致 3 个 external 测试失败，已恢复导入并重验；原失败 `focused.log`、最终 `focused-final.log` 及对照证据保留在 `artifacts/atomic-emission-boundary/`。行为保持式提取未重跑浏览器 gate，不扩大 selector、fallback 或复用范围。

兼容性声明分析切片：提取 [compatibility-analysis.ts](../compiler/src/application/compatibility-analysis.ts)，集中物理序列、asset 保留和 importance 检查、语义身份到物理序列的映射与可能触发 preserved 的属性集合。调用方仍负责逻辑／物理冲突优先级、诊断和 fallback 选择；形态／asset 错误先于 importance 的顺序保持不变。见 [架构方向](ARCHITECTURE-DIRECTION.md#兼容性声明分析边界)。

兼容性／资源／external／会话定向 **330** 项、完整 `verify` **2454** 项（Compiler 1909／React 49／Vite 162／Testing 334）及 lint／build／types 通过；新回归覆盖转换失败、asset 丢失和 importance 变化，以及失败快照。539 个样本 parser／replacement／finalize 前后逐字段一致，两种兼容设置下 preserved／atomic／失败／恢复序列也一致。基线和日志在 `artifacts/compatibility-analysis-boundary/`；行为保持式重构未重跑浏览器 gate，不扩大 compatibility 或 fallback 范围。

Preserved 贡献边界切片：将已选择的整模块 fallback 生成移入 [preserved-contribution.ts](../compiler/src/application/preserved-contribution.ts)，包括 scope marker、原顺序 CSS、条件／layer、资源绑定、来源与 warning。原有进入条件、compatibility 检查、逻辑／物理冲突拒绝、原子规划、排序及 session 提交行为不变；具体约束见 [架构方向](ARCHITECTURE-DIRECTION.md#preserved-fallback-贡献边界)。

资源／compatibility／source map／会话定向 **329** 项及完整 `verify` **2453** 项（Compiler 1908／React 49／Vite 162／Testing 334）、lint／build／types 通过；539 个样本 parser／replacement／finalize 逐字段一致，另比较两种 compatibility 设置下 preserved→atomic→非法更新→恢复的完整输出和 schema。首次 verify 因遗留未使用类型导入在 lint 失败，失败日志和当时尚未重新 build 的比较输出保留；去除导入后重新 build，`verify-final.log`、`output-after.log` 与 `fallback-after.log` 才是最终证据，见 `artifacts/preserved-contribution-boundary/`。行为保持式移动未重跑浏览器 gate，不扩大 fallback 范围。

Adapter／宿主接缝有界核对：梳理 `GssSourceAdapter` 的同步三操作、Vite 依赖解析／编译／schema 注入／诊断流程，区分 CSS parser port；记录 React id／静态 import 限制、假 `.view` adapter 证据与 Vue／Svelte、虚拟 id、map 组合等未验证问题。公开 diagnostic 类型未声明 range，而 React 实际结果及 Vite formatter 可以携带／读取 range，不能以实现细节替代公共承诺。未改变 API、能力或框架，见 [架构方向](ARCHITECTURE-DIRECTION.md#adapter-与宿主接缝已实现和未验证部分)。

相关现有 React adapter **2** 项、Vite plugin **11** 项和 CSS parser seam **18** 项通过，日志在 `artifacts/adapter-seam-audit/`。最初并行执行中目录创建与日志重定向竞争，Vite／parser 命令没有启动（当时 Vite 包名也选错）；已记录并在目录创建后以正确包名执行。此项只核对并更新文档，不新增测试或重跑浏览器／外部框架验收；结果不能证明其他框架接入成功。

排序候选收集切片：将 descendant candidates、结构 instances、pseudo candidates、同节点／external 规则与逐 observation `:has()` 绑定的既有组合移入关系规划模块；顺序和纯 ownership 在 fallback 判定后的延迟候选生成保持原样。没有把剪枝后 instances 替代 candidates，也未改变 rank、语义高度、marker、准入或 fallback。

关系／排序／复用／external 定向 **513** 项、完整 `verify` **2453** 项（Compiler 1908／React 49／Vite 162／Testing 334）和 lint／build／types 通过；539 个样本 parser／replacement／finalize 输出逐字段一致，三个歧义诊断和失败后快照一致。脚本与日志见 `artifacts/order-candidates-boundary/`；行为保持式移动未重跑浏览器 gate。

关系规划编排切片：将 ownership／descendant／结构／observation 的既有分组和 descendant、结构、pseudo planner 顺序集中到 domain [plan-module-relations.ts](../compiler/src/domain/plan-module-relations.ts)；各 planner 仍各自证明关系，保持第一个歧义先于 compatibility／preserved fallback 返回、纯 ownership 的延迟路径和排序 candidate 与存活 instance 的区别。排序、marker、identity、准入及 fallback 不变，详见 [架构方向](ARCHITECTURE-DIRECTION.md#关系规划编排边界)。

关系／排序／external／会话定向 **654** 项、完整 `verify` **2453** 项（Compiler 1908／React 49／Vite 162／Testing 334）及 lint／build／types 通过。539 个样本 parser／replacement／finalize 完整输出逐字段一致；另对三个结构／状态歧义的 `GSS1205` 诊断及失败后快照做前后比较。脚本、基线及日志见 `artifacts/relation-planning-boundary/`。行为保持式内部移动未重跑浏览器 gate，不宣称关系证明或 selector 能力已全部统一。

资源冲突职责切片：把提交前的资源冲突检查从贡献构建器移入资源规划模块，会话只传入已有贡献的资源集合、替换 id 和候选资源；保持先检查同次输入及其他模块、跳过被替换模块的原行为，以及 `GSS1301`、事务提交和 LKG 规则。

资源／会话／收敛定向 **280** 项及完整 `verify` **2453** 项（Compiler 1908／React 49／Vite 162／Testing 334）、lint／build／types 通过。539 个样本 parser／replacement／finalize 完整输出前后逐字段一致；另对相同注册、冲突失败保持快照、恢复提交的事务序列做前后完整比较。脚本与日志见 `artifacts/resource-conflicts-boundary/`；行为保持式移动未重跑浏览器 gate，不改变资源 identity 或 fallback。

Parser selector 片段切片：PostCSS adapter 在单分支构建时以片段关联 class、状态、属性、observation 和 pseudo，再投影为原 `ParsedStyleRule` 平行数组；关系、parser port、planner、语法准入、排序及 fallback 不变。普通完整路径状态去重／排序与 external 提前返回保留原状态的差异均保留，后者已有针对性回归。边界及剩余工作见 [架构方向](ARCHITECTURE-DIRECTION.md#parser-内部-selector-片段)。

parser／port／准入／external／会话定向 **281** 项及完整 `verify` **2453** 项（Compiler 1908／React 49／Vite 162／Testing 334）、lint／build／types 通过。539 个样本的 parser 原始结果、replacement 与 finalize 前后逐字段一致；脚本、基线和日志见 `artifacts/parser-segment-boundary/`。本次保留外部 port 和输出，未重跑浏览器 gate；不据此宣称 planner 平行数组或 selector 支持已全面重构。

条件上下文边界切片：将未注册条件／layer 诊断、按上下文分组及既有条件身份编码集中到 [condition-context.ts](../compiler/src/application/condition-context.ts)。保留 wrapper 顺序、layer 分区和 warning 策略，不把身份编码视为条件等价／互斥证明，不改变排序或 fallback；契约见 [架构方向](ARCHITECTURE-DIRECTION.md#条件与-layer-上下文边界)。

条件／layer／keyframes／会话及来源定向 **375** 项和完整 `verify` **2452** 项（Compiler 1907／React 49／Vite 162／Testing 334）、lint／build／types 通过；539 个样本完整 replacement 与 finalize 前后逐字段一致（含附加条件、layer 和 keyframes 场景）。脚本、基线与日志见 `artifacts/condition-context-boundary/`。本次行为保持式内部重构未重跑浏览器 gate，未扩大条件推理和既有能力。

规则形态边界切片：将贡献准备中 ownership、状态、属性、结构、pseudo、observation 的既有判断集中到 domain [rule-classification.ts](../compiler/src/domain/rule-classification.ts)，逻辑／物理冲突检查复用共享 ownership 形态，但继续单独排除 external target／condition。谓词并非互斥分类或 DOM 证明；调用方的准入、planner 路由、排序、fallback 和规则顺序未改变，详见 [架构方向](ARCHITECTURE-DIRECTION.md#规则形态判断与上下文准入)。

相关排序／external／结构／会话 **722** 项和完整 `verify` **2452** 项（Compiler 1907／React 49／Vite 162／Testing 334）、lint／build／types 通过；538 个既有样本的完整 replacement 与 finalize 前后逐字段一致。基线、脚本和日志在 `artifacts/rule-classification-boundary/`；本项仅为行为保持式内部重构，未重跑浏览器 gate，不将既有 external、parser 和 planner 边界视为完成。

关系 selector 渲染边界切片：将组合符、属性条件、状态后缀和原生 selector 渲染集中到 [selector-rendering.ts](../compiler/src/application/selector-rendering.ts)；原生片段内局部 class 仍通过 scope 树登记 marker，`:global()` 不产生局部 membership。关系规划、`:has()` specificity／witness、marker 身份、preserved selector、排序及 fallback 均保留原路径；职责和反例见 [架构方向](ARCHITECTURE-DIRECTION.md#关系-selector-与局部-marker-渲染边界)。

关系／`:has()`、会话收敛和 source map 定向 **362** 项及完整 `verify` **2452** 项（Compiler 1907／React 49／Vite 162／Testing 334）、lint／build／types 通过。原 534 个排序样本及 4 个 scope／preserved／shorthand／资源样本，共 **538** 个样本完整 replacement 和 finalize 前后逐字段一致，包含 CSS／map／manifest／schema／代码／诊断／generation；其他 selector 形态由现有定向测试覆盖。脚本、基线及日志见 `artifacts/selector-rendering-boundary/`。本次为行为保持式移动，未重跑浏览器 gate；不从输出等价推导支持更多 selector 或跨关系复用。

资源规划边界切片：提取 [resource-planning.ts](../compiler/src/application/resource-planning.ts)，集中 keyframes 引用检查／重写、全局资源输出、身份、asset 绑定、兼容性转换及来源信息；`PlannedResource` 也随职责移动。资源冲突检查仍在提交前执行，失败不污染已提交贡献；排序、marker、fallback、资源准入和公共接口保持原流程。契约和反例见 [架构方向](ARCHITECTURE-DIRECTION.md#全局资源规划的职责边界)。

资源、兼容性、source map、会话和收敛定向 **329** 项，以及完整 `verify` **2452** 项（Compiler 1907／React 49／Vite 162／Testing 334）、lint／build／types 通过。原有 534 个排序样本与 4 个特殊 scope／preserved／shorthand／全局资源样本，共 **538** 个样本的完整 replacement 和 finalize 前后逐字段一致，包括 CSS、map、manifest、schema、代码、诊断与 generation；asset 引用及兼容路径另由已有定向测试覆盖。比较脚本、基线、定向与全量日志保存在 `artifacts/resource-planning-boundary/`。本次为行为保持式内部移动，未重跑浏览器 gate；跨模块资源事务和其他未测输入不因比较结果扩大保证。

Scope 输出边界切片：从 `module-contribution.ts` 提取 [scope-exports.ts](../compiler/src/application/scope-exports.ts)，集中 scope 路径收集、schema 及 JS／类型导出生成；原子和 preserved 路径共用该内部模块。marker／atom membership 仍由原 planner 决定，排序、fallback、identity 和公共接口均未改变。路径顺序、class 去重及排序、特殊导出名称与保留属性的契约见 [架构方向](ARCHITECTURE-DIRECTION.md#scope-输出的职责边界)；关系规划本身仍未合并。

会话、收敛和 source map 定向 **273** 项及完整 `verify` **2452** 项（Compiler 1907／React 49／Vite 162／Testing 334）、lint／build／types 通过。基于当前代码重建前后，原有 534 个排序 fixtures 加 3 个特殊 scope、preserved marker 和 shorthand 样本，共 **537** 个样本的完整 replacement（含导出代码、类型声明、schema、诊断）及 finalize（CSS／map／manifest／report／generation）逐字段完全一致。比较脚本、基线和日志见 `artifacts/scope-exports-boundary/`。本次纯内部移动且公共输出逐字段相同，未重跑浏览器 gate；三引擎及 oracle 仍是上一切片的验证记录。

静态字体相对长度展开切片：五族物理／逻辑轴 shorthand 在既有安全竞争边界内支持简单数字 `em`／`rem`，可与已支持值混用；原值交由浏览器计算。padding 两族仍不展开带负号形式，负 em／rem 不纳入已批准的负 px 无效值过滤；其他单位、复杂值、别名屏障和 fallback 保持原路径。设计和反例见属性排序文档。

`verify` **2452** 项（Compiler 1907／React 49／Vite 162／Testing 334）及 lint／build／types 通过。回归覆盖五族、物理／逻辑轴、跨 scope 顺序、importance、selector-list、来源／source map、失败更新／恢复、负值和未支持值。每引擎 810 组 scope 与独立 authored-native CSS 的逻辑／物理值一致，未竞争侧另有字面 `32px` 断言，覆盖 LTR／RTL／vertical-rl，见 `artifacts/safe-font-length-expansion/browser-regression.mjs`／`.log`；初始 46 项 red 和既有浏览器产物备份在同目录。不声称其他长度单位、复杂表达式或负相对单位 padding 已正确处理。

原 atom-ranks 默认 Chromium／Firefox／WebKit 入口通过（`rank-browser.log`）：每引擎固定排序 50 fixtures／182 comparisons／91 exact image pairs，逻辑／物理 418 simple + 59 semantic／2852 paired + 800 authored-native readings／3 image pairs，以及 96 state comparisons／32 image pairs；负对照和 external-target 边界均通过。Chromium browser oracle 125 fixtures／1267 comparisons／38 controls 与 Vite host、SSG、multipage 检查通过（`browser-oracle.log`）。最终完整检查日志为 `verify-final.log`；本次未重验外部 SPA／SSR、Article 或性能。

静态百分比展开切片：`margin`／`padding`／`inset`／`scroll-padding` 的物理和逻辑轴 shorthand，在既有安全竞争边界内支持简单数字百分比与静态 px／零混合；百分比原样分配给 longhand，由浏览器计算。`scroll-margin` 不接受百分比；padding 两族不展开负号形式，既有无效 padding 过滤仍只处理已批准的静态负 px。`var()`／复杂值、别名屏障、compatibility 和 preserved 路径不变。设计、规范及反例见属性排序文档。

`verify` **2400** 项（Compiler 1855／React 49／Vite 162／Testing 334）及 lint／build／types 通过。新增有界回归覆盖物理与逻辑轴分配、正反顺序／importance、跨 scope／selector-list、source map、失败更新／恢复、负数与原 fallback；开发期 52 项 red 保存在 `artifacts/safe-percentage-expansion/red.log`。每引擎 648 组 scope 结果在横排 LTR／RTL 和竖排与独立 authored-native CSS 的逻辑／物理值一致，未竞争侧另有字面 `2px` 断言，见 `browser-regression.mjs`／`.log`。初始浏览器检查中 WebKit 普通块布局的 margin 受布局约束，原生和生成结果一致但字面 `2px` 断言不成立；保留 `browser-regression-initial-failure.log`，改为 inline-block 消除该约束后重验全部三引擎。旧排序产物及 browser-reference 已备份在同目录；不声称负百分比 padding 的旧误剪枝问题已修复，也不新增滚动吸附交互或复杂值语法支持。

原 atom-ranks 默认 Chromium／Firefox／WebKit 入口通过（`rank-browser.log`）：每引擎固定排序 50 fixtures／182 comparisons／91 exact image pairs，逻辑／物理 418 simple + 59 semantic／2852 paired + 800 authored-native readings／3 image pairs，以及 96 state comparisons／32 image pairs；原负对照和 external-target 边界均通过。原 Chromium browser oracle 125 fixtures／1267 comparisons／38 controls 与 Vite host、SSG、multipage 检查通过（`browser-oracle.log`）。本次未重验外部 SPA／SSR、Article 或性能。

静态逻辑轴展开切片：现有五族 `margin`／`padding`／`inset`／`scroll-margin`／`scroll-padding` 的 `inline`、`block` shorthand 复用同一流程，1–2 个静态 px／零值展开为 start/end；不在编译期映射物理方向。沿用同规则 longhand 竞争与受限跨单节点 scope 入口；该轴遇其他潜在重叠属性时保留原路径。双轴互不重叠，可独立展开；importance、来源、selector-list、scope membership、rank／输出位置和 fallback 契约不变，负值过滤仍只限已批准的普通 padding。完整规则、反例和规范依据见属性排序文档。

该切片 `verify` **2347** 项（Compiler 1802／React 49／Vite 162／Testing 334）及 lint／build／types 通过。新增 88 项回归覆盖两端分配、正反顺序和重要性、跨 scope／selector-list、来源／source map、LKG／恢复、双轴独立、end 竞争、负值和 alias／非 pure／compatibility／preserved 边界。`artifacts/safe-logical-box-expansion/` 保留最初 76 个预期失败的 `red.log`、通过的 `focused.log`、`verify.log` 及最终增加两个边界回归后的 `verify-final.log`。每引擎另有 654 组 scope 结果与独立 authored-native CSS（两逻辑侧、四物理侧）和字面逻辑侧预期一致，覆盖 LTR／RTL／vertical-rl、正反顺序、重要性、独立／组合 scope、变量和合法负值，见 `browser-regression.mjs`／`.log`。未新增框架、滚动吸附交互或通用复杂值支持。

该切片原 atom-ranks 默认 Chromium／Firefox／WebKit 入口全部通过（`rank-browser.log`）：每引擎固定排序 50 fixtures／182 comparisons／91 exact image pairs、逻辑／物理 418 simple + 59 semantic／2852 paired + 800 authored-native readings／3 image pairs，以及 96 state comparisons／32 image pairs；原负对照和 external-target 边界断言均保留并通过。原 Chromium browser oracle 125 fixtures／1267 comparisons／38 controls 与 Vite host、SSG、multipage 检查通过（`browser-oracle.log`）。先前排序产物及 browser-reference 已备份在同目录；外部 SPA／SSR、Article 和性能未新增运行证据。

静态 scroll box 展开切片：`scroll-margin`／`scroll-padding` 复用现有四方向展开，支持静态 `px`／无单位零；前者可为负值，后者仅接受无负号值。保留普通 ownership／已登记属性／无 compatibility 的入口，同规则物理 longhand 竞争或受限跨单节点 scope 竞争时展开；新两族一旦存在逻辑方向别名竞争，整个属性族保留原路径。`auto`、百分比、`var()`、复杂值、原 fallback 及无效值过滤边界不变，`atomRank`／`orderSlot` 策略不变。规则及规范依据见属性排序文档。

该切片 `verify` **2259** 项（Compiler 1714／React 49／Vite 162／Testing 334）及 lint／build／types 通过。新增 37 项回归覆盖四方向分配、重要性和顺序、selector-list／scope membership、源位置／map、重复声明失败／恢复、alias／非 pure／compatibility／preserved 边界。`artifacts/safe-scroll-box-expansion/` 保留初始 red、测试配置和 preserved warning 断言修正、lint 失败及最终 `verify-final.log`；旧浏览器产物已备份。原 atom-ranks 默认三引擎入口通过，保留每引擎 418 simple／59 semantic、2852 paired／800 authored-native readings 及原有精确图像和负对照（`rank-browser.log`）。每引擎另有 43 组 scope、每组四侧的独立 authored-native／literal 对照通过，覆盖独立／组合 scope、正反顺序、重要性、变量和负 scroll-margin（`browser-regression.mjs`／`.log`）。原 Chromium browser oracle 125 fixtures／1267 comparisons／38 controls 与 Vite host、SSG、multipage 检查通过（`browser-oracle.log`）。此处验证声明和计算样式等价，未新增滚动吸附交互、外部 SPA／SSR 或其他框架验收。

排序 occurrence 建模切片：新增 `order-occurrences.ts`，集中声明、selector 分支与 target／source／observation 的身份收集；语义高度与 rank 使用同一具体模型，生成阶段以具名绑定查询 rank，已有 planner instance 直接传递。声明候选和原始下标、Map 去重、effect 竞争族、rank 数字、class 身份及复用规则均保持现状。parser 平行数组与各关系 planner 尚未整体统一。重构前后既有 363 项排序／复用／来源／收敛定向测试通过，最终 `verify` 2211 项及 lint／build／types 通过；534 个既有 rank fixtures 的完整 replacement（含导出代码、类型声明、schema、诊断）和 finalize（CSS／map／manifest／report／generation）与 `e9b42bc` 基线完全一致。日志、比较脚本及基线在 `artifacts/order-occurrences/`；没有改动测试 oracle，也未新增浏览器运行证据。

同属性 rank／跨属性输出分离：`atomRank` 按属性独立编号，`orderSlot` 保留原 effect 竞争族在语义高度 → 固定属性 priority → authored tie 上的输出投影。生成／汇总身份保留两个数，最终比较器只读取输出位置；连续安全桶复用时同时复用二者，不重编号后续声明。原生强度、`relationRank`、准入、静态展开及不安全 shorthand／compatibility／preserved 路径保持原契约。生成的 ranked class 增加 `--order_` 编码，仍从 schema／导出取得，不增加公共配置或 manifest 字段。完整证明、反例及当前保守复用边界见属性排序文档。

本项 `verify` **2222** 项（Compiler 1677／React 49／Vite 162／Testing 334）及 lint／build／types 通过。新增回归验证独立编号、未展开 shorthand 正反顺序、不同输出位置的跨模块复用隔离、名称编解码及 LKG／恢复／插入顺序收敛；最初 4 个 red 与旧 class 编码断言的调整过程保留。534 个既有排序 fixtures 在把新名称映射回旧输出位置编码后，完整 replacement 与 finalize 投影一致（排除随名称长度变化的 source-map mappings，保留 sources／内容／来源比较，map 另由既有回归验证）。证据 `artifacts/property-rank-separation/`：`red.log`、`focused.log` 保留开发期失败，`verify-final.log` 与 `projection-final.log` 为最终结果。原 atom-ranks 默认三引擎入口通过：每引擎固定排序 50 fixtures／182 comparisons／91 exact image pairs，逻辑／物理 418 simple + 59 semantic／2852 paired + 800 authored-native readings／3 image pairs，另有 96 state comparisons／32 image pairs；原负对照和 external-target 边界检查均通过，见 `rank-browser.log`。每引擎另通过 12 项独立 native／literal 对照，覆盖模块插入顺序、不同位置同 rank 的复用隔离、LTR／RTL、未展开 `var()` 及计算时无效值，见 `browser-regression.mjs`／`.log`。原 Chromium browser oracle 125 fixtures／1267 comparisons／38 controls 与 Vite host、SSG、multipage 检查通过，见 `browser-oracle.log`。先前浏览器产物已在同目录备份；外部 SPA／SSR、Article 和性能未新增执行证据。

后续仍需逐项证明完整 shorthand 展开与更宽复用，不从本次分离推导通用 CSS 支持。现有输出位置屏障和语义高度保持有效；删除竞争族、跨输出位置复用或扩大 fallback 均不能当作机械清理。

静态 inset 展开切片：复用四方向展开，`inset` 对应 `top`／`right`／`bottom`／`left`，支持静态 px（包括负值）及无单位零。适用既有同规则和无条件、未分层单节点跨 scope 的安全边界；`auto`、`var()`、逻辑方向别名、compatibility 和 preserved fallback 沿用既有路径。独立同属性 rank、其他 shorthand 和复杂值仍未完成。 最终 `verify` 2211 项及 lint／build／types 通过；原 atom-ranks 三引擎入口与 Chromium browser oracle 125／1267／38 通过，每引擎另有 7 组、21 个原生 CSS 与 literal scope 对照。原始产物备份、red 与验证日志见 `artifacts/safe-inset-expansion/`。

静态 padding 展开切片：复用静态四方向展开，同时对 shorthand 和对应 longhand 仅接受无负号的 px／无单位零；`margin` 继续允许负值。适用既有同规则和无条件、未分层单节点跨 scope 的安全边界；该切片当时对负值、`var()`、方向别名、compatibility 及 preserved fallback 沿用原路径；随后已按下述无效 padding 修复处理确定无效的静态负 px。独立同属性 rank、其他 shorthand 及复杂值仍未完成。`verify` 2179 项及 lint／build／types 通过；原 atom-ranks 三引擎及 Chromium 独立 browser oracle 125／1267／38 通过，每引擎另验证 18 个 scope 结果和 2 个无效值控制，日志及历史产物备份见 `artifacts/safe-padding-expansion/`。

无效 padding 修复：原 `.a { padding-left: 9px; padding: -1px; }` 在三引擎原生值为 9px、GSS 为 0px（证据 `artifacts/safe-padding-expansion/invalid-order-probe.log`），owner 已批准修复可确定无效的静态负 px。无 compatibility、属性均已登记且无 external target／condition 时，规划前忽略可确定无效的物理／逻辑 padding shorthand 和 longhand；合法 `-0`、`var()`、未知语法及 preserved／compatibility 路径保留；重复声明和逻辑／物理冲突检查在过滤后、展开前进行，不因已丢弃的无效声明误报，有效重复声明仍保留原诊断。其他单位、external、compatibility 下的无效值行为未纳入此切片。 最终 `verify` 2194 项及 lint／build／types 通过；原 atom-ranks 三引擎入口通过，另每引擎 11 个 literal／独立原生 CSS 对照通过，Chromium browser oracle 125／1267／38 通过。red、最终日志与旧产物备份见 `artifacts/invalid-padding/`；先后为调整冲突和重复声明检查而主动中断的两次 rank 验收及其产物也分别保留。

跨 scope 静态 margin 展开切片：在既有普通 ownership、已登记属性、无 compatibility 限制之外，仅当所有规则为无条件、未分层的单节点 scope，所有 margin／物理侧值均为静态 px／无单位零，且不存在其他潜在重叠属性时，可将不同规则的 margin 展开。两种声明顺序、各自／组合 scope、importance 和来源均需保留；动态值、方向别名及其他上下文保持旧路径。`verify` 通过 2163 项及 lint／build／types；原 atom-ranks 三引擎入口保留并通过全部精确图像与负对照，独立 Chromium browser oracle 125／1267／38 与 Vite host、SSG、multipage 通过。另在每引擎验证 6 种声明和 18 个单 scope／组合 scope 的独立计算样式结果，包含两种源码顺序、importance 与变量值。日志及原产物备份见 `artifacts/cross-scope-margin/`。

静态 margin 展开切片：普通 ownership、无 compatibility、所有属性已登记的模块内，同一规则的 `margin` 与物理 margin longhand 共存且值均为静态 px／无单位零时，将 1–4 个值展开后处理覆盖；原始声明校验、source map 和整模块 preserved fallback 保留。`var()`、复杂值、单独 shorthand、其他 selector／属性、跨规则完整展开和独立 rank 仍沿用当前行为。owner 已确认无法展开的 shorthand 在同强度下遵循正常源码顺序：后写 margin 可覆盖更早的 margin-left；更早声明的 !important 仍优先，不改该 fallback。 `verify` 通过 2155 项及 lint／build／types；原 atom-ranks 三引擎入口全部通过，每引擎 418 simple／59 semantic、2852 paired／800 authored-native readings 和原有精确图像／负对照。另对每引擎 8 条显式计算样式和两种 scope 组合顺序检查，包括无效变量及重要性；日志与先前产物备份见 `artifacts/safe-margin-expansion/`。

排序器职责拆分：将既有语义边和高度计算从 `fixed-module-ranks.ts` 移到 `semantic-order-heights.ts`，竞争族和 rank 编号策略不变；当前高度仍在 effect 重叠竞争族内计算，不是独立同属性 rank 的完成。排序、复用、逻辑／物理和收敛定向 236 项及 `verify` 2139 项、lint／build／types 通过；本次为行为保持式拆分，未重跑浏览器 gate。

会话拆分检查：Compiler 会话、收敛、名称及 parser seam 共 249 项定向测试通过；`corepack pnpm verify` 的 lint、build、2124 项测试和 typecheck 通过。该切片没有修改 CSS 输出或宿主行为，未运行浏览器 gate。

快照拆分：`finalize-snapshot.ts` 负责汇总已提交贡献、排序、CSS／map／manifest／report；`module-contribution.ts` 继续负责准备贡献，session 负责提交及失效。仅移动现有逻辑，未改排序或公开接口。会话、收敛、source map、资源及 `:has()` 共 291 项定向测试通过；`corepack pnpm verify` 共 2139 项及 lint／build／types 通过。输出逻辑未改，未重跑浏览器 gate。

编译器目录迁移：`packages/compiler` 已迁至顶层 `compiler/`，包名 `@gss-l/compiler` 和公共导出保持不变；workspace、lockfile、TypeScript、文档链接及外部模板／SSR 打包路径已更新。`corepack pnpm install --frozen-lockfile --offline`、`corepack pnpm verify`（2139 项及 lint／build／types）、原 `vite-template:check` 与 `framework-ssr:check` 通过。外部验收证据分别位于 `artifacts/vite-template/2026-10-27T09-23-08.508Z/` 和 `artifacts/framework-ssr/2026-10-27T09-24-02.425Z/`；仍只代表既有有界范围。其余产品包及测试基础设施随后迁移。

Adapter／集成／类型目录迁移：React 移至 `adapters/react/`，Vite 移至 `integrations/vite/`，共享类型移至 `types/`；保留现有包名和公共导出，更新 workspace、lockfile、类型配置、文档链接和两个外部打包入口。冻结 lockfile 离线安装、`verify`（2139 项及 lint／build／types）、原 `vite-template:check` 和 `framework-ssr:check` 通过；证据在 `artifacts/vite-template/2026-10-27T09-27-06.889Z/` 与 `artifacts/framework-ssr/2026-10-27T09-27-51.059Z/`。

测试基础设施目录迁移：原 `packages/testing/` 已迁至顶层 `tests/`，包名与现有验收入口不变，Playground 仍位于 `tests/playground/`，示例职责尚待整理。冻结 lockfile 离线安装、`verify`（2139 项及 lint／build／types）、Chromium 独立 browser oracle（125 fixtures／1267 comparisons／38 controls）、Playground dev／preview、外部 Vite 模板与 Framework SSR 通过；外部证据分别在 `artifacts/vite-template/2026-10-27T09-31-40.733Z/` 和 `artifacts/framework-ssr/2026-10-27T09-32-01.152Z/`，原 browser 和 Playground 产物备份在 `artifacts/testing-layout/previous/`。本次未重跑 atom-ranks、Task-board 或 Article 浏览器 gate。

同规则 longhand 切片：先确认 `margin`／`padding`／`inset` 的 longhand 正反顺序由 `GSS1206` 拒绝，再在现有 rank 规划下仅放开同一 pure ownership 规则、同一来源的 longhand 对；preserved／兼容性失败路径保留旧冲突诊断与 LKG。现有 Playground 示例同步为 atomic，Vite 生产构建有回归。最终 `corepack pnpm verify`：Compiler 1588、React 49、Vite 162、Testing 334，共 2133 项及 lint／build／types 通过。原 atom-ranks 三引擎入口通过，每引擎保留 418 simple／55 semantic、2772 paired／800 authored-native readings 和负对照，另测 60 条同规则方向读取。该 gate 开始后补了 preserved／兼容性失败保护，随后对最终 build 的三引擎各复核 60 次计算样式及 preserved fallback／LKG；日志见 `artifacts/same-rule-logical-physical/`，原 rank 产物备份于该目录的 `browser-before/`。独立同属性 rank、安全 shorthand 展开及其他上下文仍未完成。

跨规则 pure ownership longhand 切片：先以父子 scope 的逻辑／物理两种强弱关系复现 GSS1206，再开放可原子化的已登记 longhand 对；已证明的 ownership 仍先于固定属性顺序。Compiler 对 margin／padding／inset 的两种强弱及正反源码顺序有定向回归，shorthand、外部目标及 preserved／兼容性路径继续保留既有保护。最终 `corepack pnpm verify`：Compiler 1594、React 49、Vite 162、Testing 334，共 2139 项及 lint／build／types 通过；首次全仓运行中 Vite 的诊断位置测试仍用新准入输入作负例，更换为仍拒绝的 shorthand 后重跑通过，首次失败保存在 `artifacts/ownership-longhands/verify.log`。原 atom-ranks 三引擎入口每引擎通过 418 simple／59 semantic、2852 paired／800 authored-native readings、精确图像和负对照；原 Chromium browser oracle 125／1267／38 与 Vite host、SSG、multipage 通过。日志及先前结果备份在 `artifacts/ownership-longhands/`。独立同属性 rank、安全 shorthand 展开和非 pure ownership 上下文仍未完成。

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

当时已确认：既有语义高度优先，同高度潜在竞争属性固定逻辑先／物理后；同属性同级 authored tie 不变。统一核心集中处理 overlap、priority、reuse barrier 与无循环的属性 render key；当时 GSS1206 准入未扩展，潜在别名不剪枝为同一 effect。新目标见上方当前方向。

### 3. 已实现：统一固定输出排序核心

`module-order-policy.ts` 是属性竞争、优先级与复用屏障的单一内部入口，module ranks 采用“语义高度 → 属性 priority → source ordinal／声明位置”；最终属性比较使用“priority → 严格 shorthand 包含深度 → 名称”的总键，消除旧 pairwise containment／lexical comparator 循环。

已登记五族 box、sizing/minmax、border/radius、overflow/overscroll 采用同一规则。物理属性后发只在原生强度／上下文与语义高度同级时决胜；不覆盖 important／specificity／更强 ownership。same-block 已拒绝的 margin/padding/inset 组合仍 GSS1206；已准入 sizing/border/radius/scroll 组合有回归。方向别名只用于排序与保守屏障，保留两侧写入应对运行时 writing-mode／direction。

当时的逻辑／物理 browser carrier 保留 raw native oracle，并独立断言 GSS fixed-priority oracle，没有新增 fixture／项目／矩阵。该轮已结束；后续设计以当前方向为准。

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

**当时的盘点没有新复现的阻塞性产品 bug，也没有未完成的排序修复。** 此后新增的排序目标尚未全部实施；上表不等于全部都要实现。

## 已完成的会话资源核查顺序

owner 已批准并完成以下 1–4 的一次有界工程核查：**受支持编辑路径下的会话事务与资源生命周期一致性**。未找到新的受支持契约反例，故本轮仅记录核查与验证，不新增实现／测试，不重做已完成的 CSS 排序核查，也不恢复 Firefox Article／性能或扩展框架与能力。

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

两处有界核查结束后结束该轮。当前新目标见本文开头；Firefox Article、性能、跨模块语义及发布仍保持原授权边界。

### 本轮执行结果（基线 `e1cbcdf`）

- **会话事务／恢复**：读现有 `compiler-session`、`session-convergence`、`dev-css`、`stylesheet-url` 测试及对应实现。编译器仅在 prepare 与资源冲突检查成功后替换 contribution／递增 generation；失败不替换 CSS、scope schema 或 module export，恢复重新生成 rank／scope。Vite 仅为最新成功 replacement 更新资源快照，失败保留 LKG，identical-byte recovery 仍发 native CSS update。未发现反例。
- **比较范围**：现有 convergence 比较完整 CSS、manifest（含 selector、importance、来源）与 report，并单独检查 generation；target-aware 路径另比较 schema。通用 `withoutGeneration` **不含 sourceMap**，也不逐步比较所有 moduleCode／declarationCode／诊断，不将其描述成所有公共字段的全覆盖。已有失败快照断言包含 sourceMap，Unicode 顺序测试包含 map；production-assets 的 watch／fresh 对照比较完整 manifest、CSS、map、report，另有独立字面资源／所有者预期。未因覆盖缺口自行新增测试。
- **资源／输出**：读 compiler `stylesheet-assets`／`asset-values` 与 Vite `stylesheet-assets`、`dev-assets`、`production-assets`、`production-census`、`production-output` 及插件编排。核对已有绑定／别名、失败资源更新、共享注册所有者变化、资源字节快照、static／lazy census、CSS href／hash／manifest。dev 保留一代旧资源、30 秒后退休是现有 in-flight 处理；preserved fallback 中仍有 URL 不是缺陷。未发现反例；aggregate CSS 与既有 graph 边界不变。
- **检查**：四组定向执行共 **339** 项通过（241 会话／收敛、28 dev-CSS／URL、27 compiler-assets、43 Vite-assets／census）。另运行 `corepack pnpm verify`：Compiler 1580、React 49、Vite 161、Testing 334，共 **2124** 项及 lint／build／types 通过。命令与原始日志、检查笔记在 `artifacts/lifecycle-consistency/`（01–05 logs、`inspection.md`）。没有新缺陷，red→green 不适用。
- **readiness 与停止点**：只复核已保存的 core-consistency browser initial／final 成功日志与现有 STATUS 的历史未归因记录；成功不能解释旧 120 秒超时。本轮定向检查无 timeout，不启动新 browser／外部 SPA／SSR 或 flake 采样。仅文档变动，不涉及宿主／URL 输出或排序，故不重跑其浏览器 gate。

两处有界核查已结束；结果是**所读实现与既有测试输入未找到反例**，不是全 CSS、所有编辑时序或所有资源组合的正确性证明。无新实现待推进；下一产品目标未指定时停止，不从下表自动取任务。提交／推送由本轮 parent 在独立审查后处理。

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
