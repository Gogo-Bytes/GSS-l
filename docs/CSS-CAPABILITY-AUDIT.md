# CSS 能力缺口盘点

## 结论

当前 GSS 的核心不是“任意 CSS 原子化”，而是一个**有界的 selector／cascade／resource 编译器**。已有能力足以覆盖 task-board、Article、Playground 和当前语义 fixture，但与市面 CSS Modules／原生 CSS 的语法覆盖相比仍有大量缺口。

这些缺口分成三类，不能混计：

1. **已支持**：有 Compiler／Vite／独立 oracle 或真实页面证据。
2. **已实现但有界**：输入能工作，但只在明确组合、注册条件或 property family 内成立。
3. **缺失或 fail-closed**：当前会拒绝、整 Module preserved，或没有对应语义实现。

本盘点只扫描当前源码和测试入口，不把所有缺口自动变成任务；性能、Firefox Article、脚手架和 SSR 框架仍不在本轮。

## 当前已覆盖的主干

| 领域 | 当前范围 |
| --- | --- |
| Selector ownership | 本地 class ownership path、selector list branch、标准 CSS nesting normalization |
| Runtime relations | descendant；有界 `>`、`+`、`~`；runtime relation 后接 ownership descendant 的受限 interleaved path |
| State／attribute | `:hover`、`:focus`、`:focus-visible`、`:focus-within`、`:active`、`:disabled`、`:checked`；一个 equality attribute／ARIA 条件的有界组合 |
| Functional selectors | 有界 `:not()`、`:is()`、`:where()` 参数；有限 explicit global class；有限 `:has()` observed relation |
| Pseudo-elements | `::before`、`::after`、`::placeholder`、`::marker`、`::file-selector-button`、`::backdrop`、`::first-line`、`::first-letter`、`::selection` |
| Conditions／layers | `@media`、`@supports`、`@container`；配置的 named layer；未注册条件／layer 有 warning 且 precedence 不保证 |
| Property effects | box、border、background、overflow、gap、grid、flex、alignment、font、transition、animation、mask 等 registry family；unknown effect 整 Module preserved |
| Resources | `@property`、Module-local `@keyframes`、`@font-face`；有界 URL discovery／binding／Vite asset delivery |
| Safety | transaction、LKG、external target protection、preserved fallback、native importance／specificity 不被 rank 覆盖 |

## 主要能力缺口

### A. Selector 语法与关系

**高影响缺口**：普通业务 CSS 很容易遇到；扩展会增加关系推理和 specificity／coactivity 风险。

- 多个 runtime combinator 串联，例如 `A > B + C`、`A + B ~ C`；当前限制 runtime suffix 的数量和形状。
- runtime edge 与 ownership edge 任意交错；当前只接受少数 leading ownership / runtime suffix 形状。
- 复杂 selector compound：local class 与 tag、ID、多个 local class、namespace、universal selector 的组合不在通用正向范围。
- `:is()`、`:not()`、`:where()` 的复杂 selector list、嵌套 functional selector、混合关系仍大多 fail-closed。
- `:has()` 仅是有限 observed relation；复杂 selector list、多个 observed branch、嵌套 `:has()`、完整 specificity 传播未覆盖。
- `:global()` 只在少数 terminal external target／owned condition／observation 位置成立；其它 residual/global placement 和组合未证明。
- 外部 target 的 tag、exact-value attribute 有界支持；attribute existence、tag+attribute compound 和更广 external selector 仍 deferred。
- 无 `:scope`、`@scope`、CSS nesting 中更复杂的 parent selector／selector-list 组合语义。

**影响**：不是“少生成一个 class”这么简单；这些 selector 的 class identity、native specificity、关系 marker、coactive ambiguity 和 fallback 必须一起设计。

### B. Pseudo-state 与 pseudo-element

当前 state registry 只有 7 个状态，仍缺少大量常见状态：

- 链接／目标：`:link`、`:visited`、`:target`。
- 表单：`:required`、`:optional`、`:valid`、`:invalid`、`:in-range`、`:out-of-range`、`:placeholder-shown`、`:read-only`、`:read-write`、`:default`、`:indeterminate`、`:user-valid`、`:user-invalid`、`:autofill`。
- 结构／文档：`:root`、`:empty`、`:first-child`、`:last-child`、`:nth-child()`、`:nth-of-type()` 等。
- UI／现代元素：`:open`、`:modal`、`:fullscreen`、`:popover-open`、`:defined`、`:playing`、`:paused` 等。
- 伪元素缺少新／专项能力，例如 `::cue`、`::part()`、`::slotted()`、highlight pseudo-elements 及更复杂 pseudo-element 组合。

