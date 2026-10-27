# 核心工作流与架构方向

> 状态：目标与现状映射；owner 已要求开始推进。会话职责已完成第一步拆分，同规则 longhand 已有有界准入；独立 rank 与安全 shorthand 展开的完整目标尚未实施。当前运行行为以 [STATUS](STATUS.md) 和代码为准；进度与下一步见 [NEXT-STAGE](NEXT-STAGE.md)。

## 产品目标与现有边界

GSS 以 CSS 为输入，生成可组合的 scope 引用、原子 CSS 与必要的关系 marker。框架源码 Adapter 负责静态引用转换，构建工具负责文件、依赖、资源和交付；Compiler 不依赖 React 或构建工具。同模块 scope 组合支持既定的所有权／结构语义；跨模块同节点优先级尚不支持。原生 importance、specificity、layer、条件和浏览器匹配仍生效，不承诺任意 CSS 都能原子化。

## 核心工作流：当前实现

1. **宿主与 Adapter**：Vite 调用 Adapter 判断源码、发现 `.gss` import；宿主解析路径、读取源码和资源并编译依赖，再提供 scope schema。React Adapter 对可证明的引用做有限 lowering，返回代码、map 和诊断；动态／未知路径、alias 与跨文件能力有既定边界。
2. **解析与准入**：PostCSS 解析并展开 nesting，保留原始来源，按 selector 分支构造路径、状态和关系。Compiler 验证支持范围、资源、声明、条件与兼容性；当前未知 effect 可整模块 preserved，其他不安全输入拒绝，失败保留 last-known-good。
3. **语义与规划**：绑定 scope target／source／observation，按属性 effect 确定竞争与存活声明；后代、结构、伪元素和 `:has()` 等路径分别规划，并为可证明的语义关系和模块内组合生成排序信息。普通 ownership 路径不必对应 DOM 祖先；需要状态／结构关系时生成 selector，实际匹配由浏览器负责。
4. **marker 与 atom**：scope 导出包含 class 字符串。`gss-a` 表示声明；`gss-s`／`gss-t`／`gss-c` 表示关系来源、目标和中间节点；`gss-hs`／`gss-ho` 用于 `:has()` 的 subject／observed。marker 放入对应 scope，浏览器同时匹配 class、状态及 DOM 关系。复杂 `:has(list)` 保留原生 specificity 和分支身份。
5. **复用与提交**：相同输出身份可在 finalize 汇总；模块内连续相同 pure occurrence 仅在既有证明条件下复用，不能跨竞争者或丢失 scope membership／来源。完整贡献及资源冲突检查成功后 session 才替换旧版本；失败不污染旧结果。
6. **宿主交付**：Vite 开发期跟踪最新异步任务、资源与 CSS 更新；生产期按最终可达 static／lazy 图中的快照汇总 CSS、map、manifest 和资源。aggregate CSS URL 与已交付的 SSR 接入范围见 [STATUS](STATUS.md)。

现状入口：[compiler-session](../packages/compiler/src/application/compiler-session.ts)、[module-contribution](../packages/compiler/src/application/module-contribution.ts)、[CSS parser](../packages/compiler/src/infrastructure/postcss-stylesheet-parser.ts)、[React Adapter](../packages/react/src/index.ts)、[Vite](../packages/vite/src/index.ts)。

## 排序：已确认的目标

目标设计详见 [属性展开、原子排序与复用](PROPERTY-ORDER-DESIGN.md)。owner 已确认：在原生强度及可比较上下文相同的条件下，**已证明的所有权／结构语义优先；语义高度相同才按逻辑属性先、物理属性后**。浏览器决定方向映射。更强语义属于逻辑属性时也不能让物理属性固定顺序覆盖它；这一决定不再重问。

同属性 atom 的 rank 保留同模块组合和 authored occurrence；不同属性的潜在重叠使用固定属性顺序，不把潜在别名当作确定相同 effect 剪枝。不同属性的局部 rank 数值不能直接互相比较。当前已允许可原子化的同一 pure ownership 规则中的已登记逻辑／物理 longhand 对，包括 `.a { margin-inline-start: 1px; margin-left: 2px; }`；preserved 模式、跨规则累积、shorthand 和其他上下文仍有原准入保护。独立同属性 rank 的目标尚未完成。

