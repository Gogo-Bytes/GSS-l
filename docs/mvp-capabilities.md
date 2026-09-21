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

## Asset delivery (production and dev implemented)

- Relative CSS/font URLs resolve against their owning `.gss`, with stable logical Asset identities separate from base and output hash.
- Vite-owned asset reads, watch, rebasing and independent local asset emission; root URLs use `publicDir`.
- Existing data/remote/fragment URLs and query/fragment preservation.
- Missing local assets fail the current operation while preserving last-known-good dev CSS.

The Compiler protocol is implemented: pure URL discovery, transactional `assetReferences`, stable bound identities, and render-time `resolveAssetUrl` for atoms/preserved CSS/resources. See [ADR-0049](adr/0049-separate-asset-identity-from-delivery-urls.md) and [ADR-0050](adr/0050-discover-bind-and-render-asset-references.md). Vite production reads/watches canonical local files, retains byte snapshots with cached Modules, and emits only final-census resources. It supports relative/CDN base, custom asset naming, missing-file failure and watch recovery. Dev serves base-aware versioned byte snapshots behind Vite host/CORS/file-access checks, without automatic inlining or a new browser runtime. Asset add/change/delete/recreation uses native central CSS HMR; byte-only changes preserve scope JS, identity changes invalidate consumers, and missing resources retain committed CSS and bytes. Identical-byte recovery still clears the native error overlay. Tests cover public/font resources, encoded filenames, shared ownership, symlink identity changes, external-path denial/explicit allowance and stale-read suppression.

## Output planning

- Pure declaration atom。
- Runtime relation contextual atom。
- Path-specific source/target marker。
- Selector-path accumulation 与编译期 winner resolution。
- Native-style importance/layer/specificity cascade resolution。
- Semantic source-order vector：registered condition、relation implication、property effect。
- Cascade resolution 与 deterministic render order分离；registry registration order和 canonical hash不参与 winner。
- Production 全局 census/finalize并输出一个中央 CSS asset；SSR引用同一 build manifest asset。
- Production `gss-manifest.json` / `gss-report.json` version-1 envelope，包含 output-relative `cssAsset` 与 Compiler snapshot；空 GSS census 不输出文件，MPA HTML 共享同一 asset 并支持 absolute/relative/CDN base。
- Artifact、manifest和report记录`atomic`/`preserved` mode、fallback reason与atomic coverage；fallback产生warning且可由项目升级为error。
- Dev replace-by-id transaction、last-known-good rollback、ref-count回收与完整 ordered snapshot HMR。
- Dev `/@gss-l/central.css` virtual CSS；Vite-managed SPA/MPA HTML 自动注入一个 base-aware stylesheet link，使用原生 Vite CSS HMR，并同步晚发现的 Module 与晚连接的 client。
- 独立 NameAllocator生成由完整 canonical identity 可逆编码的可读名称。
- Root 外的 `.gss` 使用 `../shared/Card.gss` 形式的 project-relative logical identity；支持相对 import、alias 和 symlink canonicalization，不将绝对路径写入 Module-owned names。

## Verification

- 独立 `@gss-l/testing` 的同步 `compileGssReference({ config, modules }, { resolveAssetUrl? })` 已实现首个有界 slice；成功返回 CSS/ScopeSchema mappings/diagnostics，失败仅返回 diagnostics，无 partial output，production 不依赖 testing。
- 当前 reference 正向覆盖：ASCII local class、whitespace descendant path；`color`、`background-color`、`display`、`width`、`height`；physical `margin`/`padding` shorthand 与四个 longhand、authored grouping/order 和 `!important`。Browser 原生完成 selector accumulation/cascade，不调用 atomic winner/planner/allocator。
- 当前 reference 对上述范围外的 syntax、value functions/escapes、非空 registered condition/layer config 与 asset bindings 显式报错；resolver port 暂不调用。这是 reference coverage 边界，不改变上文 GSS product capabilities。
- 有界隔离浏览器 harness 已通过 native `agent_browser` 验证：ownership/Module isolation、ADR-0011 descendant ordered-subsequence accumulation、shorthand/longhand order/importance；无 computed-style/字面 expected-value 差异，故意损坏 atomic CSS 的 negative control 被检测。使用方法见 [`packages/testing/README.md`](../packages/testing/README.md)。
- 完整 state/condition/resource oracle corpus、独立 browser CI 与真实 Pilot 零未解释差异门禁仍未完成。
