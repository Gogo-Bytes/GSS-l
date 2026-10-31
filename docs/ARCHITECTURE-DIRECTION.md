# 核心工作流与架构方向

> 状态：目标与现状映射；owner 已要求开始推进。会话职责和排序器语义高度已拆分，同规则 longhand 已有有界准入；同属性 rank 与输出位置已分离，完整安全 shorthand 展开仍未完成。当前运行行为以 [STATUS](STATUS.md) 和代码为准；进度与下一步见 [NEXT-STAGE](NEXT-STAGE.md)。

## 产品目标与现有边界

GSS 以 CSS 为输入，生成可组合的 scope 引用、原子 CSS 与必要的关系 marker。框架源码 Adapter 负责静态引用转换，构建工具负责文件、依赖、资源和交付；Compiler 不依赖 React 或构建工具。同模块 scope 组合支持既定的所有权／结构语义；跨模块同节点优先级尚不支持。原生 importance、specificity、layer、条件和浏览器匹配仍生效，不承诺任意 CSS 都能原子化。

## 核心工作流：当前实现

1. **宿主与 Adapter**：Vite 调用 Adapter 判断源码、发现 `.gss` import；宿主解析路径、读取源码和资源并编译依赖，再提供 scope schema。React Adapter 对可证明的引用做有限 lowering，返回代码、map 和诊断；动态／未知路径、alias 与跨文件能力有既定边界。
2. **解析与准入**：PostCSS 解析并展开 nesting，保留原始来源，按 selector 分支构造路径、状态和关系。Compiler 验证支持范围、资源、声明、条件与兼容性；当前未知 effect 可整模块 preserved，其他不安全输入拒绝，失败保留 last-known-good。
3. **语义与规划**：绑定 scope target／source／observation，按属性 effect 确定竞争与存活声明；后代、结构、伪元素和 `:has()` 等路径分别规划，并为可证明的语义关系和模块内组合生成排序信息。普通 ownership 路径不必对应 DOM 祖先；需要状态／结构关系时生成 selector，实际匹配由浏览器负责。
4. **marker 与 atom**：scope 导出包含 class 字符串。`gss-a` 表示声明；`gss-s`／`gss-t`／`gss-c` 表示关系来源、目标和中间节点；`gss-hs`／`gss-ho` 用于 `:has()` 的 subject／observed。marker 放入对应 scope，浏览器同时匹配 class、状态及 DOM 关系。复杂 `:has(list)` 保留原生 specificity 和分支身份。
5. **复用与提交**：相同输出身份可在 finalize 汇总；模块内连续相同 pure occurrence 仅在既有证明条件下复用，不能跨竞争者或丢失 scope membership／来源。完整贡献及资源冲突检查成功后 session 才替换旧版本；失败不污染旧结果。
6. **宿主交付**：Vite 开发期跟踪最新异步任务、资源与 CSS 更新；生产期按最终可达 static／lazy 图中的快照汇总 CSS、map、manifest 和资源。aggregate CSS URL 与已交付的 SSR 接入范围见 [STATUS](STATUS.md)。

现状入口：[compiler-session](../compiler/src/application/compiler-session.ts)、[module-contribution](../compiler/src/application/module-contribution.ts)、[finalize-snapshot](../compiler/src/application/finalize-snapshot.ts)、[CSS parser](../compiler/src/infrastructure/postcss-stylesheet-parser.ts)、[React Adapter](../adapters/react/src/index.ts)、[Vite](../integrations/vite/src/index.ts)。

### Scope 输出的职责边界

[scope-exports.ts](../compiler/src/application/scope-exports.ts) 负责按路径汇集贡献规划阶段已经决定的 atom／marker class、形成 scope schema，并生成模块导出及声明类型。它不判断 selector 匹配、决定 marker 触发、剪枝声明、规划排序或选择 fallback；这些决定继续由各自 planner／贡献准备负责。原子化和整模块 preserved 两条路径共用同一输出实现，但两者赋予 scope 的 marker 不因此变成相同语义。

该边界保留既有行为：路径节点与目标按原插入顺序建立，schema 中同一节点的 class 按现有规则排序并去重，代码输出的字段按既有规则排序；selector-list、状态来源和 `:has()` 观察目标的 membership 由调用方按原规则添加。`__proto__`、保留字及生成变量名冲突需要保持可用的自有属性和合法导出；空路径仍是内部不变量错误。移动实现不改变 atom／marker 名称、identity、rank／orderSlot、资源、source map、诊断或 preserved 内容。

此切片只将 scope 输出从 `module-contribution.ts` 提取为内部模块，尚未统一不同关系 planner 的证明，也不提供新的框架适配接口。后续 selector 节点迁移及验证见 [当前计划](NEXT-STAGE.md)。

### 全局资源规划的职责边界

后续身份核对（2026-10-31）：通用 readable-name 编码和 opaque asset identity 都保留原 Unicode 序列，不进行 NFC 归一化；资源仍保留既有 ASCII 转义的 typed-parts 序列化格式。已修正 `asset-values.ts` 中声称通用编码器会归一化的过时注释，没有删除转义或改变 class／资源身份。`readable-name` 和 `stylesheet-assets` 的既有 Unicode 区分回归包含在 `9216360` 的完整 verify 中；本次仅注释／文档修正，无新运行行为。