可证明安全时先展开 shorthand，按 importance／声明顺序处理同规则的同名 longhand；不能对 `var()`、复杂语法或隐含 reset 猜测展开。owner 已决定不能安全展开的既有输入暂时沿用当前 shorthand 处理和 fallback，不额外拒绝；具体安全展开范围、实现算法和所有 rank／属性／语义交叉规则仍需设计。现有 Lightning CSS 兼容性转换不是已验证的通用 shorthand 展开器。Tailwind 属性排序是参考，不直接替代 GSS 语义。

现有排序涉及目标内 effect 胜出、结构关系的 `relationRank`、模块组合的 `atomRank`、最终 CSS 输出比较；这些是不同职责，不能把局部 rank 当成全局优先级。现有实现把潜在重叠的不同属性放入竞争族；目标是分离同属性 rank 与跨属性顺序，同时保留语义证明和来源身份。不能未经证明地使用 `(语义高度, 属性, rank)` 总键：高度依赖竞争族，atom 可能跨绑定共享，需证明全局一致、传递性和复用安全。

## 优先级与现状映射

| 优先级 | 目标 | 当前证据与待设计 |
| --- | --- | --- |
| 1 | 统一规则绑定、occurrence 和身份 | `ParsedStyleRule` 使用多组下标对应数组；rank 结合规则／声明对象、target、source、observation 构造身份。设计模型时保留 selector 分支、局部绑定和全部来源。 |
| 2 | 理清贡献构建、会话提交和快照 | 已将会话提交／失效从贡献准备与快照汇总中拆出；`module-contribution.ts` 内的准入、planner 和生成仍需进一步划分。 |
| 3 | 分离语义证明、同属性 rank、固定属性顺序及最终输出 | 保留原生强度、语义高度与 opaque 关系的既定约定；不要仅调整 comparator 或删除 `GSS1206`。 |
| 4 | 集中关系计划、marker 和 scope membership | 统一可共享的身份与生成计划，保留不同关系的专用证明；不可假设 ownership 等价于 DOM 祖先。 |
| 5 | 明确 property effect、潜在别名和准入 | `supportsCurrentBackgroundRanks` 是有界特例，先解释现有安全证明，再判断是否能替代。 |
| 6 | 检验 Adapter／宿主的实际 seam | React／Vite 分离有用，但只有一个实现不能证明 Vue、Svelte 或其他构建工具可直接接入；不预建通用插件框架。 |
| 7 | 让仓库第一层反映职责 | 目标候选为 `compiler/`、`adapters/react/`、`integrations/vite/`、`types/`、`tests/`、`examples/`、`docs/`；保留包名与独立参考实现，目录属于待实施提案。 |

删除候选而非已授权删除：`validate-state-ambiguity.ts` 静态搜索未见调用；可读名称完整解码器主要由测试使用，但其可逆性／碰撞断言可能有价值；`NameAllocatorPort` 和 `CssParserPort` 还支持内部测试。先核实使用与替代验证，再决定。保留独立参考实现、精确图像、负对照及历史失败证据。

## 阶段与完成标准

| 阶段 | 状态 | 完成标准 |
| --- | --- | --- |
| 核心工作流和目标梳理 | 本文完成初步映射 | 已区分当前行为、目标和未决问题；不声称完整语义证明。 |
| 排序／展开详细设计 | 进行中 | 属性排序文档已列出 occurrence 约束候选及独立预期；仍需证明跨竞争族／共享 atom 的无循环投影，定义具体 shorthand、reset、来源与不安全情况。涉及新 fallback／范围须 owner 决策。 |
| 仓库及编译器迁移 | 已开始 | 会话生命周期已分离，相关 249 项定向测试及 `verify` 通过；贡献准备与快照仍在同一内部模块。其余切片基于已审阅模型推进，保留包接口和能力；目录迁移先核实 workspace、外部消费和脚本路径。 |
| 验证与交付 | 依实现切片执行 | 同规则正反顺序、不同 scope、同属性多 rank、强弱 ownership／结构、LTR／RTL／writing-mode、importance／specificity／layer／条件、selector 分支、资源／map／LKG 均用受影响的既有载体和独立预期核对；保留原生 oracle 和显式 GSS oracle。运行相关检查及 `verify`，宿主／浏览器输出改变时核对实际入口并运行受影响既有 gate。 |

owner 已要求开始推进目标；按已确认语义及这里的阶段推进，不逐个询问常规实现切片。超出已确认行为的 fallback 或尚未确定的语义范围仍需 owner 决策。仍不自动新增框架、演示项目或验收矩阵；Firefox Article、性能和发布边界见 [STATUS](STATUS.md)。
