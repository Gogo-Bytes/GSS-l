# 属性展开、原子排序与复用：设计结论

> 状态：2026-10-27 讨论形成的目标设计；同规则 longhand 有界准入、受限静态 margin／padding／inset／scroll-margin／scroll-padding 的物理及逻辑轴展开、同属性 rank／输出位置分离已有实现；完整展开与更宽复用仍未完成。当前实现与验证以 [STATUS.md](STATUS.md) 和 [NEXT-STAGE.md](NEXT-STAGE.md) 为准；本文不宣称现有代码已具备全部下述行为。

> 后续确认：在原生强度及可比较上下文相同时，已证明的 GSS 所有权／结构语义优先；语义高度相同时逻辑属性先、物理属性后。更强的逻辑属性不会因物理属性固定顺序而让位。无法证明安全展开的既有输入暂时沿用当前 shorthand 处理和 fallback，不额外拒绝。核心工作流、进度与剩余设计问题见 [架构方向](ARCHITECTURE-DIRECTION.md)。

## 目标

GSS 将样式编译为可复用的 atom class，并允许同一模块的多个 scope 在同一元素上组合。属性处理需要区分三类问题：

1. **复合属性与其子属性**：先在可以安全处理的范围内展开 shorthand，并处理同一规则中声明的覆盖。
2. **同一属性的不同 atom**：通过 rank 表达同模块 scope 组合时的相对优先级。
3. **不同属性的潜在重叠**：按固定属性顺序输出；由浏览器根据实际书写模式和 CSS 层叠决定最终结果。

这三类问题不应混成同一个跨属性 rank 规则。浏览器仍负责原生 `!important`、specificity、layer、条件及运行时方向映射；本文中的简化示例均假设其他原生强度和上下文相同。

## 复合属性先展开

对于能够证明语义等价的 shorthand，在生成 atom 之前，将其展开为受影响的单一属性，再依据声明顺序处理同一规则内的覆盖。例如：

```css
.a {
  margin: 1px;
  margin-left: 2px;
}
```

概念上的结果是 `margin-top: 1px`、`margin-right: 1px`、`margin-bottom: 1px` 和 `margin-left: 2px`。后写的 `margin-left` 覆盖由 `margin` 展开的同名声明；不需要靠 `margin` 与 `margin-left` 之间的排序或 rank 决胜。

顺序反过来时：

```css
.a {
  margin-left: 2px;
  margin: 1px;
}
```

后写的 `margin` 展开后，左边距为 `1px`。此处“后写覆盖”以重要性、上下文等其他层叠条件相同为前提。

如果 shorthand 和 longhand 来自不同 scope，则安全展开后可能产生同名属性的竞争。例如 `.a { margin: 1px }` 与 `.b { margin-left: 2px }` 被组合时，两个 scope 都会涉及 `margin-left`；它们按同属性的组合规则处理。

### 对其他复合属性应用同一决策

先查明 shorthand 实际写入或重置的所有 longhand，再判断每个 effect 的胜出声明。同一规则、同一 effect 且原生强度相同时，按声明位置决定覆盖；属性名更长、longhand 更具体或固定属性键靠后，都不构成额外优先级。较强的 `!important` 先于声明位置；涉及其他规则时还要保留原生强度、可比较上下文和已证明的 GSS 所有权／结构语义。展开后同名 effect 在不同 scope 中竞争时，排序必须保留它们之间需要的相对顺序：rank 是表达这一顺序的机制，不是让 longhand 总胜出的规则。对尚不能安全展开的 shorthand，也必须保留其与竞争声明的必要顺序和实际效果。

属性 effect 登记与值展开是不同的事实：[property-effects.ts](../compiler/src/domain/property-effects.ts) 描述声明可能写入或重置哪些 effect，用于竞争和覆盖判断；[expand-safe-box.ts](../compiler/src/domain/expand-safe-box.ts) 另行限定可展开的属性、值语法、分量分配及竞争上下文。effect 列表本身不证明其顺序对应 shorthand 的值位置，也不提供隐含 reset 的值。例如 `border` 的 effect 包含 border-image 重置项，不能把其值按列表逐项分配。新增属性时先登记完整 effect，再针对具体语法证明展开；未知或不安全情况保留已确认的原路径和 fallback。

