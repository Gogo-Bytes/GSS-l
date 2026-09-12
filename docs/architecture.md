# GSS-l 架构原则

## 定位

`.gss` 是受约束的 authored language，不兼容任意 CSS selector，也不以对既有 CSS Modules 做事后反向分析为主要路径。

## 核心数据流

```text
.gss source
  → parser
  → typed style IR
  → recipe/variant conflict resolver
  → cost and safety planner
  → global atomic registry
  → typed virtual JavaScript module + CSS assets + diagnostics
```

## Compiler Module

Compiler 是项目的深 Module。调用方只需要提供 source、id、mode 和 registry context，并消费：

- JavaScript module；
- 类型声明；
- CSS fragments；
- dependency metadata；
- diagnostics、manifest 和收益数据。

构建工具 Adapter 不复制语言和级联语义，只负责模块图、HMR、chunk、SSR/client 环境以及 asset 注入。

## 正确性约束

1. recipe 在生成 token 前解析 base、variant 和 compound variant 的属性 winner。
2. 同一 property、importance、selector state 和 condition 最终只保留一个有效 declaration，除非语言显式表达 fallback sequence。
3. 任意 class 字符串拼接不属于可证明的 recipe composition。
4. 自有 DOM descendant styling 优先通过 slot 表达；无法控制的第三方 DOM 使用显式 scoped fallback。
5. `!important`、pseudo、attribute guard 和 condition 必须进入 atomic identity。
6. 无法证明安全时不得通过提高原子化率改变 cascade。
7. production 输出、class name、manifest 和 diagnostics 必须可复现。

## 收益约束

Planner 不能只按 declaration reuse 决定原子化，还要估算：

- CSS selector 和 declaration 的 raw/gzip/Brotli 成本；
- JavaScript token string 成本；
- scoped fallback 成本；
- 新增 stylesheet/request 成本；
- lazy chunk 与共享 asset 的重复成本。

只出现一次或转换后更大的 declaration 可以保留为短 scoped rule。

## 非目标

第一阶段不支持：

- 任意 descendant、child、sibling selector；
- tag/id selector；
- Less JavaScript 和 mixin；
- 自动猜测 React DOM 结构；
- 普通 CSS 的无损兼容；
- 未经验证的运行时 style merge。
