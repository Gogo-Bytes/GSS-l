# CSS 能力与边界盘点

## 用途

本文区分已交付能力、已知边界与待核对项，**不是补全 CSS 的任务队列**。当前实现基线为 `e04327b`；进度与下一项工作以 [当前计划](NEXT-STAGE.md) 为准。owner 已停止新增框架／验收场景，后续以现有实现一致性和真实缺陷为目标。

旧盘点中的“nth-* 仍 fail-closed”“需先建立 DOM 关系 IR”“隐式类型待决定”“继续选择更多框架”已被后续实现／决策替代，不再作为开发前提。

## 当前能力及不可外推的边界

| 领域 | 已交付 | 保留边界 |
| --- | --- | --- |
| Ownership | local class path、selector-list 分支身份、嵌套 normalization | 不是任意 compound/tag/ID/namespace selector 都准入；现有 path/schema 契约保留 |
| Native relations | 已准入的 descendant、`>`、`+`、`~` 关系及多关系组合 | GSS 不分析实际 DOM/sibling；仍有 predicate 位置与组合准入限制 |
| Functional selectors | 有界 `:has()`、`:is()`、`:not()`、`:where()` 嵌套 local marker rewrite；显式 global 保持外部身份 | 不是通用 selector implication engine；不要把扩展 parser 等同于所有组合均正确 |
| Structural pseudos | 无参数结构状态、`nth-child`／`nth-last-child`／`nth-of-type`／`nth-last-of-type` native passthrough | 公式与运行时匹配交给浏览器；不进行 sibling-index 推理 |
| nth-of | local class identity marker、嵌套 filter、后续 list branch 与 explicit global 区分 | Browser fixture 是有限证据，不是所有公式／filter 的证明 |
| State／attributes／pseudo-elements | 注册状态及伪元素、有限 equality attribute／ARIA 条件 | 准确清单查 registry/parser；参数化 pseudo-elements、更广 attributes 与组合仍有边界 |
| Conditions／layers | 注册 media/supports/container、named layers 与有界 nesting | 未注册条件／layer 的 precedence 不保证；不承诺完整 CSS 条件推理 |
| Property effects | 显式 family/longhand/independent registry，包含近期 logical sizing/border、text-wrap、timeline、anchor、mask-border 扩展 | 登记不等于完整 value grammar；unknown effect 继续整 Module preserved 或按配置 error |
| Resources／assets | 有界 `@property`、local keyframes、font-face、URL binding、Vite asset delivery | 不是任意 at-rule/URL/function/resource 的通用实现 |
| React／宿主 | 编译期字符串语法糖、有限 alias、Vite 7/8；公开 aggregate stylesheet URL | 动态/未知路径保持 JS undefined；非 React 分析不进入 compiler |
| SSR／路由 | 已有 Declarative 和 React Router Framework 请求时渲染证据 | 仅报告中的版本／场景／Chromium；不推导其它框架、streaming 或任意 client/server graph |

准确源码入口：

- [selector parser](../compiler/src/infrastructure/postcss-stylesheet-parser.ts)、[模块贡献 marker emission](../compiler/src/application/module-contribution.ts)。
- [state registry](../compiler/src/domain/pseudo-state-capabilities.ts)、[pseudo-element registry](../compiler/src/domain/pseudo-element-capabilities.ts)。
- [property effects](../compiler/src/domain/property-effects.ts)、[统一属性排序策略](../compiler/src/domain/module-order-policy.ts)。
- [React Adapter](../adapters/react/src/index.ts)、[Vite Adapter](../integrations/vite/src/index.ts)。

## 本轮一致性核查：正确性，不是数量

本轮基于 `451dd5c` 核对以下入口，修复具体反例；不是全量 CSS 正确性证明：

1. **Property effects**：登记的 shorthand reset 是否完整，是否误把 shorthand 当 independent；logical/physical 重叠、重要性、source order 和 partial winner 是否保留既定契约。先看现有 `property-effects`、`four-property-effects`、`logical-physical-order` 回归。
2. **Selector marker**：已准入输入中的 local/global identity、嵌套 AST 遍历、列表分支与导出 scope 是否一致；原生关系与 specificity 是否在 lowering 中被错误改变。先看 `compiler-session`、`external-target`、`structural-relations` 及既有独立 oracle。

本轮结果：