判定可移除声明时，必须证明它的**全部** effect 都被覆盖；只覆盖 `margin` 的左侧时仍要保留其余三个方向。不能把运行时才可能相同的逻辑／物理 effect 当成确定相同后剪枝，也不能因为一个值相同就跨越竞争声明复用 atom。涉及 `var()`、CSS-wide 关键字、隐含 reset、资源及复杂值时，只有能证明完整原生语义和来源得到保留才展开；否则执行已批准的现有处理及 fallback。每扩展一个属性族，应在现有测试载体中验证正反顺序、部分覆盖、重要性、不同 scope、来源／source map 和不安全值，并使用独立原生或明确的 GSS 预期。

当前已实现有界的静态 `margin`／`padding`／`inset` 展开：在无需 compatibility 变换、所有属性已登记且全部为普通 ownership 规则的模块中，同一规则包含 shorthand 和对应的物理 longhand 时，或无条件／未分层的单节点 scope 之间存在物理 longhand 竞争时，可将 1–4 个静态 `px` 值或无单位零组成的 shorthand 展开；`padding` 只处理无负号的值，`margin` 和 `inset` 允许负值；`inset` 对应的物理属性是 `top`／`right`／`bottom`／`left`。跨 scope 切片要求所有相关 shorthand／longhand 值均可安全处理，且模块不含其他可能重叠的属性；同一规则切片继续沿用自己的准入条件。展开保留原始声明的位置，selector-list 分支共享声明身份；覆盖仍遵循重要性及相应语义和源码顺序。单独且无竞争的 shorthand、其他值／选择器、兼容性和整模块 fallback 暂沿用原路径。跨规则普遍展开和其他 shorthand 未完成；同属性 rank 与输出位置已按下述保守模型分离。

