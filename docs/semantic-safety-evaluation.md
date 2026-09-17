# GSS-l 原子化语义安全性评估（讨论稿）

> 状态：讨论中；已确认的局部决策单独标注并记录在 ADR。
>
> 本文记录问题、可证明边界、候选处理方式与待确认事项。产品语义讨论清楚前，不据此继续实现语言、Parser、Compiler 或 Adapter。

## 已确认决策

- 自有 DOM 中由同一个 JavaScript 业务状态共同切换的 descendant 样式，采用“选择一次完整样式分支，再把 root/target token 分别挂到真实元素”的模型。`.father .son` 的 declaration 可以下推为 son 元素上的纯 atom；调用方不需要为每个子节点重复同一个状态判断。见 [ADR-0001](adr/0001-descendant-selectors-as-style-scope-targets.md)。
- 该决策不等于自动推断 React DOM，也没有冻结最终 JavaScript interface。
- ancestor/peer 的浏览器状态按 group/peer 类 contextual atom处理；当多个可共存状态对同一 target/property 产生等优先级不同值且没有明确 winner 时，Compiler 拒绝编译，要求作者改为互斥条件或显式交集规则。见 [ADR-0002](adr/0002-reject-ambiguous-coactive-state-conflicts.md)。
- 项目级配置为已注册 `@media`/`@supports` condition 定义统一顺序；未注册或未注册的 compound condition 允许输出但 warning，顺序不属于 GSS-l 保证范围。见 [ADR-0003](adr/0003-global-order-for-registered-at-rule-conditions.md)。
- GSS-l 不分析或管理消费侧 `cx()`、class 字符串拼接和外部 `className`；正确性保证只覆盖单个 GSS export/branch 内部。跨 export 或外部 class 冲突属于调用方行为。见 [ADR-0004](adr/0004-do-not-analyze-consumer-class-composition.md)。
- Shorthand/longhand 在 export 内先解析 loser，剩余 atom由中央 registry 按全局 property-effect order key 排序；首次注册顺序不参与 cascade。见 [ADR-0005](adr/0005-order-atoms-by-global-property-effects.md)。
- `.gss` 不允许 authored duplicate exact-property fallback sequence；兼容前缀由 browserslist transformer扩展为不可拆的物理 declaration sequence，业务 fallback 使用 `@supports`。见 [ADR-0006](adr/0006-reject-authored-duplicate-properties.md)。
- Custom property provider 默认作为原 target 上的 atom，consumer 依赖浏览器原生 inheritance；变量名和值保持开放，`@property` 进入独立全局 registry。见 [ADR-0007](adr/0007-atomize-custom-property-providers.md)。
- 公共调用使用 `styles.<scope>` 和 `styles.<scope>.<target>`；Adapter 在 class-value context 中把 bare scope 降低为内部 self token，并支持受限的局部 branch reference 传播。见 [ADR-0008](adr/0008-lower-style-scope-references-in-class-value-contexts.md)。
- 首期只实现 React/JSX Adapter；Compiler domain 保持 framework-agnostic，并通过 port 隔离 React AST、构建工具和输出设施。见 [ADR-0009](adr/0009-react-first-framework-agnostic-core.md)。
- Style reference 完整 path 精确对应 selector class path；可控 class boundary 后的 tag 等 residual selector 保留为单 declaration contextual atom。见 [ADR-0010](adr/0010-map-style-reference-paths-to-selector-class-paths.md)。
- 已声明 target path 累积所有可证明必然匹配的更一般 selector，并在 export 规划阶段完成 cascade winner resolution；不自动创造未声明 path。见 [ADR-0011](adr/0011-accumulate-rules-that-necessarily-match-a-target-path.md)。
- 普通 ownership descendant 继续下推为纯 atom；`>`、`+`、`~`、ancestor browser state 等必须由浏览器判断的关系使用 source/target 双端 contextual marker。见 [ADR-0012](adr/0012-use-contextual-markers-only-for-runtime-relations.md)。
- Runtime relation 存在可证明包含关系时，更窄 condition 获胜；可共存但不可比较的等优先级冲突继续报错。见 [ADR-0013](adr/0013-prefer-logically-narrower-runtime-relations.md)。
- 首期拒绝 `.button.primary` 等 local-local compound class；property chaining 只表示 descendant path，业务 variant 使用 attribute/ARIA/pseudo，外部 compound 使用显式 `:global(...)` residual。见 [ADR-0014](adr/0014-reject-local-compound-class-selectors.md)。
- `:not()`、`:is()`、`:where()` 支持 pseudo、attribute 和显式 global 参数，但拒绝 local class 参数；分别保留 negative、OR 与零 specificity 语义。见 [ADR-0015](adr/0015-constrain-local-classes-in-functional-pseudos.md)。
- `:has()` 作为 observed contextual relation 支持；subject 和 observed local class 分别使用 top-level marker，保留 relative selector，不允许 observed local compound 或 nested `:has()`。见 [ADR-0016](adr/0016-support-has-as-an-observed-contextual-relation.md)。
- 运行时 style path 是 `{ self, ...targets }` scope object；React JSX `className` 内自动降低 `.self`，其他 string context 显式使用 `.self`，scope object 只做受限局部 alias 传播。见 [ADR-0017](adr/0017-use-self-as-the-explicit-class-string-escape.md)。
- Shorthand/longhand 使用版本化、数据驱动的 property-effect registry；value 保持 opaque，logical/physical 潜在重叠和未知 effect 首期报错。见 [ADR-0018](adr/0018-use-a-data-driven-property-effect-registry.md)。
- 所有首期限制、deferred capability、替代方式与重新评估条件集中维护在 [deferred-capabilities.md](deferred-capabilities.md)。
- 无法证明安全的输入 fail closed，不自动产生 scoped/preserved fallback；只有正式建模的 contextual/residual/global、browserslist 展开和未注册 condition warning 例外可以输出。见 [ADR-0019](adr/0019-fail-closed-when-safety-cannot-be-proved.md)。
- 首期支持 selector list，并展开为共享 source ordinal 的独立 RuleIR branch；任一 branch 不受支持则整条 rule fail closed。见 [ADR-0020](adr/0020-expand-supported-selector-lists-into-rule-branches.md)。
- 首期正向支持常用 pseudo-element capability set；未注册语法统一 fail closed，不维护无限反向排除清单。见 [ADR-0021](adr/0021-support-a-positive-pseudo-element-capability-set.md)。