[resource-planning.ts](../compiler/src/application/resource-planning.ts) 负责 keyframes 引用歧义检查与名称重写，以及 `@property`、`@font-face`、`@keyframes` 的资源身份、CSS、兼容性转换、asset 绑定和来源位置规划。贡献准备仍决定处理顺序、诊断与 preserved 路径；[compiler-session.ts](../compiler/src/application/compiler-session.ts) 仍在提交前调用资源冲突检查，失败保留已有贡献。快照汇总只消费已提交的规划结果，不重新解释资源语义。

身份和来源不能只按输出 CSS 简化：相同 `@font-face` 签名或 `@property` 名字可能对应不同定义，必须保留冲突检查；asset 的身份与最终 URL 分离，兼容转换不能丢失原资源引用；keyframes 同名但不同模块需要各自生成名称。animation shorthand 的关键字／timeline 名称歧义继续沿用现有拒绝行为，frame／descriptor 只有唯一名称时保留对应位置。重构不改变上述决策、顺序、marker、排序或 fallback。资源冲突检查已与资源规划位于同一内部模块，会话仍在提交前调用；资源准入及剩余贡献流程没有整体统一，验证范围见 [当前计划](NEXT-STAGE.md)。

### 关系 selector 与局部 marker 渲染边界

[selector-rendering.ts](../compiler/src/application/selector-rendering.ts) 根据已规划的关系渲染组合符、属性条件、状态后缀和原生 selector 片段，并在原生片段引用局部 class 时通过 scope 树登记对应 marker。调用者仍决定何时需要 source／target／subject／observed marker、关系语义和 specificity；该模块不作 DOM 匹配或规划排序。

例如 `:global(.outside)` 内的 class 保持全局语义，不能登记为局部 scope；嵌套的功能性 pseudo 内局部 class 则需要改写并登记，否则 selector 会引用不可触发的 marker。属性值继续通过 selector parser 序列化，转义和引号不能靠字符串拼接替代。`:has()` 的 native specificity 与分支 witness 仍由现有调用路径决定，组合符空白、state `self` 和原始顺序保持现状；整模块 preserved 的 selector 改写仍是独立路径。本次仅移动共用渲染逻辑，不更改语法准入、marker 身份、fallback 或 atom 顺序；各关系 planner 的统一模型仍未完成。验证见 [当前计划](NEXT-STAGE.md)。

### 规则形态判断与上下文准入

[rule-classification.ts](../compiler/src/domain/rule-classification.ts) 集中贡献准备中使用的 ownership、当前／祖先状态、属性、结构关系、pseudo 和 observation 形态判断。它们是可重叠的谓词，不是互斥枚举，也不单独决定语法准入、planner 路由或 DOM 关系。各调用方继续保留自己的上下文条件。

普通 ownership 的共享形态要求全部关系为 descendant，且无状态、属性、observation 或 pseudo；这一形态本身不检查 external target／condition。逻辑／物理冲突验证的本地准入还必须排除两种 external 上下文，不能因为共享函数而误放宽 `GSS1206`。安全 shorthand 展开的其他条件、已证明的结构优先级、marker 规划和 fallback 均不由该判断单独决定。原有 predicate 条件和调用顺序保持不变；已移除 selector 规划投影，不同 planner 的证明仍独立。验证范围见 [当前计划](NEXT-STAGE.md)。

规则形态判断及 background 特例准入现直接遍历节点条件，节点顺序仍是 authored path 顺序；形态判断保留原先可重叠的语义，不能将节点模型当作额外的 DOM 或能力证明。逻辑／物理冲突检查仍单独排除 external，分组键按节点编码状态、属性、observation 和 pseudo；它与旧四组数组键的上下文相等关系一致，不能仅按节点名称合并，未扩大准入。

### 条件与 layer 上下文边界

[condition-context.ts](../compiler/src/application/condition-context.ts) 集中贡献准备中的未注册条件／layer 诊断、按 layer 与条件分组及现有条件身份编码。规则和 keyframes 的条件／layer 均参与诊断；诊断顺序及 warning 级别保持原样，未注册不等同于拒绝提交。条件按原有顺序编码，空条件为 `base`；分组不证明不同表达式互斥或逻辑等价，也不能跨 layer、条件边界合并 atom。

该模块不负责条件求值、浏览器匹配、semantic height、最终输出排序或 fallback；那些职责仍由各自 planner 和浏览器处理。现有键格式、wrapper 顺序与冲突边界未变，复杂条件推理和通用归一化不属于本切片。验证见 [当前计划](NEXT-STAGE.md)。

### Parser 内部 selector 片段

PostCSS parser 将每个局部 class 的名称、状态、属性、observation 和 pseudo 保存在同一个只读 `ParsedSelectorNode` 中；`CssParserPort` 直接返回节点数组及节点间关系。状态、属性、observation、pseudo 四组平行数组及规则上的 ownership `path` 字段均已移除，贡献准备直接使用 parser 结果，不再经过 `projectForPlanning`。

**2026-10-30 owner 决策：只读 nodes + 派生函数，先不加 WeakMap 缓存。** [getOwnershipPath](../compiler/src/domain/ownership-path.ts) 按需从节点提取名称，返回只读路径值；节点是唯一名称来源。一次操作内可用局部变量复用结果，但不将其重新存入规则。函数没有隐藏状态，不依赖数组身份；不采用 getter，避免对象展开将 getter 求值成独立字段；WeakMap 只能识别对象身份，不能感知原地修改，也没有当前性能证据要求缓存。

