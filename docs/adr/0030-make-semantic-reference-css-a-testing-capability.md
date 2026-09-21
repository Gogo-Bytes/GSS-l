---
status: accepted
---

# 将 semantic reference CSS 作为正式测试能力

GSS-l 第一版提供独立 testing API `compileGssReference()`，生成保持 authored selector/cascade/declaration grouping 的 reference CSS与对应 style mapping，用于和 atomic输出在隔离浏览器环境中做 computed-style oracle比较。Reference能力不进入 production默认输出或 bundle。

## Accepted testing seam and bounded implementation slices

`@gss-l/testing` now owns the synchronous, framework-independent API:

```ts
function compileGssReference(
  input: { config: GssCompilerConfig; modules: readonly ReplaceStylesheetInput[] },
  ports?: { resolveAssetUrl?: (identity: string) => string },
): ReferenceCompileResult;
```

The input and port types are exported as `CompileGssReferenceInput` and `ReferenceCompilerPorts`. The result is discriminated by `success`: success returns `css`, `scopeSchemas` (keyed by input Module id, using public `ScopeSchema`), and `diagnostics`; failure returns only `diagnostics`, never partial CSS/mappings. There is no retained session state. Duplicate logical Module ids fail. Module CSS is sorted by project-relative identity; authored rules and declaration groups within a Module are not reordered.

The reference accepts plain ASCII local classes (`[A-Za-z_][A-Za-z0-9_-]*`) and whitespace descendant paths, with `content`, `color`, `background-color`, `display`, `width`, `height`, and physical `margin`/`padding` shorthand and four longhands. Declaration order, grouping, comments, and `!important` remain authored. Values remain opaque CSS token streams, but functions and escapes are rejected in this slice. Exact-property duplicates at equal importance fail, as in the GSS declaration contract. Separate normal/important declarations are retained.

Reference names reversibly encode logical Module id and authored class, independently of atomic names. The same authored class has one reference token per Module, including when it appears at different scope paths. Only declared paths and their structural prefixes are mapped. Actual matching ancestor DOM lets the browser perform ordered-subsequence accumulation, specificity, importance, and shorthand/longhand cascade; the reference never computes winners.

The next bounded slice retains current or ancestor `:checked`/`:disabled` (including a same-node intersection, states on one path node only), or one current/ancestor data-/ARIA equality attribute without pseudos. Attribute names match `(data|aria)-[a-z][a-z0-9_-]*`; only `=` and optional CSS whitespace are accepted. Values are unescaped single-/double-quoted text (excluding the matching quote, NUL/LF/CR/FF), or unquoted `[A-Za-z_][A-Za-z0-9_-]*`; empty quoted strings are valid. No namespace, flags, other operators, escapes or comments outside attribute strings are accepted. Class AST nodes alone are renamed, leaving comment/attribute-string class text intact. This is not a full GSS validator and does not resolve state ambiguity or redefine production capability limits.

The next bounded pseudo slice accepts terminal `::before` and `::after` on existing ownership/descendant paths, optionally with current checked/disabled states and their intersection. The base ScopeSchema path is unchanged. `content` follows the same opaque no-function/no-escape policy; quoted strings and class-looking text are preserved, with no injected content or applicability emulation (ADR-0021). Ancestor-state/attribute + pseudo-element combinations remain outside this reference slice.

Unsupported syntax/configuration fails explicitly: selector lists/nesting, other/functional pseudos, attributes outside that grammar, multi-node states, multiple attributes or attribute/pseudo combinations, other/misplaced/repeated pseudo-elements, ancestor-state + pseudo-element combinations, child/sibling/runtime relations, all at-rules/resources, properties outside this bounded list, nonempty registered condition/layer order, and nonempty asset bindings. Empty condition/layer registrations and either atomic fallback policy are accepted; no fallback/planning is performed. `resolveAssetUrl` is the approved future port shape but is never invoked in this resource-free slice. This restriction prevents a configured GSS precedence from being silently replaced with native authored order. These are **current reference coverage limits**, not changes to product capabilities or new product deferrals.

The package has no production dependents. Public compiler shapes are type-only imports; runtime parsing uses PostCSS and the independent `postcss-selector-parser` syntax library, with local lexical Module-path infrastructure. It imports no production compiler implementation, winner/pruning service, atom identity, planner, or allocator, and performs no filesystem/browser/framework work.