## 1. 评估目标

GSS-l 预期是一种接近 CSS/Less/SCSS 书写体验的构建期样式语言。采用新的 `.gss` 文件类型，是为了让 Compiler 获得比普通 CSS 后处理更多的结构化语义，从而安全地解析、组合和原子化样式，而不是把 authored interface 设计成 CSS-in-JS 对象或函数 DSL。

当前需要优先回答的问题是：

> 一份接近 CSS 的 `.gss` 在被拆分为 atomic class 后，Compiler 能否保证最终样式与作者预期一致？

本评估不预设具体语法，也不预设所有声明都必须原子化。

## 2. 初步可行性边界

理论上可以在**语义闭合、组合关系已知**的范围内保证正确性，但无法对任意 CSS、任意 selector 和任意业务 class 拼接同时保证“完全原子化且行为不变”。

CSS 的最终结果不仅取决于 declaration，还取决于：

- selector 是否同时匹配；
- specificity；
- declaration 和 rule 的 source order；
- stylesheet 的注入顺序；
- shorthand/longhand 关系；
- `!important`；
- pseudo 状态是否同时激活；
- `@media`、`@supports` 是否同时成立；
- custom property 的继承和 computed-value-time 解析；
- 业务代码是否在同一节点任意组合多个 class；
- 外部 stylesheet、inline style 和用户样式。

因此，可能成立的 Compiler 模型是：

```text
接近 CSS 的受约束语言
  → 提取显式组合语义
  → 编译期 winner resolution
  → 安全性证明
  → atomic 或 scoped 规划
```

而不是：

```text
先尽量拆成 atom
  → 再依赖全局 stylesheet 顺序恢复 cascade
```

## 3. 普通 class 的原子化

### 3.1 独立使用

```css
.badge {
  display: inline-flex;
  color: red;
}
```