例如 `.root:hover .item` 的名称投影为 `['root', 'item']`，不能用它替代 hover 条件或证明 DOM 后代。名称改变应构造新的只读节点输入，再派生路径；原节点的派生结果仍保留原名称。只读是 TypeScript 约束，不增加运行时冻结或响应式机制。parser 的构建片段仍可变，返回后的节点与数组不得修改。

Parser 与规划共用 `ParsedStyleRule` 节点规则结构，删除过渡的 `ParsedSourceRule` 同义别名；selector-list 的分支独立且共享的声明数组／对象保持共享，来源、sourceOrdinal 和条件／layer 保留。删除准备阶段的投影不改变公共 Adapter 或输出身份。`targetPath`／`sourcePath` 是规划绑定结果，仍独立保存：`.root .item` 的 ownership 目标可以包含额外中间 scope，不能用 authored 名称投影替换实际绑定。occurrence 按路径内容识别，不依赖派生数组对象相同。

需要 authored 节点数量、来源位置及 specificity 时直接读取节点；需要 ownership 匹配、marker 身份或名称切片时调用派生函数。关系 planner 的专用证明和绑定尚未整体统一；这次移除重复表示不合并 descendant、结构和 observation 语义。

分支身份、源码跨度、嵌套展开、selector-list 声明共享与诊断不得因此变化。普通完整路径继续去重／排序状态；既有 external target／condition 的提前返回保留原始状态顺序和重复项，不能在行为保持式重构中悄然归一化。外部目标对应的末尾 descendant 关系仍按旧规则去除。此切片不扩大 selector 准入、不改变 marker、排序或 fallback；验证见 [当前计划](NEXT-STAGE.md)。

### 关系规划编排边界

[plan-module-relations.ts](../compiler/src/domain/plan-module-relations.ts) 集中贡献准备中的关系 planner 编排：先按既有形态选择 ownership、descendant、结构及 observation 规则，再依次运行适用的 descendant、结构、pseudo 规划；第一个歧义仍返回原 `GSS1205`，并且先于兼容转换／preserved fallback 判定。各 planner 继续分别负责其语义证明，不能把这些规则视为互斥分类或假定 ownership 就是 DOM 祖先。

只有出现既有条件或结构关系时才提前运行 descendant 规划；纯 ownership 路径仍按原流程在需要排序候选时调用，不应为了合并流程而改变它的时机或支持范围。声明路径、selector 分支、observation 和 candidate／存活 instance 的区别也保留：排序候选不能直接以剪枝后的输出实例替代。 排序候选收集也归此模块：依次保留 descendant candidates、结构 instances、pseudo candidates、同节点／external 规则和逐 observation 的 `:has()` 绑定；纯 ownership 的候选仍在 compatibility／preserved 判定后按需生成。`supportsCurrentBackgroundRanks` 特例、语义高度、`atomRank`／`orderSlot`、marker 和 fallback 均未改变；规则绑定及 planner 内部模型仍未整体统一。验证见 [当前计划](NEXT-STAGE.md)。

通用 ownership 路径匹配位于 [ownership-path.ts](../compiler/src/domain/ownership-path.ts)：规则路径和目标末节点必须相同，前缀按顺序匹配子序列，因此 `.root .item` 的 ownership 可以与包含额外中间 scope 的目标组合。它不证明真实 DOM 祖先；结构组合符、条件来源和运行时 witness 仍由各自 planner 证明。声明胜出、关系规划、语义高度、background 准入与逻辑／物理冲突校验共同使用此函数，不再让通用规划依赖特定属性的准入模块。声明胜出和冲突校验此前单独匹配完整子序列并要求末节点相同；末节点相同时，完整子序列可将最后一次匹配放在目标末尾，与匹配前缀子序列等价，包括重复名称和空路径。匹配边界、声明胜出、冲突准入与排序未变；验证见 [当前计划](NEXT-STAGE.md)。

### 当前节点 background 排序准入

`planDescendantConditions` 对已保留、同一 layer／条件及 specificity 下可同时生效且无法证明蕴含、互斥或存在更强交集的不同声明，通常返回 `GSS1205`。仅当冲突 effect 是 `background-color` 且 `supportsCurrentBackgroundRanks` 通过时，才允许现有模块排序处理这种冲突；这不是所有属性或所有状态均可按源码顺序处理的证明。检查所有潜在竞争规则的原始声明，而非仅检查剪枝后的胜出者，以免遗漏后续仍可能生效的竞争。

该准入只允许相关背景声明是 `background-color` longhand，未分层、无条件、无 external、结构关系、observation 或 pseudo-element；状态只能是目标节点单个 `hover`／`focus`，属性条件也只能在目标节点且每个节点最多一个。路径判断是 ownership 子序列，不推断 DOM 祖先。external target 可能落在任意 anchor 下，因此其背景 effect 要在整个模块检查；不竞争的 external 属性不应触发此屏障。普通 `background` shorthand、`:active`、祖先状态及其他属性冲突不能借此特例放行；例如两条 `color` 状态冲突仍可能报告 `GSS1205`。