**影响**：state 不是简单字符串白名单；ancestor/current/runtime-source 位置、同节点 coactivity、specificity 和浏览器动态变化都需要独立回归。

### C. Property effect registry

当前 registry 是有意有限的。本轮先补入一组无 shorthand 交互、按 independent effect 处理的常见属性：`aspect-ratio`、`box-sizing`、`accent-color`、`filter`、`backdrop-filter`、`clip-path`、`content-visibility`、`scroll-behavior`，以及 `pointer-events`、`user-select`、`touch-action`、`will-change`、`resize`、`appearance`、`color-scheme`、`isolation`、`mix-blend-mode`、`box-decoration-break`、`image-rendering`、`shape-rendering`、`text-rendering`、`scrollbar-gutter`，以及 typography／SVG paint 的 `text-indent`、`word-spacing`、`text-wrap`、`hyphens`、`line-break`、`tab-size`、`text-orientation`、`text-shadow`、`caret-color`、`fill`／`stroke` 系列和 `paint-order`／`vector-effect`；Compiler 回归覆盖其 source order／importance／ownership。仍未形成完整 effect family 或未进入 independent list 的方向包括：

- logical sizing／border：`inline-size`、`block-size`、`min-inline-size`、`border-inline-*`、`border-block-*` 等。
- sizing／layout：`contain`、`container-type`、`container-name` 等。
- paint／effects：`mask-border-*`、SVG `fill`／`stroke` 系列；本轮新增的 filter／backdrop-filter／clip-path 仍只是 independent property slice，不代表相关 value grammar 已完整建模。
- interaction／input：`accent-color`、`caret-color`、`resize`、`touch-action`、`user-select`、`pointer-events`。
- typography：`text-indent`、`word-spacing`、`text-wrap`／`text-wrap-mode`、`font-synthesis`、`font-palette`、`font-optical-sizing`、ruby／writing-mode 相关族。
- scrolling：`scroll-snap-*`、`scroll-behavior`、更完整的 overscroll／scroll-margin 族。
- modern view／anchor：`view-transition-*`、`anchor-*`、`position-anchor` 等。
- 新 CSS shorthand／longhand 及浏览器前缀变体并不自动成为安全 family。

当前 unknown property effect 的行为是**整 Module preserved 或按配置 error**，不是错误地当成 singleton longhand。这保护了正确性，但会让很多常见属性无法获得 atomic output 或 rank 解析。

### D. Values 与 declaration sequence

- value 默认 opaque；没有完整 value token／function／类型模型。
- `var()`、fallback、注册 custom property 的完整类型／依赖传播有限。
- `calc()`、`color-mix()`、相对颜色、typed `attr()`、custom functions、复杂 animation／transition value 没有完整语义模型。
- compatibility transformer 生成的不可拆 declaration sequence 只有有界 host-target 支持；更多浏览器 target、feature override 和 sequence family 会 preserved 或 fail-closed。
- CSS-wide keywords、initial/inherit/unset/revert/revert-layer 在复杂 shorthand／longhand 组合中的完整 effect 证明未完成。
- unknown／future property 不能自动安全 atomize；这属于明确的 fallback 边界，不应通过扩大独立 property 名单来掩盖。

### E. Conditions、layers 与 at-rules

- condition grammar 与 precedence 依赖注册／配置；未注册 query 不保证 precedence。
- mixed condition kind、复杂 nested condition、完整 condition precedence 和更多 layer／condition 交叉组合未完成。
- 只处理有限 `@layer` 形状；anonymous layer、复杂 layer statement/prelude、更多 native layer edge cases 未形成完整公共契约。
- parser 当前专门处理 `@font-face`、`@keyframes`、`@property`、named `@layer` 和三类条件；其它 at-rule 会 unsupported，包括 `@page`、`@counter-style`、`@namespace`、`@scope`、view-transition 相关 at-rule、custom at-rule 等。
- `@import`、namespace 与全局 stylesheet ordering 没有作为普通 Module 资源语义实现。

