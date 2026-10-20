# Research: GSS symbol storage and consumer paths

## Summary

Separate symbol keys can store a node’s class string and child namespace in one backing object without collisions. They **cannot make the same untransformed JavaScript expression `styles.card` both an actual primitive string and a node carrying per-path children**: `.card` requests the string key `"card"`, not either symbol, and JavaScript supplies no “used as className versus used as namespace” mode to that property read.

Keeping both `styles.card` and `styles.card.title` with actual strings at consumer boundaries is potentially viable as an **explicitly compiled GSS language extension**, using schema-backed path expansion and a source-facing string intersection type. This is not transparent ordinary JavaScript: every permitted namespace-bearing use must be transformed or validated, with explicit restrictions on escapes and external consumers. No implementation or public-contract change is authorized by this report.

## Evidence and scope

Research angles: (1) ECMAScript access/storage/coercion, (2) TypeScript checking/declarations/tooling, (3) current repository implementation, (4) consumer forms and collision boundaries. External sources below are official TC39, TypeScript and W3C material; section anchors, not search summaries, are the evidence. Conclusions derived from algorithms are labeled **interpretation/inference**.

Read locally: `AGENTS.md`, `README.md`, `docs/STATUS.md`, `docs/CORE-AUDIT.md`, `packages/types/src/index.ts`, `packages/compiler/src/application/compiler-session.ts` (including all three renderers and `renderScopeType`), `packages/react/src/index.ts`, `packages/vite/client.d.ts`. Local statements below are source inspection, not newly executed tests. The research worker had no execution tool. The parent subsequently executed the bounded in-memory experiments recorded under “Parent validation”; other proposed acceptance cases remain unverified. The existing reproduction recorded in CORE-AUDIT is prior evidence, not a new run here.

## Findings

### 1. Storage is feasible; access syntax is a separate problem

**Claim:** an object can have `[CLASS]: string` and `[CHILDREN]: children` with distinct symbols, alongside arbitrary authored string keys. **Support: direct evidence plus interpretation. Confidence: high.**

