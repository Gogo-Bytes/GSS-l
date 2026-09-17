---
status: accepted
---

# 首期支持 React，并保持 framework-agnostic domain core

GSS-l 首期只实现 React/JSX 消费侧集成。React 的 `className` AST 识别、binding provenance 和源码改写属于 Adapter，不进入 Compiler domain。Compiler domain 只接收结构化 style usage、selector path、declaration 和 condition 等模型，通过明确 port 与 React Adapter、构建工具和 CSS renderer 交互，以便后续增加 Vue、Svelte 或其他环境而不重写语义核心。

## Consequences

- Domain 层不得依赖 React、JSX、Babel、SWC、Vite 或具体 bundler AST 类型。
- React Adapter 负责识别 JSX `className` 中的 GSS reference，并转换成 domain 可消费的 style-usage request。
- Application/use-case 层编排 `.gss` 编译、usage lowering、registry census/finalize 和 diagnostics；基础设施实现 parser、source transform、asset 输出等 port。
- 首期不要求 Vue/Svelte Adapter，但 domain interface 和 diagnostics 不使用 React 专属术语表达通用语义。