在通过准入的路径中，关系规划仍先保留各 predicate 的胜出声明，再将剪枝前 candidates 提供给固定模块排序；原生 importance／specificity、语义高度、同属性 rank 和输出位置继续各司其职。没有触发冲突种子的既有可用输入不因为此检查而额外拒绝；已有 external selector 准入诊断也先于关系规划。此特例是保守准入规则，并非通用 CSS 覆盖证明；是否替代或扩展须先证明竞争闭包、marker 与复用等价，不能仅把属性名泛化。现有回归与验证范围见 [当前计划](NEXT-STAGE.md)。

### Adapter 与宿主接缝：已实现和未验证部分

当前公开的 [GssSourceAdapter](../compiler/src/application/source-adapter.ts) 是同步的三个操作：`supports(id)` 选择宿主交给适配器的源码；`discoverImports({id, source})` 返回原始 `.gss` import specifier，不读文件；宿主解析并成功编译这些依赖后，`transform` 通过原始 specifier 查询对应 `ScopeSchema`，返回代码、可选 v3 source map 和诊断。它是**框架源码适配接口**，与编译器内部将 CSS 转为 `ParsedStyleRule` 的 [CssParserPort](../compiler/src/application/css-parser-port.ts) 是两个不同接缝。

Vite 当前将 transform 的原始 `id` 与源码交给 adapter；对发现的 specifier 去重、解析到 GSS 虚拟模块、添加 watch、编译后建立 specifier→物理文件映射，再执行 transform、报告诊断和返回 map。找不到可解析的 GSS 依赖时宿主报错；transform 中未发现依赖则清理该源码的依赖记录。React adapter 用 Babel 处理 JS／TS／JSX／TSX，发现顶层静态 `.gss` import 并执行其有限静态 lowering；其 `supports` 按文件名后缀匹配，不能据此假设带查询参数的虚拟 id 会命中。具体语法、alias 和动态引用能力以实现和测试为准。

现有 Vite 测试用简单 `.view` 假 adapter 证明 schema 可在宿主与非 React adapter 间传递，并不是 Vue／Svelte 解析、模板绑定、插件顺序、虚拟子模块 id、HMR 或 source map 组合的验证。当前接口是同步 transform，依赖发现通过字符串 specifier；这些约束是否适合某个框架，需要按真实输入和宿主生命周期验证。owner 已确认将 `range?: GssSourceRange` 加入公开 `SourceAdapterDiagnostic`：它是相对于 `id` 所指源码的零起始 UTF-16 半开区间。React 可继续提供范围，Vite 在范围有效且属于当前源码时生成位置和代码框；缺失、无效或不属于当前源码的范围仍不生成定位。该可选类型扩展不改变运行时行为，不代表 Vue／Svelte 已接入；其他 adapter 协议扩展仍需结合具体需求决定。

### Preserved fallback 贡献边界

[preserved-contribution.ts](../compiler/src/application/preserved-contribution.ts) 接收贡献准备已经选择的整模块 preserved 路径，生成原顺序 CSS、scope marker／schema、资源绑定、来源位置及 `GSS1104` warning。是否可进入该路径仍由贡献准备按既有 unknown effect、compatibility、`atomizationFallback`、`:global()` 和逻辑／物理冲突检查决定；该模块不决定准入，也不把 preserved 内容当成 atomic rule。

正常与 preserved 路径共享 scope 导出和已规划资源，但 selector 的 marker 改写各有专用规则；preserved 必须保留原声明顺序、条件／layer wrapper、`:has()` 观察 class、asset 身份及 compatibility 展开的来源偏移。不能从普通路径的固定逻辑／物理顺序推导 preserved 同样安全，也不能因为 fallback 提取就移除现有冲突拒绝。失败更新仍由 session 保留旧贡献；本次不改变任何诊断顺序、语法或公共接口。验证范围见 [当前计划](NEXT-STAGE.md)。

### 兼容性声明分析边界

[compatibility-analysis.ts](../compiler/src/application/compatibility-analysis.ts) 负责按已提供的 compatibility transformer 分析声明的物理序列、验证 asset 引用和 importance、建立原语义声明到物理序列的映射，并识别属性名发生变化的序列。asset 身份仍经过现有绑定逻辑；同一语义 atom 的多个物理值不会被当成独立 atom。

[compatibility-transformer.ts](../compiler/src/application/compatibility-transformer.ts) 是应用层已有转换能力的内部契约：声明按顺序返回物理序列，资源按种类转换，不能保留时返回 `undefined`。Lightning CSS 是基础设施实现，由编译器入口按配置创建并注入；应用层不从具体实现导入类型。该契约不决定失败诊断或 fallback，不是新增公共配置或对其他转换器能力的承诺。

分析按原顺序先检查无法转换／asset 丢失，再检查 importance；调用方在返回对应错误之前仍优先执行原逻辑／物理冲突检查。物理序列的写入和查询共用属性、已识别值、asset 标记与 importance 四字段身份；例如普通文本与相同序列化内容的 asset 值不能混用。该键及查找由分析模块负责，贡献准备只按已生成规则的身份取结果。属性名变化是否进入整模块 preserved、遇 `:global()` 或配置 error 是否拒绝，仍由贡献准备决定；分析模块不选择 fallback，也不改变 compatibility transformer 的能力。原生顺序、来源、资源、诊断及已确认的排序语义均未修改，详见 [当前计划](NEXT-STAGE.md)。

