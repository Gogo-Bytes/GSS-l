---
status: accepted
---

# 将 semantic reference CSS 作为正式测试能力

GSS-l 第一版提供独立 testing API `compileGssReference()`，生成保持 authored selector/cascade/declaration grouping 的 reference CSS与对应 style mapping，用于和 atomic输出在隔离浏览器环境中做 computed-style oracle比较。Reference能力不进入 production默认输出或 bundle。

## Accepted testing seam and first implementation slice

`@gss-l/testing` now owns the synchronous, framework-independent API:

```ts
function compileGssReference(
  input: { config: GssCompilerConfig; modules: readonly ReplaceStylesheetInput[] },
  ports?: { resolveAssetUrl?: (identity: string) => string },
): ReferenceCompileResult;
```

The input and port types are exported as `CompileGssReferenceInput` and `ReferenceCompilerPorts`. The result is discriminated by `success`: success returns `css`, `scopeSchemas` (keyed by input Module id, using public `ScopeSchema`), and `diagnostics`; failure returns only `diagnostics`, never partial CSS/mappings. There is no retained session state. Duplicate logical Module ids fail. Module CSS is sorted by project-relative identity; authored rules and declaration groups within a Module are not reordered.

The first slice accepts only plain ASCII local classes (`[A-Za-z_][A-Za-z0-9_-]*`) and whitespace descendant paths, with `color`, `background-color`, `display`, `width`, `height`, and physical `margin`/`padding` shorthand and four longhands. Declaration order, grouping, comments, and `!important` remain authored. Values remain opaque CSS token streams, but functions and escapes are rejected in this slice. Exact-property duplicates at equal importance fail, as in the GSS declaration contract. Separate normal/important declarations are retained.

Reference names reversibly encode logical Module id and authored class, independently of atomic names. The same authored class has one reference token per Module, including when it appears at different scope paths. Only declared paths and their structural prefixes are mapped. Actual matching ancestor DOM lets the browser perform ordered-subsequence accumulation, specificity, importance, and shorthand/longhand cascade; the reference never computes winners.

Unsupported syntax/configuration fails explicitly: selector lists/nesting, states/attributes/pseudo-elements, child/sibling/runtime relations, all at-rules/resources, properties outside this bounded list, nonempty registered condition/layer order, and nonempty asset bindings. Empty condition/layer registrations and either atomic fallback policy are accepted; no fallback/planning is performed. `resolveAssetUrl` is the approved future port shape but is never invoked in this resource-free slice. This restriction prevents a configured GSS precedence from being silently replaced with native authored order. These are **current reference coverage limits**, not changes to product capabilities or new product deferrals.

The package has no production dependents. Public compiler shapes are type-only imports; runtime parsing uses PostCSS, with local lexical Module-path infrastructure. It imports no production compiler implementation, winner/pruning service, atom identity, planner, or allocator, and performs no filesystem/browser/framework work.

The bounded browser harness (`packages/testing/browser`, command and assertions in `packages/testing/README.md`) compiles the atomic side through the public production API only. It renders identical DOM with substituted mappings into isolated documents, compares explicitly touched longhands against both sides and literal expected values, and includes a deliberately corrupted atomic-CSS negative control. Coverage is local ownership/Module isolation, ADR-0011 descendant accumulation, and margin/padding order/importance. The parent ran the separate native `agent_browser` gate: all three fixtures passed with zero computed/expected-value differences and the negative control detected `margin-left: 9px` versus corrupted `123px`. The complete state/condition/resource oracle, browser CI and Pilot are **not complete**.

## Consequences (full target, beyond the first slice)

- Reference renderer可以共享 parser、selector AST、source range和asset resolver，但不经过 winner pruning、atomic identity、property排序或 contextual atom planner，降低共同错误导致假通过的风险。
- Reference 与 atomic fixture使用相同 DOM/状态脚本和不同 class mapping；比较 touched properties、property-effect longhands、custom properties、pseudo-elements、state、condition、relation和 layer/important结果。
- 快速 CI覆盖 IR/CSS/manifest/reference snapshot；浏览器 CI覆盖代表性 oracle corpus，差异报告 selector path、state、condition、property、两侧值与 source range。
- Keyframe/animation优先比较静态 metadata和可稳定采样结果；font resource使用结构/manifest验证，避免平台字体渲染噪声。
- Testing API置于独立 testing seam/package，production compiler和React Adapter不依赖它。
- Pilot验收要求零未解释 computed-style difference。
