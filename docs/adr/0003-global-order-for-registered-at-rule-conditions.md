---
status: accepted
---

# 用项目级配置统一已注册 at-rule condition 的顺序

GSS-l 不求解任意 `@media` 或 `@supports` 的包含、互斥和重叠关系；项目可以在全局 GSS 配置中注册 condition 并定义唯一顺序，所有 Module 和中央 registry 按这一顺序生成 CSS。该顺序只管理 `@media`、`@supports` 等 at-rule condition，不替代 pseudo、group 或 peer 的 selector specificity 规则。

## Consequences

- 未注册的 condition 仍允许编译，但 Compiler 输出 warning，建议加入全局配置；GSS-l 不保证它与其他 condition 的 cascade precedence，实际输出结果按当前产物执行。
- Compound condition 可以显式注册并获得稳定顺序；未注册的 compound condition同样只 warning，顺序不属于语义保证。
- 已注册 condition 的配置参与构建缓存和 deterministic CSS 排序；配置顺序变化需要重新生成相关产物。
- 第三方 package 如何声明或接入宿主 condition order 暂时不考虑。
