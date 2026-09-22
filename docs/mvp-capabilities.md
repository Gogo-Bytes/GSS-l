# GSS-l MVP capability matrix

本文件列出第一版已接受的正向能力契约，**不是所有能力已实现或已通过完整验收的清单**。未列入的语法按 fail-closed 处理；已明确讨论并延后的能力见 [deferred-capabilities.md](deferred-capabilities.md)。实现与验收状态以 [MVP roadmap](mvp-roadmap.md#reading-status-and-counts) 为准；以下状态核对基于 `7e9b81a`，不改变 accepted ADR 或新增延期项。

## Implementation status versus accepted scope

- **Implemented bounded slices:** local ownership/pure atoms, supported contextual selectors, property-effect fallback, resources, transactional session/finalization, local React lowering, and Vite production/dev delivery. The roadmap links code/tests and distinguishes each slice from its full acceptance gate.
- **Partial compiler semantics:** full effect classification, specificity/relation implication, complete canonical condition-context precedence, residual/global selectors and matrix-wide fail-closed diagnostics remain open. Existing simple query/layer handling and bounded `:has()` residuals do not establish the full contracts listed below.
- **Not implemented:** interleaved ownership/runtime chains with explicit-global functional/observed branches; browserslist compatibility transformation/indivisible sequences; compatibility-specific whole-Module fallback. Property-effect fallback is implemented separately.
- **Partial architecture/output:** the first internal `CssParserPort` is injected into the session with default PostCSS composition outside the use case; domain-owned normalized IR now carries original UTF-16 half-open declaration/rule/resource/frame spans ([granularity](architecture.md#internal-source-provenance-bounded-implementation)). The public constructor remains unchanged. Optional public `GssSourceRange` is now supported for bounded `GSS1001` syntax, `GSS1101` unsupported selectors and `GSS1204` duplicate declarations ([ADR-0051](adr/0051-expose-bounded-original-css-diagnostic-ranges.md)): original caller UTF-16 half-open offsets, actual repeated declaration or enclosing authored rule granularity, and zero-width parser-reported points when no end exists. Unreliable/map-helper origins and other sites omit ranges; id/code/order/LKG remain unchanged. The full value model, public port suite, `NameAllocatorPort` wiring and complete reversibility proof remain open. Compiler CSS source maps, remaining diagnostic-site attribution, IDE/overlay consumption and richer target manifest/report fields are absent; current version-1 output is not that full target.
- **Partial React/host acceptance:** constrained shared-type/cross-file provenance and typed escapes remain open. Vite server/watch tests and previously recorded browser smoke checks exist; full representative lifecycle, SSR/SSG/client linkage and hydration acceptance remain incomplete. SSR statements below apply within [ADR-0044](adr/0044-scope-vite-adapter-to-vite-managed-html.md)'s supported host boundary, not arbitrary SSR responses.
- **Verification:** historical 631-test and native 49/875/six-control evidence is retained. The first internal parser stage passed 648 workspace tests (17 new); BOM/inline-map decode/schema fixes reached 676 (28 follow-up tests), but review exposed a remaining lazy mapping-lookup failure. Its instance-local repair adds 19 tests, reaching **695 workspace tests** (265 Compiler), preserving valid CSS with lazy malformed maps and the 13-row annotation compatibility table. The parent freshly repeated native 49/875 after the lazy-lookup repair with zero differences/literal failures and all six controls, without oracle/fixture changes ([evidence](mvp-roadmap.md#stage-2--domain-model-and-syntax-normalization)). This remains bounded regression evidence, not a full React/resource oracle. Browser CI and the real-project Pilot remain incomplete. No checked-in browser CI workflow exists at this baseline.

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

- 独立 `@gss-l/testing` 的同步 `compileGssReference({ config, modules }, { resolveAssetUrl? })` 已实现有界 reference slices；成功返回 CSS/ScopeSchema mappings/diagnostics，失败仅返回 diagnostics，无 partial output，production 不依赖 testing。
- 当前 reference 正向覆盖：ASCII local class、whitespace descendant path；current/ancestor `:checked`、`:disabled` 和同节点 intersection（仅一个 state-bearing path node），或一个 current/ancestor data-/ARIA equality attribute（不混用 pseudo）；attribute name `(data|aria)-[a-z][a-z0-9_-]*`，仅 `=`，值为无 escape 的单/双引号文本（排除对应 quote、NUL/LF/CR/FF）或 unquoted `[A-Za-z_][A-Za-z0-9_-]*`，允许空 quoted 值和 name/operator/value 周围 CSS whitespace，不接受 namespace/flag/其他 operator/attribute string 外 comment；`color`、`background-color`、`display`、`width`、`height`；physical `margin`/`padding` shorthand 与四个 longhand、authored grouping/order 和 `!important`。Browser 原生完成 selector accumulation/cascade，不调用 atomic winner/planner/allocator。
- Reference pseudo slice 正向覆盖 terminal `::before` / `::after` 和可选 current checked/disabled intersection；pseudo 不创建 ScopeSchema path node；`content` 沿用 opaque/no-function/no-escape policy，不自动补 content，不模拟 applicability。祖先 state/attribute + pseudo-element 不在此 reference slice。
- 当前 reference 对上述及下述有界 background-image/keyframe 范围外的 syntax、value functions/escapes、condition/layer config 显式报错；既有 resolver port 仅用于 bound background-image。这是 reference coverage 边界，不改变上文 GSS product capabilities；reference 不是完整 GSS validator，也不解析 state ambiguity。
- 有界隔离浏览器 harness 已通过 native `agent_browser` 验证：ownership/Module isolation、ADR-0011 descendant ordered-subsequence accumulation、shorthand/longhand order/importance；无 computed-style/字面 expected-value 差异，故意损坏 atomic CSS 的 negative control 被检测。使用方法见 [`packages/testing/README.md`](../packages/testing/README.md)。
- 新增 native state/attribute 与 descendant cascade browser gate 已通过 parent native `agent_browser`：19 fixtures / 213 comparisons（8 compiled-reference fixtures + 11 handwritten contextual goldens），双方独立满足 literal expectations、零 differences/expectedFailures，negative control 仍检测 `9px` / corrupted `123px`。原 ancestor `1px → 9px → 1px → 1px` counterexample 与 checkbox 全五阶段 `margin-left: 1px` 均通过。Compiler 以 target/source-prefix embedding 绑定重复类路径，保留 base/current/ancestor specificity、封闭 predicate 内 winner 与 coactive ambiguity diagnostic；覆盖正反 authored order、四边 shorthand/longhand、important 和 simultaneous conditions；额外 child/`:has()` golden 验证 unrelated-condition toggle 不改变 winner，保留 source/subject prefix specificity、child tie precedence 与 observed match/no-match/restoration，未扩展 reference API 语法。
- 后续 pseudo slice parent native `agent_browser` 通过 **21 fixtures / 395 comparisons**（保留原 19 / 213，新增两组）；host/before/after 独立 literal expectations、Module isolation、importance、无 content、descendant/subsequence/structural prefix 与非 replaced button disabled enter/exit。新增 pseudo-only corruption 检测 before color red → `rgb(1, 2, 3)`，host/after 不变，页面通过必须同时检测两个 control。Checked + pseudo 仅 API coverage。Public red prefix regression 触发有界 Compiler restoration：同 layer/condition 内既有 pseudo/state group 扩展到有 descendant ownership proof 的 declared path/prefix；单 terminal class 可匹配 runtime-derived target，不从 sibling path 名推断祖先；闭合 target winner 沿用 ADR-0027。
- Pseudo review follow-up：原 21 / 395 未覆盖 specificity inversion / cross-path coactivity 两个 P1。Public-session red/green tests 现验证 expanded target 的 authored provenance/specificity（target/priority-qualified identity，不加强共享弱 atom），以及按 pseudo subject 分离的 accumulated coactivity validation（commit / preserved fallback 前检查；歧义保留 LKG；仅 dominating explicit intersection 可消解）。新增四组真实 disabled button 正反顺序/importance/isolation/restoration oracle，parent native gate 通过 **25 fixtures / 575 comparisons**，零 difference/literal failure，两个 corruption control 均有效；full oracle / browser CI / Pilot 仍未完成。
- Registered-condition/layer reference slice：每次调用最多一个非空 condition kind；flat registered media/container 整数 px min/max-width（container 可有 simple name），supports 精确 display block/grid/gss-unsupported；configured simple named layer prelude，允许 layer 内 condition。独立 global base-first/config-rank 排序保留 selector specificity、declaration grouping/importance，由 native cascade 完成 layer normal/important reversal 与 unlayered precedence；不调用 Compiler winner/planner，不改变 API。精确 grammar/exclusions 见 ADR-0030/testing README。
- Parent native gate 通过 **43 fixtures / 803 comparisons**（原 25 / 575 完整保留，新增 18 / 228），零 difference/literal failure。包含 source/config/Module registration reversal、媒体 iframe 与真实 named container 的 640→100→300→640 match/nonmatch/restoration、CSS.supports block/grid true 与 unsupported false、normal/important/unlayered layer priority 和 layer+media。四个 corruption control 均有效：原 element/pseudo 保留；condition 仅 matching baseline/restored 检测 7px→123px；layer prelude reversal 翻转 normal 与 important winner。134 reference tests / 439 workspace tests 及 lint/build/typecheck 通过；本 slice 无 Compiler 修改。Mixed-kind/compound/nested reference coverage 未完成，不是 production capability 的新限制。
- Asset reference 正向覆盖：`background-image` 单个 case-insensitive `url(...)` 或 `none`；quoted/unquoted URL 内 CSS simple/hex escape，CSS-decoded（非 URI-decoded）Module-local binding key、精确 opaque identity、invocation-local resolver cache、安全 CSS string 输出、unbound authored spelling 保留。普通 quoted content 的 URL-looking 文本/注释不重写。所有 Module/config/source/binding 在 callback 前验证；空/未知/冲突 binding、missing/empty/thrown resolver 仅 diagnostics，无 partial CSS/schema。精确控制字符/escape/函数边界见 ADR-0030/testing README；不扩展 general resource、mixed/nested condition 或 production 语义。
- Parent native Asset gate 通过 **46 fixtures / 819 comparisons**（原 43 / 803 保留），零 difference/literal failure，五个 corruption control 有效，pseudo/asset control subjects 之外不变。三组新 fixture 覆盖相同 authored URL 的 Module 隔离、两个 delivery generation mapping 稳定、query/fragment/CSS decoding、layer/media/current disabled `::before`；独立 literal URLs 与 owned SVG fetched/decoded natural dimensions 双侧断言。Wrong-asset control 成功解码但检测 **3x2 → 11x7**，非仅 URL/fetch 成功；不声称 painted pixel 一致。226 reference tests / 531 workspace tests、lint/build/typecheck 通过；无 Compiler/Vite production 或 public API 修改。
- Asset reference review follow-up：20 public red/green regressions 验证 leading value comment 在任何 callback 前 diagnostics-only fail；standalone/quoted comment 保留；outer declaration space/tab/LF/CR/FF 在 `url(...)` / `none` 两种形式均接受，不 trim URL 内容或扩大到 non-CSS whitespace。修复 PostCSS value trivia 边界，未改 production/fixture expectation。Parent post-fix native 重新打开 rebuilt server，再次通过 **46 / 819**、零 difference/literal failure、五个 control detected、pseudo/asset controls unchanged。
- Reference keyframe 正向覆盖：root-only unique Module-local definitions、forward/static single animation-name 与 timing/play-state longhands、独立命名、resource-only/empty definitions 和空 ScopeSchema；frame 仅单个 from/to/0–100% 与 literal px width/height、五种 named color，精确 grammar 见 ADR-0030/testing README。Root definition 在 registered wrappers 内的 reference 为 API-only coverage；lists/shorthand/var、condition/layer-scoped definitions 与 frame Asset 不在 reference slice，不改变 ADR-0024。91 new public tests / 317 reference / 622 workspace + lint/build/typecheck 通过。Parent freshly reopened native gate 通过 49 fixtures / 875 comparisons，零 differences/literal failures、六个 controls detected、pseudo/asset/keyframes controlsUnchanged；第六个 definition-removal control 验证仅 A animation metadata 缺失，原 46 / 819 完整保留。初次 49 / 870 的 effect/frame easing harness 混淆已修复为独立 computed/effect/frame 三层 literal assertions；完整 oracle/Pilot 尚未完成。
- Keyframe reference review follow-up：property/colon separator 仅允许 CSS whitespace + 单个 colon；importance suffix comments 在任何 Asset callback 前 diagnostics-only fail。9 个 public red/green regressions 保留合法 whitespace/mixed-case ordinary importance、frame importance 禁止不变。326 reference / 631 workspace tests 与 lint/build/typecheck 通过；未改 production/API/harness/fixture expectations，Parent freshly reopened final-build native gate 再次通过 49/875、零 differences/literal failures、六个 controls detected、pseudo/asset/keyframes controlsUnchanged、definitionRemoved=true；完整 oracle/Pilot 仍未完成。
- 完整 state/condition/resource oracle corpus、独立 browser CI 与真实 Pilot 零未解释差异门禁仍未完成。