如果该样式始终作为一个整体独立使用，可以生成：

```css
.a { display: inline-flex; }
.b { color: red; }
```

调用方获得：

```text
"a b"
```

在没有其他冲突 class 的前提下，这种转换可以保持行为。

### 3.2 任意 class 拼接

```css
.badge { color: red; }
.disabled { color: gray; }
```

业务代码可能同时使用：

```tsx
className={`${styles.badge} ${styles.disabled}`}
```

原始 CSS 的 winner 可能由源码顺序决定。原子化后，红色和灰色 atom 在中央 stylesheet 中的顺序可能与原模块不同，从而改变最终颜色。

仅分析样式文件无法证明两个 class：

- 是否会共存；
- 哪一个应该胜出；
- 是否在其他调用点具有相反的组合意图。

候选处理方式包括但不限于：

1. 限制可能冲突的独立 style 自由拼接；
2. 要求冲突组合进入显式 recipe/compose 语义；
3. 对无法证明的 class 保留 semantic scoped rule；
4. 分析业务调用点，但这会引入框架和 DOM 推断复杂度；
5. 运行时 conflict merge，目前与项目目标不一致。

尚未决定采用哪种契约。

## 4. Base 与 variant winner

旧 GSS 的真实错误来自 base class 和 active class 同时存在：

```css
.auth_tab { color: gray; }
.auth_tab_active { color: blue; }
```

原子化结果同时返回灰色和蓝色 token，最终 winner 被中央 atomic rule 的顺序改变。

如果 GSS-l 能明确知道某个组合中的 base 和 variant 候选，则可以先计算：

```text
normal → color: gray
active → color: blue
```

激活 variant 时只返回蓝色 winner，而不是同时返回灰色和蓝色 atom。

这一方向可以解决 exact-property 的 base/variant 冲突，但仍需定义：

- 多个 variant dimension 同时激活时的优先级；
- `!important` 与 semantic layer 的关系；
- shorthand/longhand winner；
- condition 和 pseudo 下的 winner；
- 是否允许业务绕过 recipe 再拼接其他冲突 style。

## 5. Selector 分类评估

### 5.1 当前元素的 pseudo class

```css
.button:hover { color: blue; }
```

可以映射为：

```css
.atomic:hover { color: blue; }
```

前提是 pseudo 进入 atomic identity。

Base 与 pseudo 通常具有明确 specificity 差异：

```css
.button { color: gray; }
.button:hover { color: blue; }
```

`.atomic:hover` 比 `.atomic` specificity 更高，因此通常不依赖二者顺序。

但两个 pseudo 可能同时成立：

```css
.button:hover { color: blue; }
.button:focus { color: green; }
```

当元素同时 hover 和 focus 时，两者 specificity 相同，winner 依赖 source order。候选处理方式包括：

- 保留 authored order；
- 定义语言级固定 pseudo precedence；
- 允许作者显式声明 precedence；
- 对冲突组生成局部 scoped rule；
- 暂时拒绝无法证明的组合。

尚未决定。

### 5.2 Pseudo element

```css
.icon::before {
  content: "";
  color: red;
}
```

`::before`、`::after` 可以进入 selector identity。before 与 after 是不同 generated box，通常互不竞争。

同一个 pseudo element 内仍需处理：

- 重复 property；
- shorthand/longhand；
- base/variant；
- `!important`；
- pseudo/condition 组合；
- legacy/modern pseudo-element spelling 是否视为等价。

### 5.3 Attribute 和 compound selector

```css
.button[data-state="active"] { color: blue; }
.button.active { color: blue; }
```

虽然结构上可以把 local class 替换为 atomic class，但这些 selector 表达的是条件组合，而且可能与 pseudo 或其他 attribute selector 发生相同 specificity 的竞争。

业务状态可能更适合显式表达为 variant；第三方 attribute 条件则可能需要 scoped fallback。具体支持范围尚未决定。

### 5.4 Descendant selector

```css
.button .icon { color: red; }
```

不能直接改成：

```css
.iconAtomic { color: red; }
```

原规则的语义是“只有 `.icon` 位于 `.button` 后代时才生效”；独立 atom 的语义是“元素只要拥有 token 就生效”。

