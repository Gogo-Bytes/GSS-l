---
status: accepted
---

# 开发使用 virtual CSS，生产生成 central CSS asset

`@gss-l/vite` 在开发环境提供稳定的`/@gss-l/central.css` virtual CSS Module，由Compiler snapshot驱动并支持完整HMR；生产构建在Rollup census完成后的`generateBundle`阶段调用`Compiler.finalize()`并emit单一central GSS CSS asset。当前Vite build中所有reachable GSS Module进入同一asset，SPA/MPA/SSG的Vite-managed HTML入口引用同一份asset。

## Consequences

- 开发环境不依赖最终asset hash，GSS replace/invalidate可以直接触发central CSS HMR。
- 生产环境不会在过早的virtual CSS load阶段生成不完整snapshot；最终asset在reachable Module census后确定。
- MPA的多个HTML入口共享同一central GSS CSS asset，而不是每个入口重复生成一份GSS CSS。
- HTML injection需要区分dev virtual URL与production emitted asset URL，但用户不需要手动import CSS。
- Lazy reachable Modules也进入同一production central asset，避免chunk CSS加载时序改变全局cascade order。
