---
status: accepted
---

# 将自有 DOM 的 descendant 样式编译到目标元素

对于由同一个业务状态共同切换的自有 DOM，`.father .son` 不再要求最终 CSS 保留 descendant 匹配关系，而是表达一个样式作用域中的 root 与 target：调用方使用同一个已有状态选择一次 `father` 或 `mother` 样式分支，再把该分支提供的 root、son、icon 等静态 class token 分别挂到真实元素。Compiler 在构建期把 descendant declaration 下推为目标元素上的纯 atom，不推断 React DOM，也不引入运行时样式合并。这样保留 descendant CSS“一次切换父状态即可同步切换多个子节点样式”的便利，同时让真正控制样式的 class 位于子元素本身。

## Consequences

- 最终调用 interface 的具体拼写尚未冻结；`classes.root`、`classes.son` 仅作为当前概念示例。
- JavaScript 已掌握的状态优先选择完整样式分支；调用方不再分别为每个子元素重复同一个条件判断。
- 目标元素必须显式使用所属分支提供的 target token；ownership 是调用契约，不由 Compiler 猜测真实 DOM ancestry。
- ancestor/peer 的浏览器状态，例如 `.father:hover .son` 和 `.input:checked ~ .label`，不能无条件下推为永久纯 atom，继续作为 group/peer 类 contextual atom 讨论。
- 第三方 DOM、portal 或违反 ownership 契约的调用不在这项保证内，需要 diagnostics、contextual selector 或显式 fallback 的后续设计。
