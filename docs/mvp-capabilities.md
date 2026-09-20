# GSS-l MVP capability matrix

本文件只列出第一版已经确认支持的正向能力。未列入的语法按 fail-closed 处理；已明确讨论并延后的能力见 [deferred-capabilities.md](deferred-capabilities.md)。

## Consumer environment

- React/JSX `className` lowering。
- `styles.<scope>` 与 `styles.<scope>.<target-path>`。
- JSX `className` 内隐式 `.self`；其他 string context 显式 `.self`。
- 局部不可变 direct、conditional 和 property alias。
- 通过 `gss({ adapter: react() })` 显式组合 Vite 和 React Adapter；先 discovery/按需编译，再同步 ScopeSchema validation/lowering。
- 项目级 `@gss-l/vite/client` reference 提供宽泛 branded recursive `*.gss` 类型，不生成 per-file declaration。

## Selectors and relations

- Local class scope 与 descendant class path。
- Selector list。
- Runtime combinator：`>`、`+`、`~`。
- Attribute 与 ARIA condition。
- Current-element 与 ancestor pseudo state：`:hover`、`:focus`、`:focus-visible`、`:focus-within`、`:active`、`:disabled`、`:checked`。
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
- 命名 `@layer` block、nested canonical layer name与项目级 `layerOrder`。
- 项目级 registered condition order；未注册 condition 输出 warning 且 precedence 不保证。

## Declarations

- 标准 property/value syntax，value 默认 opaque。
- `!important`。
- Versioned、data-driven shorthand/longhand property effects；v1覆盖 box、border、background、typography、flex/grid layout、alignment、transition、animation和mask family；unknown property不会被假定为singleton longhand。
- Custom property provider、inheritance 与 `var(...)` consumer。
- `@property` 全局 registration。
- Browserslist transformer生成的兼容 declaration sequence。
- 对selector/scope可证明安全、但property effect或compatibility sequence无法安全atomize的输入，自动整Module preserved；不得逐rule/declaration混合fallback。

## Global resources

- Module-local `@keyframes`，支持静态 `animation-name`/`animation` reference重写、条件上下文、稳定命名与引用计数。
- `@font-face` 不可拆全局资源、descriptor/src 顺序保持、URL dependency tracking与引用计数。

## Output planning

- Pure declaration atom。
- Runtime relation contextual atom。
- Path-specific source/target marker。
- Selector-path accumulation 与编译期 winner resolution。
- Native-style importance/layer/specificity cascade resolution。
- Semantic source-order vector：registered condition、relation implication、property effect。
- Cascade resolution 与 deterministic render order分离；registry registration order和 canonical hash不参与 winner。
- Production 全局 census/finalize并输出一个中央 CSS asset；SSR引用同一 build manifest asset。
- Artifact、manifest和report记录`atomic`/`preserved` mode、fallback reason与atomic coverage；fallback产生warning且可由项目升级为error。
- Dev replace-by-id transaction、last-known-good rollback、ref-count回收与完整 ordered snapshot HMR。
- 独立 NameAllocator生成由完整 canonical identity 可逆编码的可读名称。
- Root 外的 `.gss` 使用 `../shared/Card.gss` 形式的 project-relative logical identity；支持相对 import、alias 和 symlink canonicalization，不将绝对路径写入 Module-owned names。

## Verification

- 独立 `compileGssReference()` testing API生成非原子化 reference CSS/style mapping。
- 隔离浏览器 computed-style oracle比较 reference 与 atomic touched properties。
- 快速 snapshot、浏览器 corpus与真实 Pilot零未解释差异门禁。