- Registry：`mask` 补齐已登记 mask-border 的六个 reset-only effects；`corner-shape` 改为四个 physical corner longhands 的 shorthand，partial winner 与 importance 保留。MDN 的 [mask reset-only 列表](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/mask)／[corner-shape 构成](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/corner-shape) 为独立依据。
- 排除误报：CSSWG [view-timeline](https://drafts.csswg.org/scroll-animations-1/#view-timeline-shorthand) 明确包括 inset；[compositing](https://drafts.csswg.org/compositing-1/#background-blend-mode) 明确 background reset blend-mode，原 registry 不修改。
- Marker／文本：所有 state suffix 共用 snapshot AST rewrite，修复 nth global compound、runtime-source 漏改、嵌套 global 遗留；移除 serialized CSS 空白正则和 JSON attribute 编码。只清理 AST formatting 字段，保留 quoted whitespace、CSS escape 与 escaped terminal identifier space。
- 复杂 `has`：已准入 residual 不再猜测 scalar specificity；每个观察分支保留完整原生 `:has(list)` 与零强度 witness，marker／source provenance 分离。修复 `div .local,.owned` 在 weaker-only 匹配时丢失 native type specificity，以及 planner 误报 GSS1205；简单已有 has 路径／准入 grammar 不变，不引入通用 specificity engine 或 DOM 推理。
- 统一排序已确认并实现：同原生上下文与 GSS 语义高度时，逻辑属性先发、物理属性后发；同属性 tie 仍保留 authored order。五族 box、size/minmax、border/radius、overflow/overscroll 的已登记 effects 共用 overlap／priority／reuse-barrier 定义。最终属性 key 为 priority／严格包含深度／名称，保持传递性；不把潜在别名作 definite effect 剪枝，不扩 GSS1206 准入。

原始输入、red/green 回归与独立 Chromium native/literal 对照保存在 `artifacts/core-consistency/2026-10-26-audit/`；详细进度见 [STATUS](STATUS.md#本轮核心一致性修复)。核查仍区分“可复现违约”“证据不足”“已接受边界”，不通过新增框架场景或无限添加 fixture 填满矩阵。

## 保留的能力边界（非当前开发目标）

### Values 与 declaration sequence

- value 多数 opaque；没有完整 `var()`／fallback／CSS-wide keyword／复杂函数的语义类型系统。
- compatibility transformer 的不可拆 sequence 只有有界 host-target 支持；更多 sequence/target 可能 preserved 或 fail-closed。
- 未知／future property 不能默认当作 singleton；不能通过放松 fallback 掩盖 effect 不完整。

### Conditions、layers 与 at-rules

- condition precedence 依赖现有注册／配置，不是通用 implication 系统。
- anonymous／复杂 layer prelude、更多条件与 layer 交叉组合并非完整公共保证。
- `@page`、`@counter-style`、`@namespace`、`@scope`、更多 view-transition/custom at-rules 与全局 `@import` ordering 未纳入通用资源语义。

### Resources 与 assets

- local keyframe 的静态引用、条件／layer 组合、font descriptors 和 resource conflicts 均有范围。
- image-set、复杂 cursor/mask/filter URL、worklet 等没有完整公共支持；URL escape／function nesting 不是通用重写器。

### Cascade 与 Adapter

- 同模块多 scope 排序已交付；native importance/specificity/layer 仍不可被 rank 覆盖，来源／观察绑定、partial winner 和 scope membership 不可丢失。
- 跨模块同节点优先级不支持；`GSS2107` 是非阻塞 warning，不由 class 顺序解决。
- 保守 rank 复用的连续同写入规则保留，方向屏障统一扩展到已建模 effects。统一 physical-priority 替代旧 Policy B 的 source-order tie；native strength 和语义高度仍优先，不开展性能扩展。
- React 的可变 alias、跨文件 scope/data-flow 推导和精确 IDE path completion 不在当前目标。
- class mapping 修改允许 reload/state reset；个别模板的 state-preserving HMR 不提升为通用保证。
- `.gss` 删除不纳入当前支持契约；框架 SSR 的相对 base、server-only 图差异等限制见 [SSR 报告](FRAMEWORK-SSR-ACCEPTANCE.md)。

## 证据使用

本轮已有 browser oracle 125 fixtures／1267 comparisons／38 controls 与 Playground dev/preview 重跑通过；这些是现有 gate，不增加 fixture 数或验收矩阵。普通场景保留独立 native/literal 预期，GSS ownership 语义使用明确 GSS oracle，不用 compiler 输出自证。专项范围与历史失败见 [STATUS](STATUS.md)、[模板验收](VITE-TEMPLATE-ACCEPTANCE.md)、[Framework SSR 验收](FRAMEWORK-SSR-ACCEPTANCE.md)。

缺少某个语法／框架的覆盖不是自动 bug；扩大能力、公共 API／配置、作者体验、架构或 fallback 时仍需 owner 决策。