### 原子与关系 marker 输出边界

[atomic-emission.ts](../compiler/src/application/atomic-emission.ts) 消费已完成准入、关系规划和兼容性／fallback 决策的规则，按既有顺序生成 ownership、状态、pseudo、`:has()`、结构及 external 对应的 atom／marker、scope membership 和 selector。排序候选仍由关系规划提供，`planFixedModuleOrder` 保留 semantic height、`atomRank`／`orderSlot` 和安全复用规则；输出阶段只使用已规划关系，不推测新 DOM 关系或改变 selector 准入。

其中 [observed-emission.ts](../compiler/src/application/observed-emission.ts) 专门生成已规划的 `:has()` 分支，[planned-declaration.ts](../compiler/src/application/planned-declaration.ts) 保存各原子输出共享的内部声明身份类型。每个 observation 仍独立绑定排序查询；本地观察 class 的 marker 必须添加到对应 scope。复杂 list 保留原生 `:has(list)` specificity，多个分支时保留零强度 witness；简单 list 延续既有 scalar 处理。该拆分不扩大 `:has()` 语法，不合并分支或改变 class／marker 身份。

`:has()` 的排序候选和输出共用规划阶段的 `OwnedTargetBinding`（规则分支与 targetPath）。每个 selector 分支仍独立，observation 继续从该规则末尾只读节点读取，不另存条件数组；逐 observation 的 occurrence 身份不合并。输出把同一路径作为 subject marker 的 scope，排序查询把它作为 target 绑定。此绑定不携带通用 specificity：排序候选沿用节点数量，结构歧义检查有自己的简单 observation 强度且排除 native complex，渲染仍保留 selector-list 最大值与 native specificity；三者不能仅因路径共用而合并算法。绑定在原有关系歧义检查成功后建立，不改变诊断或 compatibility／preserved 的先后次序。验证见当前计划。

关系候选收集、结构 planner 的观察约束、语义高度的不透明判断和 `:has()` 输出从对应 selector 节点读取 observation；preserved 输出仍按节点顺序处理所有 observation 并登记本地 marker。观察项的来源节点和分支身份不可因同名 class 或相同 selector 文本合并。准入、规则分类和排序已迁移，observation 平行数组已删除。

[structural-emission.ts](../compiler/src/application/structural-emission.ts) 负责已规划结构实例的 source／中间／target marker、组合符和 selector 输出，保留来源路径、状态／属性条件、specificity 与关系 rank。它不验证或发明 DOM 关系，也不替代结构 planner 的歧义证明；例如 `.input:checked > .middle ~ .label` 需要分别将 marker 放入各自 scope，并在浏览器中匹配 `>` 与 `~`，不能把整条 ownership 路径当成一个目标 atom。逐 declaration 的排序绑定和来源不变。 输出直接使用结构 planner 的 `sourceIndex`／`sourcePath`／`targetPath`，不重新从 selector 搜索来源或派生目标。该入口仅接收 `RuntimeStructuralInstance`，类型要求来源路径存在且由 planner 建立；descendant 实例仍走 ownership 输出。节点条件按 authored sourceIndex 读取，渲染保留首个 runtime 关系之后的全部组合符（包括尾部 descendant），不能把证明中忽略 ownership 尾部的 edge 列表直接用作 CSS selector。

[ownership-emission.ts](../compiler/src/application/ownership-emission.ts) 生成普通 ownership 目标和已规划祖先状态／属性的输出。无条件 ownership 通过目标声明解析保留 scope 组合，不要求真实 DOM 祖先；已证明的祖先 predicate 才使用 source／target marker 和关系 selector，并按原有方式保留作者 specificity。该模块消费同一排序规划结果与 scope 树，不重新决定覆盖、fallback 或关系有效性。

`ResolvedTarget` 只保存路径及携带规则／声明来源的 occurrences；删除无人读取、由 occurrences 重复映射的 declarations 数组，不再维护两份平行列表。存活声明仍通过 occurrence 访问，不能删去规则身份或以此替换排序的剪枝前 candidates。

普通 ownership 的条件／layer 分组、局部声明路径前缀收集及胜出解析由 [ownership-planning.ts](../compiler/src/application/ownership-planning.ts) 编排，继续调用领域 `resolveTargetDeclarations`；原子输出入口在 fallback 判定及模块排序之后调用它。输出仅接收这些分组的目标结果与可选 descendant 实例，不再持有完整 relation plan 或自行组织胜出解析。这是既有职责的移动，不是 MarkerPlan 或新的关系证明。

必须区分两条数据流：排序从 semanticRules 的既有 candidate 集合读取剪枝前声明；普通 ownership 输出只按对应 layer／条件的 localRules 前缀收集目标，解析存活 occurrence 并沿用属性输出顺序。两者不能直接共用一个存活声明列表。没有胜出声明的已声明前缀仍生成 scope；descendant 规划已运行但实例为空时，仍登记原 local scope，不能把空数组当作未运行。下游只用 `plannedDescendants` 是否存在判断是否走该路径；关系计划不再额外返回同义的 `hasDescendantConditions` 标志，原有准入谓词只在 planner 内决定调用时机。条件、分组／路径插入顺序、来源共享、importance 与 fallback 不变，验证见当前计划。

