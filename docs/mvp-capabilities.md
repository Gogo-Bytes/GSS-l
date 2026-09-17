# GSS-l MVP capability matrix

本文件只列出第一版已经确认支持的正向能力。未列入的语法按 fail-closed 处理；已明确讨论并延后的能力见 [deferred-capabilities.md](deferred-capabilities.md)。

## Consumer environment

- React/JSX `className` lowering。
- `styles.<scope>` 与 `styles.<scope>.<target-path>`。
- JSX `className` 内隐式 `.self`；其他 string context 显式 `.self`。
- 局部不可变 direct、conditional 和 property alias。

## Selectors and relations

- Local class scope 与 descendant class path。
- Selector list。
- Runtime combinator：`>`、`+`、`~`。
- Attribute 与 ARIA condition。
- Current-element pseudo state，以及 ancestor state 驱动 target。
- `:not()`、`:is()`、`:where()` 的 pseudo、attribute 和 explicit-global 参数。
- 受约束的 `:has()` observed relation。
- Tag/attribute 与 `:global(...)` residual selector。
- 标准 CSS nesting，在 semantic analysis 前展开。

## Pseudo-elements

- `::before`
- `::after`
- `::placeholder`
- `::marker`
- `::file-selector-button`
- `::backdrop`
- `::first-line`
- `::first-letter`
- `::selection`

## Conditions

- `@media`
- `@supports`
- `@container` size、named 与 style query。
- 项目级 registered condition order；未注册 condition 输出 warning 且 precedence 不保证。

## Declarations

- 标准 property/value syntax，value 默认 opaque。
- `!important`。
- Data-driven shorthand/longhand property effects。
- Custom property provider、inheritance 与 `var(...)` consumer。
- `@property` 全局 registration。
- Browserslist transformer生成的兼容 declaration sequence。

## Output planning

- Pure declaration atom。
- Runtime relation contextual atom。
- Path-specific source/target marker。
- Selector-path accumulation 与编译期 winner resolution。
- Global property-effect order；registry registration order 不参与 cascade。
