---
status: accepted
---

# Style reference path 精确映射 selector class path

GSS-l 按完整 class path 解析 target：`styles.icon` 对应 `.icon`，`styles.father.icon` 对应 `.father .icon`，`styles.father.son.icon` 对应 `.father .son .icon`。不同 path 是不同 style target，不按最后一个 class 名扁平合并。可控 class path 之后的不可挂载 selector suffix 保留为 contextual atom selector，例如 `.editor .ProseMirror p` 由 `styles.editor.ProseMirror` 提供 marker，并输出形如 `.marker p { <single declaration> }` 的规则。

## Consequences

- React Adapter 使用最长静态 member path 查找 selector path；不存在的 path 由生成类型和 Compiler diagnostic 拒绝，不生成空字符串。
- 不同 branch 的 target shape 可以不同；条件分支后访问并非所有候选都拥有的 path 时返回类型/编译错误。
- Tag、attribute、pseudo-element 等不可直接作为 class token 挂载的 selector 部分可以作为 residual selector suffix；它仍按一条 declaration 一个 contextual atom处理，而不是 declaration bundle。
- 哪些 combinator、functional pseudo、sibling relation 和 residual selector 可以安全保留，仍由后续 selector support matrix 决定。
- 多条 selector path 在同一真实元素上同时匹配时，如何聚合共同适用的 declaration 仍需单独定义，不能通过最后一个 target 名猜测。