### F. Global resources 与 assets

- keyframes 支持静态 local name 和有界 animation reference；动态 name、复杂 shorthand／list／var reference、更多条件／layer 组合仍有限。
- `@font-face` 是不可拆 global resource；更多 descriptor、font tech、复杂 `src` value 和资源冲突组合未完整验证。
- asset binding 主要围绕可发现的 URL／font／background 路径；`image-set()`、复杂 `cursor`／mask／filter URL、CSS Houdini／paint worklet 等资源形态没有完整公共支持。
- CSS `url()` 的 value grammar、escape、function nesting 和 callback boundary 仍是有界实现，不是通用 URL 重写器。

### G. Cascade 与 runtime model

- same Module 多 scope 的排序已交付，但不是通用 selector specificity engine；native importance／specificity／layer/context 仍由既定边界约束。
- cross-Module same-node precedence 不支持，`GSS2107` 仍是 warning，不通过 class 顺序解决。
- source／target／observation provenance、partial shorthand winner、scope membership 不能丢失；任何更宽的 dedupe／rank reuse 都会触碰这些边界。
- CSS custom property inheritance、registered property 与 Module isolation 只有有界 native evidence，不是完整 custom-property cascade proof。
- `@keyframes`、font、property registrations 和 CSS assets 的 global ownership／引用计数有实现，但更多跨 context／跨 Module 组合仍需独立 oracle。

### H. Host／Adapter 侧能力

- React Adapter 的静态 path sugar 已支持 direct path、有限 local alias 和条件 alias target read；可变 alias、跨文件 propagation、动态 data flow 和任意 helper provenance 未支持。
- GSS path 不存在时按 owner 决定保留普通 JS 的 `undefined` 行为；这与精确 generated declaration／拼写提示是两件事，目前不追求后者。
- Vite 是当前唯一正式宿主 Adapter；其它 bundler、CSS pipeline、非 React 框架尚未验证。
- dev HMR 在 scope mapping 改变时允许 document reload／React state reset；不是 state-preserving HMR 保证。
- SSR／SSG 有界 Vite-managed HTML 证据通过，但独立 production SSR bundle、请求级渲染、streaming SSR、router lifecycle 尚未验证。

## 影响优先级建议

### P0：先确定是否属于当前核心产品目标

这些不是简单补 parser，必须先做语义决策：

1. **Property coverage policy**：unknown property 是继续整 Module preserved，还是扩充 registry；是否接受大量合法 CSS 进入 preserved。
2. **Selector admission policy**：继续 bounded fail-closed，还是支持复杂 compound／multi-runtime relation；后者会影响 ownership 与 cascade model。
3. **State／functional selector scope**：要覆盖哪些浏览器状态和结构伪类，哪些明确不做。
4. **Global resource boundary**：是否把更多 at-rule／resource 视为 GSS Module 能力，还是保持 compiler-only／native CSS escape。

### P1：高实用性、相对可切片

- logical sizing 与完整 logical border family。
- 常见表单状态和结构伪类的最小独立 slice。
- `aspect-ratio`、`box-sizing`、`contain`、`filter`、`clip-path`、`accent-color` 等常见 independent properties。
- 更完整的 `@supports`／`@media`／container query grammar 与 nested condition gate。
- asset URL 形态扩展前，先建立 `image-set`／cursor／mask 的独立 resolver oracle。

### P2：平台／框架实验后再决定

- `@scope`、view transitions、anchor positioning、Houdini。
- streaming SSR、router lifecycle、非 Vite bundler。
- 全量 TypeScript exact declarations、IDE path completion。
- 完整 CSS value type system 和任意 selector implication。

## 当前建议

下一步不要直接“补所有 CSS”。应先从这份盘点中选一个**可独立定义输入、语义、fallback、oracle 和浏览器 gate 的 slice**。建议优先在以下两项中选择：

- **Property slice**：补一组最常用、可作为 independent properties 或完整 family 的属性，并验证 unknown/fallback 不变；或
- **Selector/state slice**：选择一组常见表单／结构状态，先明确 coactivity、specificity、ancestor/runtime 位置，再做独立 native oracle。

在 owner 选择前，不进入脚手架，也不自行扩大 selector、property、resource 或 fallback 语义。
