---
status: accepted
---

# 通过项目级 Vite client reference 加载 GSS 全局类型

项目通过一个项目级声明文件引用`@gss-l/vite/client`来加载全局`*.gss` module declaration：

```ts
/// <reference types="@gss-l/vite/client" />
```

该声明文件只需在项目中存在一次，不按`.gss` Module生成或维护sidecar declaration。该方式沿用Vite client类型的集成习惯，同时让全局GSS类型声明显式进入TypeScript/IDE上下文。

## Consequences

- `@gss-l/vite`需要提供可被TypeScript `types` reference解析的`client.d.ts`入口。
- 初始化文档和项目模板应提示用户在`vite-env.d.ts`中加入该reference。
- 未加入reference的项目仍可运行Vite virtual Module，但TypeScript不会获得全局`*.gss`声明；这属于集成配置问题而不是Compiler runtime错误。
- 不生成per-Module `.gss.d.ts`，也不要求IDE plugin。