[external-emission.ts](../compiler/src/application/external-emission.ts) 只处理已准入的同节点 external condition 和 external descendant 输出。前者将条件附在拥有的目标 selector 上；后者把外部 selector 附在 owned 路径之后，外部节点不生成可导出 scope。相同节点和外部目标各自保留原 effect 重叠检测与 `GSS1205` 拒绝；这些检查不是广义 CSS 关系推理，也不改变 external 准入或 fallback。

[pseudo-emission.ts](../compiler/src/application/pseudo-emission.ts) 对已规划的 pseudo-element subject 生成输出；即使声明没有存活，其已声明路径仍需保留为公开 scope，生成 selector 仍保留作者路径的 specificity。[atomic-emission-context.ts](../compiler/src/application/atomic-emission-context.ts) 仅为各输出分支共享已确定的规则数组、scope 树、资源绑定、命名器和排序查询；它不统一各关系的准入或证明，也不授权跨分支复用。

Pseudo planner 和输出从末尾节点读取主体与状态，固定排序从节点读取 pseudo 上下文及复用条件；不同 pseudo 主体不能进入同一竞争上下文。descendant planner 的节点条件不再依赖状态／属性平行数组。原 scope membership、native specificity、局部 rank／输出位置与复用屏障均不变；准入也已迁至节点。

不同输出分支不能简单合并：普通 ownership 可以累积目标路径；结构／祖先状态需要 source、target 和中间 marker；`:has()` 按 observation 保留主体／观察身份和 native specificity；external target 不导出为 scope，重叠 effect 仍按既有规则拒绝。规则来源、`!important`、条件／layer、scope 中未存活 pseudo 路径以及 asset 身份都必须保留。输出过程中遇到的 external 歧义依旧返回 `GSS1205`，且失败贡献不会提交；preserved 仍有独立输出路径。本次只移动阶段边界，分支内部的语义、执行顺序、identity 和 fallback 未改变；planner 内部模型及更宽复用仍未完成。验证见 [当前计划](NEXT-STAGE.md)。

### 已确认：保留专用 marker 输出分支（方案 A）

2026-10-30 owner 选择 A：关系计划／排序 → 各专用 emitter → scope 与 CSS，不新增独立 MarkerPlan 中间阶段。结构输出消费已规划 source／target，`:has()` 排序与输出共用主体绑定；marker 命名、scope class 登记和 selector 渲染仍由专用输出分支完成，共用 name allocator、scope exports 和 selector rendering。

选择理由：当前已有共享基础能力，尚未发现该组织方式导致的新契约反例，也没有第二种 renderer 或独立 marker 计划消费者要求增加阶段。继续按实际问题消除重复绑定，使输出消费已确定的计划，而不是重新解释 selector；不为形式上的统一合并不同关系的证明或建立可选字段堆叠的通用模型。

保留的边界包括：`:has()` 的 native list 与分支 witness、external target 不导出 scope、pseudo 即使无存活声明仍保留 scope、结构尾部 descendant 和 source specificity。原始身份、排序、来源、scope membership、诊断优先级及 fallback 均不改变；失败的 contribution 不提交到 session，直接生成不意味着部分结果已对外生效。

B（先生成独立 marker 请求、scope membership 和 selector 结构计划，再统一执行）本次不采用，也不是自动待办。若将来明确需要单独查看／验证完整 marker 计划或新增消费者，再评估其收益与迁移成本并由 owner 确认。A 不阻断未来迁移到 B；目前不新增中间模型、缓存或公共 API。

本次是设计决策记录，没有运行时代码变化；检查文档链接和 diff，不把此前 2456 项测试及浏览器证据描述为此次重验。

### External selector 上下文准入

External 同节点条件与外部后代的 anchor 在原子输出入口各建立一次 `OwnedTargetBinding`，排序候选和各自输出共享同一 rule／targetPath；不再分别派生名称路径。绑定的 targetPath 指向 GSS 拥有的 anchor，不是外部 DOM 目标，不创建 external scope。该字段契约也用于 `:has()` 主体，但两种关系的身份、selector 与准入仍独立。

绑定仍在 compatibility／preserved 判定之后建立，候选顺序保持同节点 external → 外部后代 → observation。同节点 condition 的 effect 重叠检查在每条规则内重置；外部后代的 effect 集合跨所有 external 规则累积。两者不能因共享字段而合并冲突检查范围，`GSS1205` 的文本、发生阶段和 LKG 保持原样。具体对照见当前计划。

[selector-admission.ts](../compiler/src/application/selector-admission.ts) 在其他条件、声明与关系规划前，按已解析规则分别收集 local、external target 和同节点 external condition，并沿用原 selector AST 中 `:global()` 的检测。外部 descendant 只准入当前已支持的纯 ownership 路径；同节点 external condition 保留单规则或已证明的单 longhand base refinement 等既有限制。它不把 external target 变成导出的 scope，也不把外部类视为 GSS ownership。

该模块也集中现有 selector 形态校验，但保留两个调用点：条件与 selector 的组合检查在声明重复和逻辑／物理冲突检查之前；pseudo、observation、属性与状态位置检查在这些声明检查之后，按原次序返回第一个诊断。输入仍是原 parser 规则，声明检查继续使用既有 atomicRules；不能合并为一次遍历而改变错误优先级，也不允许将失败转换成 preserved fallback。