新增的静态 `scroll-margin`／`scroll-padding` 复用同一四方向展开流程。依据 [CSS Scroll Snap 规范](https://www.w3.org/TR/css-scroll-snap-1/)，二者按上／右／下／左分配 1–4 个值；本切片只接受静态 `px`／无单位零，`scroll-margin` 允许负值，`scroll-padding` 沿用 padding 的无负号判定。没有新增属性注册、隐含 reset 或运行时求值。

新两族仍要求模块全部为已登记属性、普通 ownership 且没有 compatibility 变换；同规则存在对应物理 longhand 竞争时展开，跨规则则要求所有规则无条件／未分层／单节点且全部竞争值可安全处理。额外保守边界是：**模块出现与该族潜在重叠的其他属性（如逻辑方向 longhand／axis shorthand）时，该 scroll 族整体不展开，即使物理 shorthand 和 longhand 写在同一规则中**。这保留现有逻辑／物理输出证明，而不从四方向数值展开推导更宽的别名能力；原 margin／padding／inset 的既有展开条件不变。

`auto`、其他未支持单位、`var()`、`calc()`、CSS-wide 关键字、无法识别的 token／值数量、负号形式的 scroll-padding（包括合法但本切片不展开的 `-0`）、不安全的竞争 longhand、无竞争 shorthand 及原 preserved／compatibility 路径保留既有处理。不把拒绝展开当作“声明无效”，不新增诊断，也不把原 padding 的负值过滤扩大到 scroll-padding。展开保留原声明的 importance 和来源；selector-list 分支共享展开声明对象，两个方向分别存活时仍保留相应来源和 scope membership。

回归以原生 CSS 和字面四方向预期核对正反源码顺序、重要性、独立／组合 scope、负 scroll-margin、未展开变量，并检查 selector-list、source map 与失败更新／恢复。该切片验证的是声明展开和计算样式等价，不新增通用滚动吸附交互承诺；运行证据见 [当前计划](NEXT-STAGE.md)。

逻辑轴切片进一步复用上述五族的静态展开：`margin-inline/block`、`padding-inline/block`、`inset-inline/block`、`scroll-margin-inline/block`、`scroll-padding-inline/block`。根据 [CSS Logical Properties](https://www.w3.org/TR/css-logical-1/#box) 与 [CSS Scroll Snap](https://www.w3.org/TR/css-scroll-snap-1/#margin-shorthand-logical)，1 个值复制到 start/end，2 个值分别写入 start/end；生成的仍是逻辑 longhand，**编译器不把 start/end 映射成 left/right/top/bottom**。方向与书写模式继续由浏览器处理。两个轴的 effect 不重叠，可分别展开；不增加 registry、公开语法或配置。

这十个 shorthand 原先仅接受静态 `px`／无单位零，后续百分比扩展见下；padding 两族要求无负号，其余允许负值。沿用普通 ownership、已登记属性、无 compatibility 的入口，以及同规则存在对应 longhand／受限跨单节点 scope 竞争的条件。逻辑轴额外要求整个模块不存在其自身及两个 longhand 以外的潜在重叠属性；出现物理别名或物理 shorthand 时保留该轴的原路径。比如 `.a { margin-inline: 1px 2px; margin-inline-start: 9px } .b { margin-left: 3px }` 不从本次展开推导新的 alias 组合证明。原有物理展开与 `GSS1206` 准入不改，冲突和重复声明仍在展开前检查。

同规则 `.a { margin-inline-start: 9px; margin-inline: 1px 2px }` 展开后 start 为 `1px`；交换声明顺序后 start 为 `9px`，end 始终为 `2px`，importance 优先。跨 scope 则保留各自完整声明及 membership，再以同属性 rank 和既有输出位置表达组合顺序。展开缓存继续以原声明对象为键，selector-list 分支共享替换身份，source map 指回原 shorthand；失败更新不得污染旧快照。`var()`、`auto`、未支持百分比及复杂值、超过两个值、无竞争 shorthand、非 pure／compatibility／preserved 输入保持原路径；负值过滤仍仅限已批准的普通 padding，不能因拒绝展开而丢弃 scroll-padding 或合法 `-0`。这些约束是有界优化，不是通用 shorthand 解析器；回归与当前浏览器证据见 [当前计划](NEXT-STAGE.md)。

静态百分比切片：在上述入口和竞争条件内，`margin`／`padding`／`inset`／`scroll-padding` 的物理及逻辑轴 shorthand 可以将简单数字百分比与静态 px／零混合展开，原字符串直接分配给各 longhand，由浏览器按各属性和书写模式计算；不自行计算百分比。`margin`／`inset` 接受带负号的百分比；padding 两族仅接受无负号形式。依据 [CSS Box](https://www.w3.org/TR/css-box-3/)、[CSS Position](https://www.w3.org/TR/css-position-3/) 和 [CSS Scroll Snap](https://www.w3.org/TR/css-scroll-snap-1/)，`scroll-margin` 仅接受长度，百分比仍不展开。其他未识别数字形式、`var()`、`calc()`、无竞争声明、潜在别名屏障和 compatibility／preserved 路径保持原处理。

字体相对长度切片：在相同入口及竞争条件内，五族物理和逻辑轴 shorthand 也可展开简单数字 `em`／`rem`，并与已安全支持的 px、零和合法百分比混合。保留单位原文，不在编译器中计算；浏览器依据元素或根元素字号计算（[CSS Values](https://www.w3.org/TR/css-values-4/#font-relative-lengths)）。例如 `margin: 1em 2rem; margin-left: 3em` 仍按声明顺序解决左侧，其余方向保留完整 effect，`scroll-margin` 也接受长度但仍不接受百分比。

padding／scroll-padding 仍不展开任何带负号形式，包括合法的 `-0em`；不能把 `padding: -1em` 作为获准的静态负 px 过滤范围。其他单位、函数、变量、别名竞争及 fallback 仍走原处理。声明来源、importance、跨 scope 排序与 selector-list 约束沿用前述证明；验证及未覆盖范围见 [当前计划](NEXT-STAGE.md)。

不要把拒绝展开的负百分比当成编译期可丢弃声明：此前批准的 padding 无效值过滤只覆盖确定无效的静态负 px；例如 `.a { padding-left: 9px; padding: -1% }` 仍沿用原路径，不能声称此类无效值行为已修复。已在 Chromium／Firefox／WebKit 复现：该例以及 `-1em`、`-1rem`、逻辑轴 `padding-inline: -1%` 原生保留 9px，而当前 GSS 为 0px；合法 `-0%`／`-0em` 两者均为 0px。owner 决定无效 CSS 由作者负责，GSS 不承诺通用无效值识别或修复，也不为这些例子扩大过滤；此前实现的负 px 处理保留。证据见 [当前计划](NEXT-STAGE.md)。百分比展开只在证明全部分量合法后进行，保留 importance、源码顺序、selector-list／scope membership 和 source map；跨 scope 长手值也必须可安全识别，避免混淆不同 scope 的声明身份。当前验证与剩余边界见 [当前计划](NEXT-STAGE.md)。

无效值决策：owner 已批准修复已复现的静态负 `px` padding 误剪枝。对于无需 compatibility、属性均已登记且没有 external target／condition 的模块，原子规划前忽略可确定无效的物理／逻辑 padding shorthand 和 longhand；重复声明和逻辑／物理冲突检查使用过滤后、尚未展开的规则，避免确定无效的声明触发误报；有效重复声明仍沿用既有诊断。`-0` 是合法零值，不忽略。仅当各组成值都是已识别的静态 `px`／无单位零且含真正负 `px` 时判无效；其他单位、复杂值和 `var()` 沿用原路径。compatibility 和整模块 preserved fallback 保留原声明及既有行为，除移除无效声明造成的冲突外，既有有效输入准入边界保持不变。重现与验证见 [当前计划](NEXT-STAGE.md)。

### 安全展开的边界

不能把 shorthand 简单按空格拆词后当作通用解法。含 `var()` 的值可能要在浏览器运行时才能确定；某些 shorthand 会重置不明显的 longhand，值也可能涉及复杂语法。展开需要保留完整效果、声明顺序、importance、资源身份、来源和原生语义。

对于暂时无法证明安全展开的既有输入，沿用当前 shorthand 处理和现有 fallback，不额外拒绝；不能猜测展开结果。同一规则中同强度时，后写 shorthand 可以覆盖先前的 longhand；反向顺序时后写 longhand 覆盖对应方向。更早的 `!important` 声明仍优先。`var()` 在计算时失效也不会让浏览器恢复先前被层叠淘汰的声明，详见 [CSS Variables 规范](https://www.w3.org/TR/css-variables-1/#invalid-variables)。此选择不自动扩大其他语法或改变未知属性的既有 fallback。

## rank 只处理同属性 atom 的优先级

在同模块多个 scope 组合时，若生成的 atom 写入同一属性，rank 用来保留约定的优先级。例如：

```css
.a { color: red; font-size: 10px; }
.b { color: blue; border: none; }
```

当 `.a` 和 `.b` 用于同一元素，在其他强度相同时，后写的 `color: blue` 应胜出。概念上可以让红色 atom 为 rank 1、蓝色 atom 为 rank 2，并让 rank 2 在 CSS 中后发。无关属性不应仅因这些 `color` 声明而被提高 rank。

rank 数字与生成的 class 名在本文中仅是示意；当前实现有无 rank 的身份等细节，不应直接据此推断最终编码。rank 不负责解析 `writing-mode`、`direction` 或覆盖浏览器的原生层叠强度。

### 同值 atom 的复用

保持 authored order 时，相同属性和值也不总能共享一个 atom：

```css
.early  { color: red; }
.middle { color: blue; }
.late   { color: red; }
```

如果分别组合 `early + middle` 和 `middle + late`，预期分别为蓝色和红色；两个红色需要保留各自相对蓝色的位置。连续且满足安全条件的相同声明可以复用，但不能跨过竞争声明，或丢失 scope membership 与来源身份。

## 不同属性使用固定输出顺序

逻辑属性与物理属性不是同名属性；它们可能在某些书写模式下映射到同一物理位置。目标是允许二者共存，保留两条声明，并参考 Tailwind 的处理方式约定稳定的属性输出顺序：**逻辑属性先、物理属性后**。浏览器决定它们在当前节点上是否重叠。

```css
.a { margin-left: 2px; }
.b { margin-inline-start: 1px; }
```

概念上，这两个属性各自可以处于 rank 1；按固定属性顺序输出时，`margin-inline-start` 在 `margin-left` 前面。在同等原生强度下，横排 LTR 时两者均作用于左侧，物理属性后发并胜出；横排 RTL 时分别作用于右侧和左侧，可同时生效。HTML class 的书写顺序本身不决定 CSS 规则顺序。

这一方向也适用于讨论中的同一规则写法：

```css
.a {
  margin-inline-start: 1px;
  margin-left: 2px;
}
```

可原子化的 pure ownership 规则内及跨规则累积的已登记逻辑／物理 longhand 对已不再仅因潜在重叠而被 `GSS1206` 拒绝；shorthand 和其他上下文仍保留现有准入保护。会进入 preserved 模式的模块仍保留原冲突拒绝：该模式按 authored 顺序输出，尚不能保证固定属性顺序。语义强于固定属性顺序已确认；当前保留既有上下文划分和语义高度，把同属性编号与跨属性输出位置分开，具体模型见下文。未来官方文档应向用户解释固定顺序和覆盖行为。

Tailwind 参考：[margin utilities](https://tailwindcss.com/docs/margin)、[冲突 utility 的处理](https://tailwindcss.com/docs/styling-with-utility-classes#conflicting-utility-classes)。这是对处理思路的参考，不意味着 GSS 完全复制 Tailwind 的语义。

## 与当前实现的差异

- 当前 `atomRank` 已在同属性内独立编号；effect 竞争族仍负责跨属性语义与输出位置 `orderSlot`，并保留未展开 shorthand 的原有顺序。更宽的跨位置复用尚无证明。
- 当前 `GSS1206` 仍对部分 shorthand 和非 pure ownership 上下文的逻辑／物理组合予以拒绝；目标方向的完整准入范围待设计。
- 当前实现通过 effect registry 处理 shorthand 和部分胜出，并不等同于本文提出的“安全展开后再处理 atom”的完整流程。
- 现有 ownership／结构证明、effect 竞争族及其输出投影保持不变。本次分离不建立新 selector 语义，也不证明移除竞争族或跨输出位置复用安全。

## 后续设计和验证问题

1. 定义每类 shorthand 的安全展开条件、完整 reset effects，以及不能展开时的行为。
2. 同属性 rank／输出位置的分离已落地；后续若改变语义高度或复用范围，必须重新证明其与 ownership／结构关系、声明顺序和 scope 组合一致。
3. 保持输出比较器只比较 `orderSlot`，不比较不同属性的 `atomRank`；未来若替换投影，需证明其仍无环且保留未展开 shorthand 的顺序。
4. 核对 `!important`、layer、条件、伪元素、selector-list 分支、source map 和资源身份；不丢失来源或 scope membership。
5. 设计与现有行为的迁移和独立预期，覆盖正反声明顺序、LTR／RTL、不同 writing-mode、scope 组合、shorthand 部分覆盖和失败恢复；不把现有测试改成自我对照。

这些是待设计和验证的问题，不代表已经发现具体实现缺陷，也不自动授权扩大其他 CSS 语法或改变公共 API。

## 排序约束与当前内部模型

### 已实现的 occurrence 身份边界

`compiler/src/domain/order-occurrences.ts` 集中排序输入的具体模型与收集：`OrderBinding` 表达规则分支和 target／source／observation 绑定，`OrderInstance` 保留 planner 的强度、来源位置及声明集合，`OrderOccurrence` 将绑定与当前语义规则中的声明及其下标连接起来。该规则已完成适用的安全展开，声明仍携带原始来源。语义高度和 rank 规划使用同一个模型，生成阶段按具名绑定查询 rank；已有 instance 的路径直接来自 planner。

`OrderBinding` 的 rule／targetPath／sourcePath 字段从现有 planner instance 类型选取，避免重复定义后逐渐偏移；observation 是排序绑定的额外字段。这只是共用字段契约，不能据此把 descendant、结构和 observation 的蕴含／互斥证明合并。

身份采用本次 contribution 准备中的声明对象编号、规则分支对象编号，以及 target／source／observation 的序列化值。保持现有编码，不对 observation 做新的等价归一化。它只用于本次规划和查询，不写入公共 API，也不直接作为 class 名或复用证明。

- selector-list 分支即使共享声明对象，也不能合为一个 occurrence：例如 `.a::before, .a::after` 的主体不同，`.a:focus, .a:where(:checked)` 的谓词也不同。
- 同一规则绑定到不同目标或状态来源时必须分开；同一 `:has()` 的不同 observation 也保留独立身份。重新构造但值相同的路径可查回原 occurrence，不能依赖路径数组对象相同。
- 收集读取 `instance.rule.declarations` 及其下标，保持候选竞争范围；不能改成已经剪枝的 `instance.declarations`，否则竞争者可能丢失、声明顺序位置可能移动。这里的下标属于展开后的语义规则，不是 parser 源码偏移。相同完整身份继续沿用原 Map 去重行为。
- occurrence 分离不禁止最终 atom 复用；复用仍由现有完整连续桶、安全条件和来源汇总决定。`.early{color:red}.middle{color:blue}.late{color:red}` 仍不能将两个红色跨竞争者合并。

该身份收集切片是行为保持式重构；当时未改变 effect 竞争族编号及最终输出策略。随后完成的 rank 分离见下文；selector 条件平行数组已迁至节点，ownership 名称路径已改为从只读节点按需派生，不增加缓存；各关系 planner 的专用绑定模型仍未整体统一。验证使用既有排序／复用／来源／收敛测试，并将 534 个既有排序 fixtures 的完整 replacement 与 finalize 输出和重构前基线逐字段比较；证据见 [当前计划](NEXT-STAGE.md)。

### 持续适用的排序约束

先保留每个 selector 分支、声明位置和 target／source／observation 绑定为独立 occurrence；按 layer、条件、伪元素主体和 importance 等现有上下文规则处理，不把原生 specificity 简化为可跨上下文比较的一个分数。生成规则时继续由浏览器处理原生强度。

对于可证明会竞争且处于可比较上下文的 occurrence：

1. **语义约束**：已有证明表明 B 的所有权／结构条件严格强于 A 时，要求 A 先于 B；未知或 opaque 关系不能伪造这种证明。
2. **固定属性约束**：语义高度相同、不同属性具有已登记的逻辑／物理潜在重叠时，逻辑属性先、物理属性后；潜在重叠不代表可以删去任一声明。
3. **同属性约束**：语义高度相同且属性相同的竞争声明按 authored rule／声明位置决定先后；不同属性的本地 rank 数值没有可比较意义。
4. **复用**：只有合并后仍能满足所有相关约束、scope membership、来源与原生强度时才能共享 identity。图中两点合并可能引入环，即便合并前两点之间没有直接边，因此连续相同值本身不是完整证明。

现有高度来自具体竞争族。本次沿用该竞争族与输出投影，只把属性内编号从中分离；没有直接采用 `(高度, 属性名, atomRank)` 作为新的全局排序键。移除竞争族或跨位置合并共享 atom 仍需新的证明。

验证本次分离及后续设计使用以下独立预期，并覆盖相反 authored 顺序：

- `.a{margin-inline-start:1px;margin-left:2px}`：两个声明保留，同语义高度物理后发；横排 LTR 左侧 2px，RTL 左侧 2px、右侧 1px。
- `.a{margin-inline-start:1px}.b{margin-inline-start:2px}.c{margin-left:3px}`：同高度时两个逻辑声明都在物理声明之前，`a+b` 保留同属性后写胜出；`b+c` 重叠时物理后发。物理属性的本地 rank 不得与逻辑 rank 直接比较。
- `.root > .item{margin-inline-start:1px}.root .item{margin-left:2px}`：两个选择器原生强度相同并同时命中时，更强 child 语义使逻辑属性后发胜出；不把普通 ownership 路径当成必有的 DOM 祖先。
- `.early{color:red}.middle{color:blue}.late{color:red}`：`early+middle` 为蓝、`middle+late` 为红；复用不能跨过竞争声明。
- `margin` 与 `margin-left` 的两种 authored 顺序：安全展开后分别得到左侧 2px 和 1px；同一属性的 `!important`、各 scope 的部分胜出、原始来源与 map 均需保留。

这些用例需要由既有 compiler、独立浏览器／literal oracle 和会话恢复载体验证；不以当前实现的输出作为新策略的唯一预期。`var()` 等无法安全展开的已支持输入暂时沿用当前处理和 fallback。


### 已实现：属性内编号与跨属性输出位置

`fixed-module-ranks.ts` 对需要排序的 occurrence 返回 `{ atomRank, orderSlot }`，无竞争族版本的 occurrence 仍不附加二者。两个数都在现有 layer／condition／pseudo subject／importance 上下文内规划；原生 specificity 和 importance 仍由生成的 selector／声明交给浏览器处理。

1. **输出位置 `orderSlot`**：保留原 effect 竞争族及 `semanticOrderHeights` 证明，按语义高度 → 固定逻辑／物理 priority → authored rule ordinal／声明下标排列，相等元组共享一个位置。此数是输出投影，不是 CSS 属性的等级；同 priority 的未展开 shorthand／longhand 仍按源码顺序排列。最终比较器依次比较 layer、conditions、`orderSlot`、既有 `relationRank`、属性 render key 和 class 名。
2. **同属性版本 `atomRank`**：遍历上述序列时，每个属性有自己的计数器，只有该属性的语义／声明顺序元组改变才递增；遇到其他属性不会递增。相同 tuple 的 selector-list 分支保持同版本。编号在复用前分配，复用后不重编号其他声明。`relationRank` 仍是既有结构输出的补充顺序，不是这个属性内版本。
3. **复用和生成身份**：沿用原完整连续桶的证明，只有整个桶满足原安全条件时一起复用最早的 `atomRank` 与 `orderSlot`。纯 atom class 编码两者；contextual／observed 声明的汇总 key 也保留两者。最终比较器不读取 `atomRank`，不同属性局部数值不发生比较。

例如 `.a{margin-inline-start:1px}.b{margin-inline-start:2px}.c{margin-left:3px}` 的 `(atomRank, orderSlot)` 分别为 `(1,1)`、`(2,2)`、`(1,3)`。物理属性的局部 rank 1 不会让它跑到第二条逻辑属性前；更强语义仍先在输出投影中得到较后位置。对于 `.a{margin:var(--space)}.b{margin-left:9px}`，两属性各为 rank 1、输出位置依次为 1 和 2；交换源码时输出位置交换，不强制 longhand 胜出。

**为何输出位置必须进入身份**：模块 A 中 `margin-left:1px` 可能在输出位置 2，模块 B 的相同属性／值／rank 1 却需要在三条逻辑声明之后、处于位置 4。若只按属性／值／局部 rank 复用 class，汇总时保留 A 的较早位置会破坏 B 自己的 scope 组合；这里并没有在同一节点混用两个模块。保留输出位置避免这种新合并，仍允许满足原条件且位置相同的共享。生成 class 因增加 `--order_` 片段而改变；公共配置、manifest 字段和作者写法不变。class 字符串应由当前 schema／导出取得。

**保持语义的依据**：`orderSlot` 在复用前等于旧跨属性 rank；连续桶收缩沿用原准入并同时搬移两个数，故收缩后的输出位置也保持原投影。新身份保留全部旧身份字段和旧位置，并额外区分属性内版本，不会将原本不同的输出位置合并。同属性计数器只是既有有序序列的单调投影，不新增排序边；最终比较器仍是总键，故本次分离不引入新的环。额外身份维度可能保守地拆分旧共享，不宣称复用率提升或跨模块同节点优先级。

验证包括独立编号、多档逻辑／单档物理、未展开 `var()` 正反顺序、不同模块不同输出位置的复用隔离、失败更新／恢复／插入顺序收敛，以及名称编解码。既有 534 个排序 fixtures 在把新名称映射回旧输出位置编码后，replacement 和 finalize 输出一致；source map 的列编码因名称长度改变而不作字节比较，来源及 sources 仍比较，map 由现有 source-map 回归检查。三引擎／原生证据与最终检查结果见 [当前计划](NEXT-STAGE.md)。本次未扩大 shorthand 展开、准入、compatibility 或 preserved fallback 范围。

### 既有 box 安全展开策略的扩展边界

`expand-safe-box.ts` 用内部 `boxExpansions` 描述已准入的五族物理／inline／block 展开：shorthand 名称、有序目标属性、非负限制、百分比许可及潜在别名隔离。顺序仍为每族 physical → inline → block，再处理下一族。算法只消费这些策略，继续执行单 shorthand、静态值、同规则／有界跨 scope 竞争检查、来源共享和原位置替换。

这不是新的公共注册 API，也不扩大 CSS 范围。property-effect registry 表示已知写入／reset effects，不自动证明 shorthand 可以展开；不能直接遍历所有已登记 shorthand 生成展开策略。现有分配算法仅处理双侧／四侧值列表，新形状或隐含 reset 需要另外证明。margin／padding／inset 物理同规则路径、scroll 及逻辑轴的隔离差异，负零的现有保守准入、`var()`／复杂值和 compatibility／preserved 边界均保留。

新增族时应先确认完整 effects、值域、目标次序、别名隔离及源码覆盖，再加入策略；本轮没有加入 border 或其他族。既有五族验证与完整输出对照见当前计划。
