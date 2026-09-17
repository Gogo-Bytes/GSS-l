---
status: accepted
---

# Custom property provider 默认作为原 target 上的 atom

GSS-l 将 `--x: value` 视为可原子化 declaration，并把 provider atom挂在原声明 target；consumer 继续通过浏览器原生 inheritance 和 `var()` substitution 取值。Custom property 本身不构成 scoped bundle 理由，只有其 selector 无法安全转换时才进入 selector fallback。

## Consequences

- Provider 不复制或下推到每个 consumer，否则会改变 inheritance boundary、动态后代、inline override 和子树重定义语义。
- 普通 custom property value 和 `var(...)` 保持 opaque token stream；没有额外类型证明时不做 shorthand 展开或值推理。
- Custom property 名称默认不 hash/改写，以保留 inline style、`style.setProperty()`、外部主题和公开 runtime channel 的兼容性。
- 状态下的 provider 可以生成 self/group/peer contextual atom；变量仍由浏览器继承到 consumer。
- `@property` 是独立的全局 registration：同名同定义去重，同名不同定义报错，稳定输出一次。
- 消费侧组合多个 export 或外部 class 后产生的 custom property 冲突继续属于 ADR-0004 的保证范围外行为。