该阶段只移动原检查，不扩大 selector 语法或改变诊断；原有 condition／声明检查的先后次序、关系歧义、marker 生成、排序与 preserved fallback 的 `:global()` 防线保持原样。后续若扩展混合 external 组合，必须另行证明覆盖与强度，而不能仅靠更宽的分类。验证范围见 [当前计划](NEXT-STAGE.md)。

### Selector 节点条件视图

descendant、结构 planner、语义高度比较与 ownership／结构输出按同一 authored path 位置直接读取节点的 state／attribute 条件；缺失位置仍按各调用点的原不变量处理，不在公共入口补默认值或做条件推理。结构输出使用该节点的状态生成 marker 身份及 selector，并使用首个属性条件；缺失状态仍仅在渲染时按原规则视为空数组。旧 `selector-predicate.ts` 过渡视图已移除，planner instance 的 `sourceIndex`／路径绑定保持不变；ownership 名称路径已改为按需派生。

两个 planner 的证明不能因为读取入口相同就合并：descendant 的状态 predicate 使用原状态字符串，结构 planner 使用带 `:` 的形式；前者按 ownership 路径和 source 绑定证明，后者还要证明 runtime witness、组合符和 sibling 约束。它们各自的互斥／蕴含判断、specificity 与 ambiguity 规则均未改变。此视图不是 DOM 节点或完整 selector 语义模型；更完整的规则绑定仍需设计。验证见 [当前计划](NEXT-STAGE.md)。

结构关系 planner 中，结构实例的约束与排序语义高度所用的严格细化证明共用同一个实例到约束的构造：从首个非 descendant 关系开始提取 runtime edges，尾部 descendant 仍是 ownership 而非 runtime 证明；source predicate 仍绑定实例的原位置。例如 sibling witness 不因 scope 路径前缀而成为祖先。约束的外层 `sourcePath` 用于 predicate／唯一 witness 比较；runtime 只存实际用于关系推理的 edges，不再保存未读取的重复路径。descendant 输入与 `:has()` observation 仍有各自的约束构造，不因共享结构实例转换而合并证明；`relationRank` 仍是证明后的投影，不能反过来作为关系证明。此改动不改变 selector 准入、诊断、排序或 fallback，验证见 [当前计划](NEXT-STAGE.md)。

## 排序：已确认的目标

目标设计详见 [属性展开、原子排序与复用](PROPERTY-ORDER-DESIGN.md)。owner 已确认：在原生强度及可比较上下文相同的条件下，**已证明的所有权／结构语义优先；语义高度相同才按逻辑属性先、物理属性后**。浏览器决定方向映射。更强语义属于逻辑属性时也不能让物理属性固定顺序覆盖它；这一决定不再重问。

同属性 atom 的 rank 保留同模块组合和 authored occurrence；不同属性的潜在重叠使用固定属性顺序，不把潜在别名当作确定相同 effect 剪枝。不同属性的局部 rank 数值不能直接互相比较。当前已允许可原子化的 pure ownership 规则内及跨规则累积的已登记逻辑／物理 longhand 对，包括 `.a { margin-inline-start: 1px; margin-left: 2px; }`；preserved 模式、shorthand 和其他上下文仍有原准入保护。同属性 rank 已独立编号，跨属性语义／顺序由现有竞争族的 `orderSlot` 保留；输出位置参与复用身份，详见属性排序文档。

可证明安全时先展开 shorthand，按 importance／声明顺序处理同规则的同名 longhand；不能对 `var()`、复杂语法或隐含 reset 猜测展开。owner 已决定不能安全展开的既有输入暂时沿用当前 shorthand 处理和 fallback，不额外拒绝；具体安全展开范围、实现算法和所有 rank／属性／语义交叉规则仍需设计。现有 Lightning CSS 兼容性转换不是已验证的通用 shorthand 展开器。Tailwind 属性排序是参考，不直接替代 GSS 语义。

现有排序涉及目标内 effect 胜出、结构关系的 `relationRank`、模块组合的 `atomRank`、最终 CSS 输出比较；这些是不同职责，不能把局部 rank 当成全局优先级。现有实现仍把潜在重叠属性放入竞争族来计算输出位置，但 `atomRank` 只在同属性内计数，最终比较器只读取跨属性 `orderSlot`；共享身份同时保留两者，以保持既有语义证明和来源。不能把局部 rank 再拿来作跨属性比较，也不能直接删掉输出位置的复用屏障。

## 优先级与现状映射