如果调用方拥有 DOM，可以考虑通过 slot 给目标节点显式挂载 token。但仅分析样式文件无法证明：

- 哪个 DOM 节点对应 icon；
- 是否所有 icon 都位于 button 内；
- slot 是否会被错误复用于其他节点；
- DOM 是否由第三方组件生成。

因此 slot 更像是由作者显式提供的新语义，而不是 Compiler 对 descendant selector 的自动推断。

### 5.5 Parent state 驱动 descendant

```css
.button:hover .icon { color: blue; }
```

普通 slot 无法等价表达，因为状态发生在父节点，而 declaration 作用于子节点。

候选方向：

- 显式 scoped fallback；
- 将父状态显式传为子 slot variant；
- 后续设计专门的 parent-state/slot relation；
- 第一阶段不支持。

不能错误转换为 `.iconAtomic:hover`，因为那表示 icon 自身 hover。

### 5.6 Child、sibling、tag 和 id selector

```css
.card > .title
.item + .item
.item ~ .item
input.field
#app .button
```

这些 selector 依赖 DOM 结构、元素类型或全局 identity，不适合默认拆成独立 atom。可能需要 slot、scoped fallback、原规则保留或 compile error。

## 6. Condition 的顺序问题

```css
.button { color: gray; }

@media (min-width: 768px) {
  .button { color: blue; }
}
```

DOM 必须同时拥有 gray 和 blue 的能力，因为 Compiler 在构建期不知道 viewport。media 成立时，两条 selector specificity 相同，winner 仍依赖 CSS 顺序。

仅把 media 文本加入 atomic identity，只能防止错误复用，不能保证 cascade 顺序正确。

多个 media/supports 还可能同时成立，第一阶段不能简单假设互斥。

候选处理方式：

- condition 声明与 unconditional declaration 不竞争时允许 atomic；
- 存在覆盖关系时生成 recipe/module-local scoped rule；
- 建立全局 condition order/layer，但需要证明所有 Module 共享同一个偏序；
- 显式定义 condition precedence；
- 对无法证明的冲突停止原子化。

尚未决定。

## 7. Shorthand、longhand 与 fallback sequence

```css
.box {
  margin: 8px;
  margin-left: 16px;
}
```

`margin` 与 `margin-left` 不能作为两个无关 property。类似关系还包括：

- `border` 与各边/各子属性；
- `background` 与 `background-color` 等；
- `font` 与 `font-size` 等；
- `animation` 与其 longhand；
- logical property 与 physical property。

Compiler 需要保守的 property-effect/conflict-family 模型。无法证明时不能依赖 atomic rule 注册顺序。

重复 declaration 也可能是显式浏览器 fallback：

```css
display: -webkit-box;
display: flex;
```

这种序列可能必须作为不可拆、不可去重、不可重排的 declaration bundle。

尚未决定 MVP 支持哪些 property family，以及重复 property 默认表示 fallback、覆盖还是 error。

## 8. `!important`

```css
.button { color: gray !important; }
.button.active { color: blue; }
```

普通 variant 不能仅因为 semantic layer 更高就覆盖 important base。

`!important` 至少需要同时参与：

- winner resolution；
- atomic identity；
- scoped render；
- manifest/report；
- shorthand/longhand conflict 判断。

`color: red` 与 `color: red !important` 不能复用同一个 token。

## 9. Custom property

```css
.parent { --tone: red; }
.child { color: var(--tone); }
```

Custom property 具有继承性，且许多行为发生在 computed-value time。将 custom property provider 全局原子化可能改变：

- 后代继承；
- fallback；
- variant/condition 下的值；
- 与第三方 DOM 的关系；
- 同节点其他变量 provider 的 winner。

一个保守候选是：

- custom property declaration 默认保留在 owner-scoped rule；
- 使用 `var(--tone)` 的普通 declaration 可以评估是否 atomic；
- custom property 仍参与 recipe winner；
- 未有充分证明前不跨不相关 owner 复用 provider。

此项尚未正式决策。

## 10. Class name、registry 与正确性

短 class name 和稳定 hash 本身不能解决 cascade。完整正确性链路应是：