The bounded browser harness (`packages/testing/browser`, command and assertions in `packages/testing/README.md`) compiles the atomic side through the public production API only. It renders identical DOM with substituted mappings into isolated documents, checks literal expected values independently on each side, and retains a deliberately corrupted atomic-CSS negative control. Parent native `agent_browser` acceptance passed **twenty-five fixtures / 575 computed-value comparisons** (fourteen compiled-reference fixtures plus eleven hand-authored contextual goldens), with empty differences and expected failures: ownership/Module isolation, ADR-0011 accumulation, physical shorthand/longhand effects and importance, native checkbox states, ancestor fieldset and data-/ARIA conditions, forward/reversed ancestor cascade with simultaneous current conditions, and repeated-source positive/negative embeddings. Phases enter, exit and restore native DOM properties/attributes, and differences include phase and actual state. The original ancestor attribute counterexample remains unchanged: `margin-left` is `1px → 9px → 1px → 1px` on both sides. The checkbox's approved margin probe is `1px` on both sides in all five phases; native checkbox padding is not used as an oracle. The corruption control still detects reference `9px` versus atomic `123px`.

Eleven additional contextual-boundary browser fixtures use hand-authored native CSS and explicit mappings for child relations and `:has()`; these are test goldens, not new `compileGssReference` capabilities. They guard unrelated-condition toggles, same-source child tie precedence, greater authored specificity/importance, and observed match/no-match/restoration.

The compiler repair uses proven target/source-prefix bindings rather than blanket marker sharing, preserves authored specificity for base/current/ancestor instances, and resolves effect winners only inside a closed bound-predicate candidate set. Incomparable coactive ties fail rather than falling back to generated-name order. Namespace-bearing class AST nodes fail before rewriting, with public no-partial-output regressions. This is bounded manual browser evidence, not the complete state/condition/resource oracle, browser CI or Pilot. Ancestor checked remains API-only coverage.

Two pseudo fixtures add literal host/before/after content, color, display and size readings, Module isolation, importance, absent content, descendant/subsequence/structural-prefix accumulation and native button disabled entry/exit. Diagnostics identify the sampled subject. A pseudo-only atomic color corruption must be detected while host/after controls remain unchanged; both corruption controls passed. Checked + pseudo remains API-only coverage. The public-session red structural-prefix regression led to a bounded repair: pseudo groups now consider same-layer/condition declared paths/prefixes, requiring descendant ownership proof for multi-class candidates; standalone terminal classes can match runtime-derived targets without inferring sibling ancestry. Declared pseudo paths and structural prefixes are materialized independently of retained declarations, including empty rules, so the public ScopeSchema remains available. Winning declaration provenance is retained through expansion and emitted with authored specificity on target/priority-qualified atoms, never by strengthening a weaker shared atom. Accumulated candidates are validated per pseudo subject before commit or preserved fallback; unresolved coactive ties reject transactionally, while a dominating explicit intersection is accepted. Authored order remains restricted to closed bound-predicate winner sets, never global authored-order/name winners. No public API or product semantics changed.

Review of the initial 21-fixture / 395-comparison slice found two blocking counterexamples despite its passing oracle corpus: lost specificity across expanded state groups and unchecked cross-path coactivity. Public-session red/green tests now cover both, LKG retention before fallback, priority isolation and dominating/non-dominating intersections. Four further native fixtures check forward/reverse specificity and importance on real disabled buttons under matching ancestry, including unrelated/standalone same-value atoms and element/before/after isolation/restoration. The expanded parent native gate passed 25 fixtures / 575 comparisons, with both corruption controls effective. This applies existing ADR-0011/0013/0021/0027 semantics; it adds no public API or product precedence.

## Consequences (full target, beyond the first slice)

- Reference renderer可以共享 parser、selector AST、source range和asset resolver，但不经过 winner pruning、atomic identity、property排序或 contextual atom planner，降低共同错误导致假通过的风险。
- Reference 与 atomic fixture使用相同 DOM/状态脚本和不同 class mapping；比较 touched properties、property-effect longhands、custom properties、pseudo-elements、state、condition、relation和 layer/important结果。
- 快速 CI覆盖 IR/CSS/manifest/reference snapshot；浏览器 CI覆盖代表性 oracle corpus，差异报告 selector path、state、condition、property、两侧值与 source range。
- Keyframe/animation优先比较静态 metadata和可稳定采样结果；font resource使用结构/manifest验证，避免平台字体渲染噪声。
- Testing API置于独立 testing seam/package，production compiler和React Adapter不依赖它。
- Pilot验收要求零未解释 computed-style difference。
