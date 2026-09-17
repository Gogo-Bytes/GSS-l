# Deferred and unsupported capabilities

本文件集中记录 GSS-l 已经明确讨论、具有后续升级价值的 deferred capability，以及排除在保证范围外的关键 non-goal。它不是整个 CSS 规范的反向清单；首期能力以正向 capability matrix 为准，未注册语法统一 fail closed。

维护规则：ADR 对一个已讨论能力作出 deferred 决策或新增关键 non-goal 时，同步记录当前行为、原因和重新评估条件；不要为尚未讨论的每个 CSS feature 建立排除项。能力实现后删除对应限制并在替代 ADR/变更记录中说明迁移。

## Deferred capabilities

### D001 — Vue、Svelte 与其他消费侧 Adapter

- **当前行为**：首期只支持 React/JSX。
- **原因**：先验证 style-scope lowering；framework AST 细节不进入 domain core。
- **重新评估**：React Adapter、usage port 和 diagnostics 稳定后。
- **依据**：[ADR-0009](adr/0009-react-first-framework-agnostic-core.md)。

### D002 — 任意 scope-object propagation

- **当前行为**：只支持局部不可变 direct、conditional 和 property alias；动态 key、数组、普通对象、函数参数/返回值、export 和跨文件传播报 escape diagnostic。
- **替代方式**：JSX `className` 内直接使用 scope；其他 string context 使用 `.self`。
- **原因**：任意传播需要跨函数数据流或 runtime coercion，容易产生 object/string 不一致。
- **重新评估**：出现无法用局部 branch 或 `.self` 表达的高频真实案例，且可定义稳定的显式 scope transport API 时。
- **依据**：[ADR-0008](adr/0008-lower-style-scope-references-in-class-value-contexts.md)、[ADR-0017](adr/0017-use-self-as-the-explicit-class-string-escape.md)。

### D003 — React `className` 之外的自动 string-context lowering

- **当前行为**：DOM API、预先计算的 `cx()`、props object、`createElement` 等位置显式使用 `.self`；不追踪其结果最终是否进入 JSX。
- **原因**：仅凭任意函数和变量用途无法可靠推断 string context。
- **重新评估**：按明确语法逐项增加 Adapter pattern，不引入通用数据流猜测。
- **依据**：[ADR-0017](adr/0017-use-self-as-the-explicit-class-string-escape.md)。

### D004 — Authored duplicate-property fallback sequence

- **当前行为**：同一 block/condition/importance 下重复 exact property 返回 diagnostic。
- **替代方式**：写标准值并交给 browserslist transformer；业务 feature fallback 使用 `@supports`。
- **原因**：fallback sequence 必须保持整体顺序，拆成独立 atom 会重新引入 value-level 全局顺序。
- **重新评估**：出现 transformer 和 `@supports` 都无法表达的真实需求后，设计显式 declaration-sequence atom。
- **依据**：[ADR-0006](adr/0006-reject-authored-duplicate-properties.md)。

### D005 — Local-local compound class selector

- **当前行为**：`.button.primary`、`.card.selected` 等返回 diagnostic。
- **替代方式**：使用 `data-*`、ARIA、pseudo、独立无冲突 style，或对外部 class 使用 `:global(...)`。
- **原因**：compound variant 与原子组合模型重复，并让 `styles.a.b` 在 descendant 与 same-node 之间产生歧义。
- **重新评估**：真实项目证明 attribute/pseudo/global escape 无法覆盖重要场景后，评估显式 opt-in contextual compound。
- **依据**：[ADR-0014](adr/0014-reject-local-compound-class-selectors.md)。

### D006 — Functional pseudo 中的 local class condition

- **当前行为**：`:not(.disabled)`、`:is(.primary, .secondary)`、`:where(.large)` 等返回 diagnostic。
- **替代方式**：使用 pseudo、attribute、ARIA 或显式 `:global(...)` 参数。
- **原因**：否则可以绕过 local compound 限制；`:where()` 还要求单独保持零 specificity。
- **重新评估**：与显式 local compound feature 一起评估，不能单独放开。
- **依据**：[ADR-0015](adr/0015-constrain-local-classes-in-functional-pseudos.md)。

### D007 — Complex `:has()` observed selector

- **当前行为**：拒绝 observed local compound 和 nested `:has()`；支持受约束的 class、relative combinator、attribute、tag、pseudo 和 selector list。
- **替代方式**：用 attribute 表达 observed state，或使用显式 global residual。
- **原因**：local compound 与既有约束冲突；原生 CSS 也禁止 nested `:has()`。
- **重新评估**：只对浏览器规范允许且 constraint model 可证明的 selector扩展。
- **依据**：[ADR-0016](adr/0016-support-has-as-an-observed-contextual-relation.md)。

### D008 — Unknown/unsupported property effects

- **当前行为**：unknown property、known-but-unimplemented shorthand 和未登记 vendor property 返回 diagnostic，不静默原子化。
- **原因**：未知 declaration 可能是 shorthand并重置其他 property，无法生成安全全局 order。
- **重新评估**：更新版本化 CSS metadata 和 effect graph 后逐项开放。
- **依据**：[ADR-0018](adr/0018-use-a-data-driven-property-effect-registry.md)。

### D009 — Logical/physical property 混用

- **当前行为**：同一 target/condition 中可能映射到同一 used side 的 logical 与 physical property 混用返回 diagnostic。
- **原因**：winner 依赖运行时 `direction` 和 `writing-mode`，无法用一个全局 property order安全表达。
- **重新评估**：语言拥有可证明的 writing-mode/direction scope，或设计保留浏览器顺序的显式 contextual fallback 后。
- **依据**：[ADR-0018](adr/0018-use-a-data-driven-property-effect-registry.md)。

