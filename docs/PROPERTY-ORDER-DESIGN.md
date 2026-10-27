# 属性展开、原子排序与复用：设计结论

> 状态：2026-10-27 讨论形成的目标设计，尚未实施或验证。当前实现与已交付行为仍以 [STATUS.md](STATUS.md) 和 [NEXT-STAGE.md](NEXT-STAGE.md) 为准；本文不宣称现有代码已具备下述行为，也不是实施授权。

> 后续确认：在原生强度及可比较上下文相同时，已证明的 GSS 所有权／结构语义优先；语义高度相同时逻辑属性先、物理属性后。更强的逻辑属性不会因物理属性固定顺序而让位。核心工作流、进度与剩余设计问题见 [架构方向](ARCHITECTURE-DIRECTION.md)。

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

### 安全展开的边界

不能把 shorthand 简单按空格拆词后当作通用解法。含 `var()` 的值可能要在浏览器运行时才能确定；某些 shorthand 会重置不明显的 longhand，值也可能涉及复杂语法。展开需要保留完整效果、声明顺序、importance、资源身份、来源和原生语义。

对于暂时无法证明安全展开的情况，目标是保留语义，不能猜测结果。究竟保留什么形式、是否使用现有整模块 preserved fallback 或报错，需要结合具体输入和现有契约另行设计；本文不决定新的 fallback 行为。

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

目标是不再仅因为两者可能重叠就拒绝这个例子。当前实现仍会对该输入报 `GSS1206`；放开需要设计与验证，不能视为已经支持。语义强于固定属性顺序已确认；不同 rank、条件和原生强度如何具体参与排序仍需给出无歧义规则。未来官方文档应向用户解释固定顺序和覆盖行为。

Tailwind 参考：[margin utilities](https://tailwindcss.com/docs/margin)、[冲突 utility 的处理](https://tailwindcss.com/docs/styling-with-utility-classes#conflicting-utility-classes)。这是对处理思路的参考，不意味着 GSS 完全复制 Tailwind 的语义。

## 与当前实现的差异

- 当前 atom rank 会将可能 effect 重叠的不同属性纳入竞争族；目标设计将同属性 rank 和不同属性固定顺序分开。
- 当前 `GSS1206` 对部分同上下文逻辑／物理组合予以拒绝；目标方向允许上述混用示例，具体准入范围待设计。
- 当前实现通过 effect registry 处理 shorthand 和部分胜出，并不等同于本文提出的“安全展开后再处理 atom”的完整流程。
- 现有 ownership／结构语义及其与排序的关系需要单独核对。本文未决定删除相关语义，也未证明同属性 rank 与固定属性顺序的所有组合都能无损表达它们。

## 后续设计和验证问题

1. 定义每类 shorthand 的安全展开条件、完整 reset effects，以及不能展开时的行为。
2. 明确同属性 rank 如何与已证明的 ownership／结构关系、声明顺序和 scope 组合配合；区分 `atomRank` 与现有 `relationRank`。
3. 定义固定属性顺序与 rank 的比较关系，尤其是不同属性各有多档 rank 时，避免出现循环或违反目标优先级。
4. 核对 `!important`、layer、条件、伪元素、selector-list 分支、source map 和资源身份；不丢失来源或 scope membership。
5. 设计与现有行为的迁移和独立预期，覆盖正反声明顺序、LTR／RTL、不同 writing-mode、scope 组合、shorthand 部分覆盖和失败恢复；不把现有测试改成自我对照。

这些是待设计和验证的问题，不代表已经发现具体实现缺陷，也不自动授权扩大其他 CSS 语法或改变公共 API。
