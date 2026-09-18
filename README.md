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

第一版产品语义和架构已经形成 ADR，正式实现尚未开始。

当前分支中的早期 Compiler/parser代码是旧 recipe/variant/slot 方向的探索性原型，不代表已接受 interface。实施首先会清理该原型，再按照新的 roadmap 从 Domain 与测试闭环重新开始。

项目尚未达到 production-ready 状态，也未发布 package。

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