### D010 — 第三方 package condition-order 协商

- **当前行为**：暂不定义 npm package 如何携带或合并 `@media`/`@supports` condition order；宿主项目只保证自身配置。
- **原因**：package 私有顺序可能与宿主冲突，需要单独的命名空间和合并协议。
- **重新评估**：开始支持发布可复用 GSS package 时。
- **依据**：[ADR-0003](adr/0003-global-order-for-registered-at-rule-conditions.md)。

### D011 — Typed/private custom property 与安全 value lowering

- **当前行为**：custom property 名称和值保持开放且 opaque，不默认 hash，也不据 `var()` 推断单值类型。
- **原因**：变量可能由 inline style、继承、外部主题或 JavaScript 设置，并可替换为多 component token stream。
- **重新评估**：引入显式 typed/private token 声明，并能证明所有 provider 时。
- **依据**：[ADR-0007](adr/0007-atomize-custom-property-providers.md)、[ADR-0005](adr/0005-order-atoms-by-global-property-effects.md)。

### D012 — 未声明 selector path 的自动合成

- **当前行为**：只为 `.gss` 实际声明的 selector path 生成 reference，不根据 JSX 嵌套组合出新 path。
- **原因**：样式文件没有声明完整 DOM 结构，自动组合会产生组合爆炸和错误结构假设。
- **重新评估**：未来若引入显式 target/slot declaration，可由该声明生成额外 path。
- **依据**：[ADR-0010](adr/0010-map-style-reference-paths-to-selector-class-paths.md)、[ADR-0011](adr/0011-accumulate-rules-that-necessarily-match-a-target-path.md)。

### D013 — IDE 原生 scope-reference quick fix

- **当前行为**：生成 `.d.ts` JSDoc，并由构建 Adapter 返回 escape diagnostic；尚无 TypeScript language-service/ESLint quick fix。
- **原因**：先冻结 scope semantics，再维护编辑器集成。
- **重新评估**：React Adapter diagnostic code稳定后。
- **依据**：[ADR-0017](adr/0017-use-self-as-the-explicit-class-string-escape.md)。

### D014 — Generic preserved/raw CSS escape hatch

- **当前行为**：没有自动或显式 `preserve`、`raw`、`ignore` 整块 fallback；无法证明安全的输入直接失败。
- **原因**：通用 escape 会让构建成功不再代表语义安全，并容易成为绕过语言约束的默认路径。
- **重新评估**：真实项目出现无法通过 supported contextual/residual/global 能力改写的必要案例后；未来设计必须显式 opt-in、限制 scope、进入 manifest/report 并记录原因。
- **依据**：[ADR-0019](adr/0019-fail-closed-when-safety-cannot-be-proved.md)。

### D015 — Production CSS code splitting

- **当前行为**：所有 reachable main/lazy GSS Module进入一个中央 production CSS asset；不按 JavaScript route拆分。
- **原因**：跨 asset网络与注入顺序会破坏全局 property/relation/condition order，并可能重复 atom和 resource。
- **重新评估**：中央模型稳定且真实数据表明 lazy CSS预下载成本显著后；方案必须证明 SSR、prefetch、并行 chunk和 HMR下顺序一致。
- **依据**：[ADR-0028](adr/0028-use-one-central-css-asset-and-snapshot-hmr.md)。

### D016 — Production short/hash naming

- **当前行为**：第一版使用完整 canonical identity 的可逆可读编码，不做 hash或全局递增压缩。
- **原因**：先优化调试、可解释性和语义验证；递增名会造成构建/HMR漂移，hash长度与收益需要真实 corpus数据。
- **重新评估**：产品语义和 NameAllocator port稳定，并获得 CSS、JavaScript、SSR HTML 的 raw/gzip/Brotli 与增量 churn数据后。
- **依据**：[ADR-0029](adr/0029-use-reversible-readable-names-for-the-first-version.md)。

## Intentional non-goals and guarantee boundaries

### N001 — 任意消费侧 class composition winner

GSS-l 不分析 `cx()`、外部 `className` 或多个 export 被用户任意组合后的冲突；只降低其中可识别的 GSS reference。需要保证的相关样式应在一个已声明 GSS scope/branch 内表达。见 [ADR-0004](adr/0004-do-not-analyze-consumer-class-composition.md)。

### N002 — Ownership token 误用保护

普通 `.father .son` 可以下推为 son 的纯 atom。用户把 `styles.father.son` 挂到不属于 father 的 subtree 后仍可能生效；这是调用方违反 ownership 契约。只有 `>`、`+`、`~`、ancestor state 等 runtime relation 强制要求双端 marker。见 [ADR-0001](adr/0001-descendant-selectors-as-style-scope-targets.md)、[ADR-0012](adr/0012-use-contextual-markers-only-for-runtime-relations.md)。

### N003 — 用偶然 source/registration order 解决歧义

可共存、不可比较、等优先级且修改同一 target/property 的不同 condition 不依赖首次注册或偶然输出顺序，Compiler 返回 diagnostic。见 [ADR-0002](adr/0002-reject-ambiguous-coactive-state-conflicts.md)、[ADR-0013](adr/0013-prefer-logically-narrower-runtime-relations.md)。

### N004 — GSS runtime conflict merge

首期和当前产品方向不引入运行时 style merge、Proxy 或 string/object coercion。Scope reference 由构建期 React Adapter降低，浏览器 runtime只执行正常 CSS selector 与 cascade。