| 优先级 | 目标 | 当前证据与待设计 |
| --- | --- | --- |
| 1 | 统一规则绑定、occurrence 和身份 | 排序入口通过 `order-occurrences.ts` 集中声明／分支／绑定身份；条件平行数组和冗余 ownership 路径已移除，结构／pseudo 消费 planner instance，observation／external 共用目标绑定。普通 ownership 的存活 occurrence 与剪枝前排序候选仍分开；专用证明不以统一模型为目的合并。 |
| 2 | 理清贡献构建、会话提交和快照 | 已分离会话提交／失效、贡献准备与快照汇总；scope 导出、资源规划、selector 准入、关系规划编排、compatibility／preserved 分析与 atom／marker 输出已提取内部模块。贡献准备仍负责阶段顺序、诊断优先级和 fallback 选择。 |
| 3 | 分离语义证明、同属性 rank、固定属性顺序及最终输出 | 已分离语义高度、属性内版本与输出位置；保留既有竞争族投影、未展开 shorthand 顺序与位置身份；pure ownership 的逻辑／物理 longhand 已有有界准入，其他 GSS1206 保护仍在。隔离物理 longhand 与相同条件链纯 atom 的连续复用已交付。 |
| 4 | 集中关系计划、marker 和 scope membership | scope 树／导出、关系 selector 渲染、关系规划编排及 atom／marker 输出已有内部模块；各 planner 和输出分支仍保留专用证明；不可假设 ownership 等价于 DOM 祖先。 |
| 5 | 明确 property effect、潜在别名和准入 | 已记录 effect 与安全展开的区别，以及 `supportsCurrentBackgroundRanks` 的有界准入与竞争闭包；尚未证明可将该特例推广或替代。 |
| 6 | 检验 Adapter／宿主的实际 seam | 已梳理三操作接口、Vite 调用顺序、React 范围及简单假 adapter 的证据；Vue、Svelte 单文件组件和其他构建工具仍未验证，不预建通用插件框架。 |
| 7 | 让仓库第一层反映职责 | `compiler/`、`adapters/react/`、`integrations/vite/`、`types/` 已迁移；测试基础设施位于 `tests/`，既有 Playground 源码已迁至 `examples/playground/`；其他验收应用仍在 `tests/acceptance/`。独立参考和验收入口保持原职责。 |

Playground 自己的 dev、构建、预览和类型检查脚本由私有 `@gss-l/playground` 包提供；根命令直接调用该包，历史 `@gss-l/testing` 同名脚本继续转发。验收脚本和浏览器参考仍归 `tests/`；示例当前使用测试参考，并非可脱离仓库独立发布的应用。常规 workspace build 不自动构建示例，显式 `playground:build` 才生成其 dist。

已删除无调用且不在公共导出中的 `validate-state-ambiguity.ts`；当前状态与结构歧义仍由关系 planner 处理，旧检查器的规则并非当前契约。可读名称完整解码器主要由测试使用，但其可逆性／碰撞断言可能有价值；`NameAllocatorPort` 和 `CssParserPort` 还支持内部测试，保留这些验证接缝。保留独立参考实现、精确图像、负对照及历史失败证据。

### 绑定消费后续核对（2026-10-30）

有限 border-width 实现 `8cc95c2` 后，继续对照 `plan-module-relations.ts`、`order-occurrences.ts` 与五个专用 emitter 的输入和排序查询：结构使用已规划 source／target／sourceIndex；pseudo 使用规划 target，并独立登记未存活的 authored scope；observation 与 external 共用目标绑定。普通 ownership 按分组解析存活 occurrence，排序仍使用剪枝前候选；两者的声明集合不同，不能用一个集合替换另一个。输出剩余的 authored path 派生用于身份或 scope 登记，不是重新决定目标。

所读链路未发现需要继续迁移的重复目标决策或新契约反例；这不是所有 selector 组合的证明。本项仅记录源码核对，没有运行新的测试或修改实现，运行证据仍以 `8cc95c2` 的完整 verify／浏览器结果为准。保留方案 A，不为消除专用类型新增统一 planner 或 MarkerPlan。新的 shorthand 族、值域／跨 scope 展开或更宽复用均尚无新授权，需先明确下一目标及其语义边界。

## 阶段与完成标准

2026-10-31 核对：已批准的具体切片已交付；“完整展开／更宽复用”是能力边界，不是无限续作队列。下一建议优先梳理 CSS 能力接入的职责与重复维护点，范围及完成标准见 [当前计划](NEXT-STAGE.md#接下来建议css-能力接入流程与策略归属)。

| 阶段 | 状态 | 完成标准 |
| --- | --- | --- |
| 核心工作流和目标梳理 | 本文完成初步映射 | 已区分当前行为、目标和未决问题；不声称完整语义证明。 |
| 排序／展开详细设计 | 进行中 | 属性排序文档已记录 occurrence 约束及属性内 rank／输出位置的保守分离证明；更宽的跨位置复用及 shorthand、reset、复杂值仍需设计和验证。涉及新 fallback／范围须 owner 决策。 |
| 仓库及编译器迁移 | 已批准主干迁移已落地 | 会话生命周期及快照汇总已分离；Compiler、React、Vite 与 types 已按职责迁移并保留包名。冻结 lockfile 离线安装、`verify`、外部 Vite 模板和 Framework SSR 现有入口通过；测试基础设施位于 `tests/`，Playground 示例位于 `examples/playground/`；其余验收应用留在 tests，专用关系证明保持独立；不以形式统一为由继续迁移。 |
| 验证与交付 | 依实现切片执行 | 同规则正反顺序、不同 scope、同属性多 rank、强弱 ownership／结构、LTR／RTL／writing-mode、importance／specificity／layer／条件、selector 分支、资源／map／LKG 均用受影响的既有载体和独立预期核对；保留原生 oracle 和显式 GSS oracle。运行相关检查及 `verify`，宿主／浏览器输出改变时核对实际入口并运行受影响既有 gate。 |

owner 已要求开始推进目标；按已确认语义及这里的阶段推进，不逐个询问常规实现切片。超出已确认行为的 fallback 或尚未确定的语义范围仍需 owner 决策。仍不自动新增框架、演示项目或验收矩阵；Firefox Article、性能和发布边界见 [STATUS](STATUS.md)。