ECMAScript [§6.1.7, The Object Type](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-object-type): “A property key is either a String or a Symbol.” All strings and symbols are valid keys. Symbols with the same description are still distinct identities; TypeScript’s [Symbols / unique symbol](https://www.typescriptlang.org/docs/handbook/symbols.html#unique-symbol) models declaration-specific symbol identity.

A conceptual representation (not a proposed production patch) is:

```ts
node[CLASS]     // primitive class-list string
node[CHILDREN]  // child-name -> node mapping
```

But [§13.3.4, EvaluatePropertyAccessWithIdentifierKey](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-evaluate-property-access-with-identifier-key) takes the identifier’s **StringValue**. `styles.card` requests `"card"`; dot spelling does not discover a symbol described as `"card"`. A getter or Proxy can route that key into internal storage, but must return one value.

A generated facade could return a node, a primitive, or a function. Choosing storage keys alone does not choose—or reconcile—those observable results. Symbols avoid internal collisions; they do not create two public value namespaces for one property expression. Symbol properties are also not inherently secret: reflection can discover own symbol keys.

### 2. Get/GetValue and Proxy cannot inspect the future consumer context

**Claim:** an untransformed property read has no standard “namespace use versus string use” discriminator. **Sources:** [GetValue §6.2.5.5](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-getvalue), [Get §7.3.2](https://tc39.es/ecma262/multipage/abstract-operations.html#sec-get-o-p), [OrdinaryGet §10.1.8.1](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-ordinaryget), [Proxy [[Get]] §10.5.8](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-proxy-object-internal-methods-and-internal-slots-get-p-receiver). **Support: direct algorithm evidence; impossibility conclusion is interpretation. Confidence: high.**

- `GetValue` converts a property-reference base with `ToObject`, then returns `baseObj.[[Get]](referencedName, receiver)`.
- `Get(obj, key)` returns `obj.[[Get]](key, obj)`.
- `OrdinaryGet` returns a data property’s value or calls its getter with the receiver.
- Proxy `get` is called with exactly `target, propertyKey, receiver`; receiver is the access receiver, **not** the later caller, JSX prop type, or next member name. Frozen-target invariants also constrain what a trap may return.

Consequently, the first read of `styles.card` in `takeString(styles.card)` and in `styles.card.title` has no standardized lookahead. Returning a primitive makes the first case genuinely a string, but loses the per-node child object in the second. Returning a node preserves traversal but sends an object to `takeString`. Call-site stack inspection, global prototype mutation or stateful read-order tricks are not a general, sound replacement.

[§13.3.8.1, ArgumentListEvaluation](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-runtime-semantics-argumentlistevaluation) evaluates an ordinary argument and applies `GetValue`, with **no automatic string coercion**. A `className?: string` annotation does not add runtime conversion; arbitrary component implementations can inspect `typeof`, compare values, forward them, or call string methods. A specific DOM coercion or library accepting stringifiable objects is insufficient to promise arbitrary string-prop or `cx` compatibility.

### 3. Symbol.toPrimitive does not make a node a primitive string

**Claim:** a coercion hook can help explicit coercion, not ordinary argument passing, primitive identity, or sound `string` assignability. **Sources:** [ToPrimitive §7.1.1](https://tc39.es/ecma262/multipage/abstract-operations.html#sec-toprimitive), [ToString §7.1.19](https://tc39.es/ecma262/multipage/abstract-operations.html#sec-tostring), [typeof §13.5.3.1](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-typeof-operator-runtime-semantics-evaluation). **Support: direct evidence plus interpretation. Confidence: high.**

`ToPrimitive` consults `%Symbol.toPrimitive%` when conversion is requested; it can return a string. The original object remains an object (`typeof` is `"object"`, or `"function"` for callable objects). Stringification and a real string value are different contracts. Object identity/equality, serialization, iteration and helper dispatch need independent consideration. Many class combiners distinguish strings, arrays and object dictionaries; no universal `cx` behavior should be assumed.

Boxing with `new String(...)` is still an object, not a primitive. Modifying `String.prototype` cannot provide arbitrary, path-specific child namespaces: different paths may legitimately have identical class-list strings, so string contents cannot uniquely recover scope provenance. It also contaminates unrelated strings. These are researcher inferences, not a supported alternative.

### 4. TypeScript can describe a string intersection; it cannot manufacture its runtime properties

**Claim:** `string & { readonly title: ... }` can be a source-facing path model assignable to `string`, but is not proof of a faithful ordinary-JS implementation. **Sources:** [Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html), [Object Types / Intersection Types](https://www.typescriptlang.org/docs/handbook/2/objects.html#intersection-types), [Type Assertions](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions). **Support: direct language descriptions; GSS application is interpretation. Confidence: high; parent-validated bounded diagnostics are recorded below.**

TypeScript is structurally typed. An intersection imposes both constituents’ requirements; it does not introduce a conversion. Assertions are erased and “won’t affect the runtime behavior.” Declaring a backing object to be `string & Children` merely makes checking more permissive if the emitted object is unchanged. Conversely, emitting a primitive while leaving an untransformed `.title` access violates the advertised child contract.

As a **declared extension**, a source model might conceptually be:

```ts
type SourcePath<Children> = string & Children;
// Concept only: every generated child member must stay readonly.
```

A GSS checker/transformer could interpret the apparent members as path syntax and expand the **entire path**, not execute members on a primitive string. This can be coherent only within its defined language subset. Passing a *lowered terminal primitive* to an uncompiled component/helper is fine; allowing an uncompiled consumer to traverse a value typed as `SourcePath<Children>` is not. Arbitrary string-returning functions do not become namespace-preserving automatically.

Collision warning: an intersection inherits string members (`length: number`, `toString`, numeric indexing, etc.). A child also named `length` or `toString` must satisfy conflicting members simultaneously; intersections do **not** override the string side. The handbook’s [Interface Extension vs. Intersection](https://www.typescriptlang.org/docs/handbook/2/objects.html#interface-extension-vs-intersection) explicitly warns about incompatible properties. Parent validation confirms that `string & { readonly length: string }` exposes `length` as `never` in pinned TypeScript 5.7.2; this is not an override or a usable child contract. Other collision cases still need their own checks. Omitting members from `string` generally loses the primitive `string` subtype guarantee; `Omit<string, ...>` is not a magic primitive with overridden members. Supporting all CSS names with this surface may require stronger custom checking than stock intersection declarations, or a distinct bracket/path API.

### 5. Type/value namespaces and unique symbols do not split a value expression

**Claim:** TypeScript namespace separation is unrelated to choosing two runtime values for `styles.card`. **Sources:** [Declaration Merging / Basic Concepts](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#basic-concepts), [Merging Namespaces with Classes, Functions, and Enums](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#merging-namespaces-with-classes-functions-and-enums), [unique symbol](https://www.typescriptlang.org/docs/handbook/symbols.html#unique-symbol). **Support: direct evidence plus interpretation. Confidence: high.**

The handbook separates namespace-, type- and value-creating declarations. A type name can coexist with a value name; that affects **type positions versus value positions**, not two value positions in JSX/property access. Function/namespace merging models a function object with properties; it still is not a primitive string. A `unique symbol` can brand a type or identify a symbol-keyed field; neither a declaration-only brand nor symbol identity changes runtime `GetValue` behavior. The existing `declare const GSS_SCOPE: unique symbol` is a typing device, not evidence that the generated object has a runtime brand property.

### 6. CLI, editor and declaration generation need separate contracts

**Claim:** editor plugins cannot close the transformation/checking gap by themselves. **Sources:** official TypeScript wiki [What’s a Language Service Plugin?](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin#whats-a-language-service-plugin), [Creating .d.ts Files from .js Files](https://www.typescriptlang.org/docs/handbook/declaration-files/dts-from-js.html#setting-up-your-project-to-emit-dts-files). **Support: direct evidence. Confidence: high.**

The wiki says plugins change the “editing experience only”; they cannot add different typechecking, change JS emit, and “aren’t loaded ... by `tsc`.” An editor diagnostic/completion plugin may supplement a defined GSS language; suppressing an error in the editor is not CLI acceptance or safe output. A Vite/Babel transform is also not proof that `tsc` sees transformed source.

Generated declarations must actually be emitted, included/resolved, kept synchronized with CSS schema changes, and checked against runtime output. If stock `tsc` checks a source-facing intersection while Vite does the lowering, a mandatory separate GSS validation step must reject every unsupported usage. If preprocessing before `tsc` or a custom checker is chosen, editor/CI/build/declaration maps must agree. Declaration emit alone does not implement runtime semantics. Exporting an extension-only path type to ordinary downstream TS/JS must either be forbidden or accompanied by an explicit compilation contract.

**Validation limitation:** `source_check` was attempted on the key Proxy/plugin claims. It returned `unclear` and a provider error for the plugin query, rather than independent confirmation. The original TC39 algorithms and official TypeScript wiki were fetched and inspected directly; these primary passages support the conclusions above. No automated source-check confidence score is claimed as validation.

## Current repository: what exists, not what is already wired

**Support: direct local source inspection. Confidence: high within inspected files.**

- `packages/types/src/index.ts`: `GssScope<TTargets>` is an object intersection with `readonly self: string`, a readonly unique-symbol brand, and `TTargets`; `GssUnknownScope` adds a **broad readonly recursive string index signature**. `GssStyles` is a readonly string-keyed map. The wildcard `packages/vite/client.d.ts` exposes `GssStyles`, not CSS-file-specific exact paths.
- `renderModuleCode` / `renderScopeObject`: generate nested ordinary objects with `self` and authored child fields. They are not primitive strings, callable scopes or Proxies. Keys use JSON quoting; child `__proto__` uses a computed key to avoid object-literal prototype semantics. These objects are **not runtime-frozen** in the inspected renderer.
- `renderDeclarationCode` / `renderScopeType`: construct a schema-shaped declaration string with readonly root and child members and `GssScope<...>`. The presence of this artifact field does **not establish that an import’s editor/CLI module resolution consumes a generated exact `.d.ts`**. The inspected wildcard is broad; exact declaration delivery remains to be traced/decided.
- `packages/react/src/index.ts`: lowering is visited under JSX `className` expressions and appends `.self` to recognized scope uses. Static member resolution accepts **noncomputed Identifier chains**; bracket literals are not currently accepted by `readStaticReference`. Lexical binding identity guards direct imported roots against shadowing.
- Current alias handling recognizes a bounded set of direct scope initializers/conditional scopes, some destructuring from verified member expressions, and local typed-prop patterns. This is not general alias propagation, module-graph analysis, arbitrary helper rewriting or whole-program escape validation. Dynamic paths in recognized className positions receive `GSS2101`; unknown paths receive `GSS2102`. Do not broaden that to “all unsupported code everywhere is already rejected.”
- CORE-AUDIT records strict TSX TS2322 for an object scope passed to `className?: string`, while `.self` passes. Existing lowering and a passing JSX demo do not solve source TS checking.
- `readonly` must remain part of any replacement public type. TypeScript [readonly Properties](https://www.typescriptlang.org/docs/handbook/2/objects.html#readonly-properties) says it changes no runtime behavior and does not guarantee total immutability. Do not claim existing readonly declarations imply freezing; mutation/aliasing restrictions matter especially if a compiler assumes stable paths.

## Consumer coverage needed for a compiled-path design

This table is **design analysis**, not an implemented feature list. All new forms require owner approval and parent validation.

| Consumer form | Minimum correct behavior / boundary |
| --- | --- |
| Full static `styles.card.title` | Resolve the complete schema path before lowering. Never emit primitive `styles.card` and then read `.title`. A whole-path map or internal symbol traversal may supply the terminal primitive. |
| `<Child className={styles.card} />`, arbitrary `takesString(...)`, `cx(...)` | Lower the terminal path before invoking any consumer, not only known JSX props or selected helper names. Preserve evaluation order and side effects. The uncompiled consumer must receive a real primitive. |
| `const card = styles.card; card.title` | A lexical alias must retain schema/path provenance for later expansion, while value uses of `card` become class strings. An unused import or alias name alone is insufficient; track binding identity, shadowing and permitted flow. Current `.self` alias handling does not implement this dual expansion. |
| Alias-of-alias, conditionals, mutable binding | Either track all permitted control/data flow and validate joins, or reject it. A const binding prevents reassignment, not mutation of referenced objects. A union of paths needs explicit semantics, not accidental member access on strings. |
| `export const card = styles.card` / re-export / import elsewhere | Either export a terminal primitive and disallow downstream namespace traversal, or require graph-aware metadata and transformation for **every module that traverses**. `.d.ts` alone cannot transport runtime children. External packages, JS entrypoints and separate builds need an explicit policy. |
| `const { card } = styles`, `const { title } = styles.card` | Treat each binding as a path alias or terminal value under an explicit rule. Nested patterns, renamed bindings, defaults, rest, computed keys and enumeration are separate capabilities; reject unhandled forms rather than silently falling through. |
| `styles["card"]["card-title"]` | Literal computed access can be statically resolvable, unlike a genuinely dynamic path; would need new parsing/validation beyond the current adapter. Preserve decoded key identity. |
| `styles[key]`, `card[target]` | Finite literal-union dispatch can be generated if approved and checked. General runtime lookup needs a separate real map/resolver returning strings, or must be rejected. An index signature claiming every key exists is not validation. |
| Passing/storing a namespace alias in arrays, props, closures, callbacks, generic functions, return values | Either transform/validate the permitted flow or prohibit namespace escape. It is safe to pass a lowered **terminal string** to arbitrary uncompiled code; not safe to promise that code can recover children. |
| String operations / reflection / collisions | Decide whether `.length`, `.toString()`, `[0]`, spread, `Object.keys`, `in`, optional chaining and equality mean ordinary strings or GSS path syntax. Reject ambiguity where necessary. Whole-path expansion must not consume real string operations by mistake. |

The minimum viable restricted extension could permit only schema-validated full static paths, approved immutable lexical aliases/destructuring, and terminal string uses; prohibit namespace exports, dynamic traversal, reflection and untracked escapes. This is a possible **owner-selected subset**, not a recommendation to silently remove existing capabilities. Namespace-bearing consumer modules would all require compilation/validation; arbitrary downstream components need not be compiled if they receive only terminal primitives.

## Names and collisions

**Claim:** CSS names exceed the safe JavaScript dot-name surface; symbols do not remove public spelling conflicts. **Sources:** [CSS Syntax §2.1 Escaping](https://www.w3.org/TR/css-syntax/#escaping), [§4.3.7 Consume an escaped code point](https://www.w3.org/TR/css-syntax/#consume-escaped-code-point), [ECMAScript identifier property access](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-evaluate-property-access-with-identifier-key), [String Exotic Objects §10.4.3](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#string-exotic-object), [SetFunctionName](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-setfunctionname), [SetFunctionLength](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-setfunctionlength). **Support: direct evidence plus interpretation. Confidence: high.**

CSS escapes can encode punctuation and initial digits; Unicode names are not reducible to ASCII identifiers. For example, decoded `card-title`, `123`, or `a.b` require bracket strings in JS; `.卡片` can be a valid identifier. A CSS escape spelling is not necessarily the decoded property name, and `a.b` as one decoded name is not the two-segment path `["a", "b"]`. Prefer segment arrays or unambiguous encoded path keys over naive dotted concatenation. Preserve parser-admitted CSS names; this report does not assert that the repository admits every legal CSS selector.

A function object naturally has `name` and `length` and inherits `call`/`apply`/`bind`; a child namespace layered on it can collide with those. Ordinary function `name`/`length` are often configurable (the algorithms define them configurable), so “these names are always impossible to redefine” would be false. Redefining/shadowing them still changes ordinary function behavior and type expectations; Proxy target invariants may constrain particular targets. A function scope also requires invocation/conversion to obtain a primitive, violating the requested no-`()` syntax without compilation.

Primitive strings have `length` and string methods such as `toString`; boxed strings additionally have fixed indexed code-unit properties and non-writable/non-configurable `length`. Thus changing from functions to string intersections does not make all child names collision-free. Null-prototype child maps and symbol metadata are useful **internal storage** techniques; the public access/type ambiguity must still be decided. Include `__proto__`, `constructor`, `prototype`, `self`, `name`, `length`, `call`, `toString`, numeric keys, escaped punctuation and Unicode in the proposed acceptance matrix.

## Comparison

| Approach | Actual primitive at arbitrary string consumer | Child namespace | Main trade-off |
| --- | --- | --- | --- |
| No-transform flat actual-string map | Yes, ordinary `styles[key]` | No nested primitive-owned tree; use full-path keys or a separate map | Sound JS/TS boundary, but syntax differs; encode paths without ambiguity. |
| No-transform resolver function returning string | Yes, result of `resolve(path)` | Traversal lives in resolver/schema, not primitive | Dynamic paths possible with validation; requires `()`, contrary to requested surface. |
| Callable node with properties | Only invocation result is primitive | Yes | Function-member collisions; bare node is not a string. Does not meet no-`()` requirement. |
| Object scope + `.self` or explicit helper | Yes, explicit selected result | Yes | Honest existing object contract; explicit extraction remains. Bare scope is not assignable to `string`. |
| Object/Proxy + coercion hook | Only after actual coercion | Yes | No universal string-consumer contract; must not declare it to be a primitive string. |
| Compile-time direct paths (+ optional symbol backing) | Yes **after mandatory lowering** | Source-language paths, not necessarily runtime values | Closest requested surface, but requires declared subset, validation/toolchain ownership, alias/escape policy and collision design. |

## Direction, combinators and CSS semantics

A consumer-reference design must only change how a schema path selects its existing class list. It must **not** redefine ownership/structural paths, `>`/`+`/`~`, marker membership, source/target identities, specificity, module-local ranks, direction/writing-mode mapping, fallback or cross-module precedence. `renderRelationCombinator` and `renderObservedCombinator` retain their existing meanings; an access path is not permission to reinterpret a CSS combinator as ordinary object nesting. Existing logical/physical Policy B remains browser-resolved. New lookup storage should be tested against the same `ScopeSchema` class lists in both atomic and preserved modes, without claiming new CSS admission.

## Contradictions and corrections

- “Two symbols solve the two public meanings” confuses storage with access. They solve internal key separation, not the value returned for `"card"`.
- “Impossible under any design” is too broad: a restricted compiled language can expand full paths. “Works transparently for arbitrary JS/TS consumers” is equally unsupported.
- “Intersection type passes TS, therefore runtime is sound” is false without exhaustive allowed-use lowering/validation. “Coercible object equals string” is also false.
- Exact compiler declaration strings exist locally, but the inspected consumer wildcard remains broad. These are different delivery layers, not proof of exact editor types.
- No contradictory primary source evidence found for ECMAScript or TypeScript semantics. Automated source-check limitations are disclosed above.

## Minimum owner decisions / open questions

1. Is the priority ordinary untransformed JS/TS compatibility, or a mandatory compiled language preserving the requested no-`.self`/no-`()` surface? All three goals (arbitrary JS transparency, primitive strings, arbitrary per-node children) cannot be promised together by symbol storage.
2. If compiled: choose the allowed expression/alias/destructuring/escape subset, error behavior and mandatory CI/build gate. Is exported namespace traversal out of scope or explicitly graph-aware? Are uncompiled consumers terminal-string-only?
3. Are all parser-admitted CSS names required? If yes, choose bracket-literal support and resolve string-member collisions **before** committing to stock string intersections. If restricting names/usages, obtain explicit approval and diagnostics rather than silently dropping valid CSS.
4. Decide declaration delivery: source-facing extension types versus emitted ordinary-JS API, exact schema declarations versus current wildcard, resolution strategy, regeneration/HMR and stale-schema behavior. Do not claim this is already wired.
5. Preserve readonly type intent; separately decide whether runtime immutability is needed for compilation assumptions. No freeze/proxy/configuration API is implicitly approved.

## Parent validation

The parent executed bounded in-memory experiments against the installed TypeScript **5.7.2**, with strict checking, React JSX and NodeNext resolution. No production implementation or repository test was added. Local evidence is under `/tmp/gss-symbol-path-research/`; these temporary paths are recovery aids, not permanent dependencies.

| Experiment | Verified result |
| --- | --- |
| `runtime-results.json`: two separate `Symbol('card')` keys | Values and child trees coexist; ordinary `.card` is absent unless a facade explicitly maps the string key |
| Proxy facade reading standalone `.card` and `.card.title` | The first `get` receives the same `card` key in both cases; returning a primitive makes subsequent `.title` undefined |
| `Symbol.toPrimitive` | `String(node)` returns the desired text, but `typeof node` stays `object` |
| `type-results.txt`: actual symbol-keyed value/tree declarations | Both explicit symbol-indexed accesses satisfy ordinary `className?: string` |
| Source-facing `string & {title: string}` | Root, child, alias child and a consumer accepting that namespace type all pass TS; this shows the gap, not runtime correctness |
| Object with `[Symbol.toPrimitive](): string` | One expected TS2322 when passed to `className?: string`; no other diagnostics in the bounded probe |
| `string & {readonly length: string}` | `length` has type `never`, confirmed by assigning it to a `never` variable; the collision cannot be treated as a child override |
| `static-transform-results.json`: minimal whole-path transform | Direct root and nested references become primitive strings using collision-free JSON segment keys |
| Same transform: local alias / consumer parameter child access | Both remain undefined at runtime; this prototype intentionally performs no alias or inter-module analysis |
| Same transform: child named `length` | Direct compiled `styles.card.length` yields CSS child text while an ordinary materialized root alias `.length` yields numeric string length; the design must explicitly resolve this semantic split |

The illustrative transformer is not production-quality: it intentionally omits lexical shadowing, import validation, side-effect analysis, mutation and unsupported-use diagnostics. Its direct-path success proves only the bounded projection mechanism. It must not be shipped or described as a functioning GSS Adapter. No SSR/browser/framework behavior was newly verified by these experiments.

## Missing evidence and next useful checks

Beyond those bounded probes, validation should use in-memory or otherwise owner-approved prototypes, not production changes:

- Strict TSX + `className?: string`, ordinary typed function, string-discriminating helper and the actual chosen `cx` library: verify diagnostic behavior and that lowered arguments satisfy `typeof value === "string"`. Include unchanged-source controls.
- Candidate intersection collision types (`length`, `toString`, numeric names), readonly rejection, declaration output and downstream consumption using the repository’s pinned TypeScript version. Verify full static and bracket paths independently of broad wildcard acceptance.
- Alias, alias-of-alias, shadowing, export/import, destructuring/rest/default, dynamic/union path, terminal escape, generic/closure and mutation cases. Every allowed use needs a valid output oracle; every excluded use needs a diagnostic.
- Compare lowering outputs to schema-provided class strings, including identical class strings at distinct paths, punctuation/Unicode/escaped names, atomic/preserved modes and existing direction/combinator fixtures.
- Trace exact `.d.ts` installation/resolution in Vite/editor/CLI and check behavior when CSS is renamed, removed or invalid. No new runtime timings, successful prototype counts or measured diagnostics are claimed here.

**Recommendation:** do not implement the symbol proposal as a transparent runtime/type fix. If no-transform compatibility is required, retain honest objects with explicit extraction or choose an actual-string map/resolver and acknowledge the syntax change. If the requested dot surface is essential, authorize a bounded compile-time-path design first, with exhaustive allowed-use validation and collision/declaration policy; symbols are an optional internal representation, not the enabling semantic mechanism.

## Sources

Kept (official primary material):

- [ECMAScript §6.1.7 Object Type; §6.2.5.5 GetValue](https://tc39.es/ecma262/multipage/ecmascript-data-types-and-values.html#sec-getvalue) — property keys and read semantics.
- [ECMAScript abstract operations](https://tc39.es/ecma262/multipage/abstract-operations.html#sec-toprimitive) — Get, conversion and property-key distinctions; exact anchors above.
- [ECMAScript ordinary/exotic objects](https://tc39.es/ecma262/multipage/ordinary-and-exotic-objects-behaviours.html#sec-ordinaryget) — Proxy, string and function constraints; exact anchors above.
- [ECMAScript expressions](https://tc39.es/ecma262/multipage/ecmascript-language-expressions.html#sec-evaluate-property-access-with-identifier-key) — identifier access, argument evaluation and typeof.
- [TypeScript Object Types](https://www.typescriptlang.org/docs/handbook/2/objects.html#intersection-types) — intersection conflicts and readonly limits.
- [TypeScript Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html) — structural typing and stated soundness limits.
- [TypeScript Symbols](https://www.typescriptlang.org/docs/handbook/symbols.html#unique-symbol) — unique symbol identity and symbol-keyed fields.
- [TypeScript Declaration Merging](https://www.typescriptlang.org/docs/handbook/declaration-merging.html#basic-concepts) — type/value/namespace distinctions.
- [TypeScript Everyday Types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#type-assertions) — assertions do not implement runtime behavior.
- [TypeScript official language-service plugin guide](https://github.com/microsoft/TypeScript/wiki/Writing-a-Language-Service-Plugin#whats-a-language-service-plugin) — editor versus compiler boundary.
- [TypeScript declaration generation guide](https://www.typescriptlang.org/docs/handbook/declaration-files/dts-from-js.html#setting-up-your-project-to-emit-dts-files) — declaration generation and distribution are explicit steps.
- [W3C CSS Syntax](https://www.w3.org/TR/css-syntax/#escaping) — decoded/escaped CSS names; normative escape-consumption section linked above.

Rejected/deprioritized: older ECMAScript editions surfaced by search (used the fetched current living specification with named anchors instead); secondary search summaries and generic Proxy/type-assertion tutorials (primary algorithms/docs suffice); performance benchmarks (irrelevant to this semantic decision). No claim about a particular `cx` implementation is made without inspecting that selected implementation.
