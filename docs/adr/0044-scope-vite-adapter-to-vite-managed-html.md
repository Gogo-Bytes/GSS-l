---
status: accepted
---

# 将 Vite Adapter 限定为 Vite 管理的 HTML 入口

`@gss-l/vite` 只负责 Vite 管理的 SPA、MPA和Vite-based SSG HTML入口，包括central GSS CSS asset、`transformIndexHtml`注入、Vite HMR与production asset。Next.js等不使用Vite作为主要构建链的SSR/SSG框架不由通用Vite Adapter处理；未来通过独立的framework Adapter（例如`@gss-l/next`）接入其server、RSC、SSG、CSS和HMR生命周期。Compiler只提供framework-agnostic CSS snapshot、manifest和resource结果。

## Consequences

- Vite Adapter不承诺拦截任意SSR runtime response，也不提供泛化SSR HTML helper作为第一阶段核心能力。
- Vite SPA/MPA/SSG可以自动向Vite HTML pipeline管理的每个HTML入口注入central CSS。
- Next.js、Remix、Astro和其他非Vite SSR/SSG集成被明确延后，不在`@gss-l/vite`中加入框架特判。
- 后续framework Adapter必须复用`@gss-l/compiler`、`@gss-l/types`和对应source Adapter，而不能复制Compiler或React lowering逻辑。
