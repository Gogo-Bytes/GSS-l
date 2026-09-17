---
status: accepted
---

# 在 class-value context 中降低 style-scope reference

GSS-l 的公共 authored interface 使用 `styles.<scope>` 表示 scope 自身 class，使用 `styles.<scope>.<target>` 表示下推到 target 的 class；用户不书写 `.root`、`.self` 或 `.targets`。构建 Adapter 对来自 `.gss` import 的引用执行范围明确的 JavaScript/TypeScript AST lowering：class-value context 中的 bare scope reference 降低为内部 `self` token，完整 target path 降低为对应 target token。内部 `self` 只属于生成 IR，不是公共 API。

## Consequences

- `className={styles.father}` 降低为 father self class；`className={styles.father.son}` 降低为 son target class，解析时使用最长 member path。
- `cx(styles.father, external)` 只降低已知 GSS reference，不分析 `cx`、外部 class、冲突或 winner，因此 ADR-0004 的消费侧组合边界继续成立。
- 支持受限的局部 branch reference 传播，例如 `const branch = cond ? styles.father : styles.mother`；`className={branch}` 降低为内部 self，`branch.son` 保持 target 访问。MVP 以 `const`、单次初始化和静态可解析候选为边界。
- 动态 key、跨函数/跨文件逃逸、任意容器传播和无法静态证明的 alias 不静默猜测，返回 diagnostic 或明确标记为暂不支持。
- 生成类型可以使用编译期 phantom intersection 表达“可作为 class string 且拥有 target”，但必须配套 escape diagnostics，不能只依赖类型伪装。
- Adapter 需要消费侧 AST transform；这修正 ADR-0004 中“不需要解析调用点”的实现推论，但不改变“不管理任意 class composition”的产品边界。