```text
semantic winner
  → atomic/scoped plan
  → token allocation
  → CSS rule
  → generated module
```

需要进一步讨论的候选不变量：

1. 每个生成的 token 都有对应 CSS；
2. 每个 token 只对应一个完整 semantic identity；
3. class collision 必须检测，不能只相信短 hash；
4. class 名不能依赖文件遍历或并行 worker 完成顺序；
5. registry 顺序不能被用来隐式表达 recipe winner；
6. scoped rule 必须保持局部语义顺序；
7. Adapter 不能自行重新解释或排序 Compiler 的语义输出；
8. HMR 更新或删除 Module 后，旧 token 与旧 CSS 必须一起失效；
9. production 输出必须验证 token/CSS closure。

Collision 可以稳定扩展或 fail fast，具体策略尚未决定。

## 11. 可能的正确性保证范围

一个候选保证范围是：

> 在 GSS-l 管理的 stylesheet、合法的显式组合、声明的 slot 和受支持状态范围内，优化输出与未原子化 reference 输出具有相同 computed style。

可能无法无条件覆盖：

- 任意外部全局 CSS；
- 任意业务 class 字符串拼接；
- inline style；
- 用户 stylesheet；
- 任意动态 selector；
- 无法证明互斥的 condition；
- 未建模 shorthand；
- 第三方 DOM 结构。

这些边界是否可以作为产品契约，仍需讨论。

## 12. Atomic 与 scoped 的关系

当前可讨论但未决定的规划模型：

```text
安全、可复用、总体有收益
  → atomic

组合语义已知，但全局 atomic 无法保持顺序
  → recipe/module-local scoped rule

第三方 DOM selector
  → explicit scoped fallback

无法证明且不能安全 scope
  → compile error
```

这意味着 atomization rate 不是唯一目标。可能更合理的质量标准是：

> 所有被原子化的声明都已经证明安全；无法证明的声明不会为了提高比例而被强行拆分。

是否接受这一产品定位，尚未确认。

## 13. 体积收益仍需独立判断

语义安全不代表有体积收益。Planner 最终需要比较：

- atomic CSS raw/gzip/Brotli；
- scoped CSS raw/gzip/Brotli；
- JavaScript token 和 lookup 数据 raw/gzip/Brotli；
- class string 增量；
- condition wrapper；
- shared/lazy chunk 重复；
- 新 stylesheet/request 成本。

真实 Notta H5 结果已经证明：高 declaration reuse 和 raw CSS 下降都不能单独作为成功标准。

## 14. 后续需要验证的方法

在冻结语法前，可以先定义一个与语法无关的 semantic oracle：

1. 从同一份抽象样式语义生成未优化 scoped reference CSS；
2. 生成候选 atomic/scoped 输出；
3. 枚举 recipe variant 组合；
4. 覆盖 hover/focus/active/disabled/focus-visible；
5. 覆盖 before/after；
6. 覆盖 media/supports 成立与不成立；
7. 在浏览器中比较 computed style；
8. 对不同 Module 输入顺序重复构建；
9. 对 HMR 添加、修改、删除运行最终状态检查；
10. 同时测量 CSS + JavaScript gzip/Brotli。

该验证模型可以先于具体 `.gss` parser，避免再次由语法实现反向前提决定产品语义。

## 15. 待讨论问题

以下问题均未决策：

1. 如何把 importance、specificity、relation implication 和 at-rule condition order组合成完整 cascade order key？
2. production 中央 CSS、code splitting、SSR 与 HMR 如何共同维持全局 order key？
3. production class naming 是 hash、稳定短名还是混合方案，collision 如何处理？
4. semantic reference CSS 是否应成为 Compiler 的正式测试输出？

## 16. 当前实施状态说明

仓库中当前存在上一轮产生的未提交 Compiler/parser 原型。该原型采用了尚未确认的 interface，只能视为探索性代码，不能作为已冻结产品方向。

在上述产品语义讨论完成前：

- 不继续扩展 Parser；
- 不继续实现 recipe runtime interface；
- 不继续开发 Adapter；
- 不提交或推送当前探索性实现；
- 不以现有测试通过表示产品语义已经成立。
