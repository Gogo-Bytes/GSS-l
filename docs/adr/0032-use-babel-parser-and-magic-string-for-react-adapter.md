---
status: accepted
---

# React Adapter 使用 Babel parser 与 MagicString

React Adapter 使用 `@babel/parser` 解析 JSX/TSX，使用 source range 分析 GSS scope reference，并使用 MagicString 进行局部源码替换；第一版不使用 Babel generator，也不依赖 TypeScript TypeChecker。这样可以保持用户原始源码格式与 source map 边界，同时将 Babel 限制在 React Adapter 内，不污染 framework-agnostic Compiler Domain，也不要求 Vite 项目采用 Babel 作为自身编译器。

## Consequences

- Adapter 的职责链为 `Babel parser → React semantic analysis → source-range rewrites → MagicString`。
- Parser、semantic analyzer 与 source rewriter 分离；未来可替换为 SWC parser而不改变 Compiler public seam。
- 第一版只接受语法和局部绑定上可证明的引用，不通过完整 TypeScript 类型推断扩大支持范围。
- Babel parser 与 MagicString成为 React Adapter基础依赖；SWC、TypeScript Compiler API和完整Babel generator不作为第一版实现路径。
