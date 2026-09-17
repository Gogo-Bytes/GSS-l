---
status: accepted
---

# JSX `className` 隐式降低 scope，其他 string context 显式使用 `.self`

每个生成 style path 在运行时是形如 `{ self, ...targets }` 的静态 scope object。React Adapter 在 JSX `className` expression 内把已知 GSS scope reference 隐式降低为 `.self`；在其他需要真实 class string 的位置，用户必须显式写 `.self`。首期只传播局部不可变 direct/conditional/property alias，不允许 scope object 任意逃逸到函数、容器或其他文件。

## Consequences

- `className={styles.father}`、`className={styles.father.son}` 和同一 expression 内的 `cx(styles.father, external)` 自动降低为各自 `.self`。
- `const className = cx(styles.father.self, external)`、DOM API 和任意 string API 在 JSX `className` 外显式使用 `.self`；Adapter 不追踪函数返回值来猜测最终用途。
- 支持 `const branch = cond ? styles.father : styles.mother` 及其局部 property alias；在 JSX `className` 中的 `branch`/`branch.son` 降低为 `.self`。
- 跨函数返回/参数、数组、普通对象、export、动态 key 和跨文件 scope-object propagation 首期返回 escape diagnostic；若只需要字符串，diagnostic 建议添加 `.self`。
- 生成类型使用带品牌的 phantom `string & scope-shape` 维持 React JSX 体验，同时由 GSS Adapter弥补 TypeScript 无法表达 contextual coercion 的缺口。
- 生成 `.d.ts` 为 scope 与 `.self` 提供 JSDoc；后续可增加 ESLint、TypeScript language-service diagnostic 和 quick fix。
