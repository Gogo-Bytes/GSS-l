# GSS-l

GSS-l 是一个 React-first、构建期运行的 CSS 原子化编译器设计。

作者继续书写接近 CSS Modules 的 `.gss`：

```gss
.father {
  display: flex;
}

.father .son {
  color: red;
}

.father:hover > .son {
  color: blue;
}
```

React 中使用静态 style-scope reference：

```tsx
import styles from "./index.gss";

<div className={styles.father}>
  <span className={styles.father.son} />
</div>
```

Compiler 尽可能生成纯 declaration atom；必须由浏览器判断的 child、sibling、ancestor state 和 `:has()` 等关系生成单 declaration contextual atom。

## 目标

- 保持 CSS-native authored experience，而不是 recipe/object CSS-in-JS DSL；
- 在生成 token 前解析可证明的 cascade winner；
- 使用全局 semantic order，避免首次注册、worker 完成和 stylesheet 注入顺序决定结果；
- Production 输出一个中央有序 CSS asset，不引入 GSS runtime conflict merge；
- 对无法证明安全的输入 fail closed，不静默降级为 preserved/scoped bundle；
- 用独立 reference CSS 与浏览器 computed-style oracle验证语义一致性；
- 将 React/JSX 集成隔离在 Adapter，保持 Compiler domain 可复用于其他环境。

## 核心模型

```text
.gss source
→ parse and normalize
→ capability validation
→ selector paths and ScopeTree
→ cascade/property winner resolution
→ pure/contextual rule planning
→ global registry census
→ deterministic central CSS
```

React/TypeScript 经过独立 Adapter：

```text
React source
→ resolve .gss ScopeSchema
→ lower JSX className references to `.self`
→ preserve all non-GSS class composition behavior
```

在 JSX `className` 外需要具体字符串时显式使用：

```ts
const className = styles.father.self;
```

## 当前状态

第一版产品语义和架构已经形成 ADR，正式实现已按 [`docs/mvp-roadmap.md`](docs/mvp-roadmap.md) 启动。

新的 Compiler workspace 已建立，第一个 public-seam tracer可以通过 `GssCompilerSession.replaceStylesheet()` 与 `finalize()` 把一个 flat local class declaration编译为静态 scope object和可读 pure atom。相邻的旧 GSS 项目只作为只读参考，需要的工具或测试复制到本仓库后再适配。

项目尚未达到 production-ready 状态，也未发布 package。

## TypeScript consumer types

在项目的 `vite-env.d.ts` 中添加一次：

```ts
/// <reference types="@gss-l/vite/client" />
```

它提供全局 `*.gss` 声明，不需要 per-file `.gss.d.ts`。`styles.card` 是 branded scope object，`styles.card.self` 才是 string。宽泛递归类型不保证路径存在；真实路径由 React Adapter 根据 Compiler ScopeSchema 验证。

启用 `noUncheckedIndexedAccess` 时，未知 scope key 与普通 index signature 一样包含 `undefined`，需要检查或非空断言。

## Vite 集成进度

当前实现 Vite 7 的 virtual JavaScript 和显式 framework Adapter 组合：

```ts
import { defineConfig } from 'vite';
import { gss } from '@gss-l/vite';
import { react } from '@gss-l/react';

export default defineConfig({
  plugins: [gss({ adapter: react() })]
});
```

Vite 在 React transform 前按需编译 `.gss`，再复用同步 ScopeSchema validation/lowering；hard diagnostic 阻止当前 load/transform，preserved fallback 返回 JavaScript 并报告 warning。

可以通过相对 import、alias 或 symlink 引用 root 外的 `.gss`。其 logical id 相对 canonical project root，例如 `../shared/Card.gss`；保持相对布局的工作区迁移不会改变生成名称。无法表达相对 identity 的跨 drive/share 输入会报错，不会输出 absolute-path names。

**尚未实现 central CSS、HTML 注入和 HMR；当前切片不是可交付页面样式的完整集成。** 不需要也不应添加手动 central CSS import。

验证使用 `corepack pnpm verify`：先 lint 和按依赖顺序 build，再运行测试和 typecheck，以验证真实 workspace package exports，不依赖残留 `dist`。

## 文档

- [Language design](docs/language-design.md)
- [Compiler and Adapter interfaces](docs/compiler-interface.md)
- [Architecture](docs/architecture.md)
- [MVP capability matrix](docs/mvp-capabilities.md)
- [Deferred capabilities and non-goals](docs/deferred-capabilities.md)
- [MVP roadmap](docs/mvp-roadmap.md)
- [Semantic safety evaluation](docs/semantic-safety-evaluation.md)
- [Architecture decisions](docs/adr/)
- [Validated lessons](docs/validated-lessons.md)

## Delivery policy

Every implementation stage must satisfy its roadmap completion criteria and relevant checks before commit and push. Package publication and releases require a separate explicit decision.
