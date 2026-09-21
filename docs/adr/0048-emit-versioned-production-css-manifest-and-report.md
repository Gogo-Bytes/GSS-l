---
status: accepted
---

# Production 输出单一 CSS 与 versioned manifest/report

完整 Rollup Module census 后，Vite Adapter 将 `Compiler.finalize().css` 以 asset name `gss.css` emit，最终路径和 hash 遵循 Vite/Rollup 的 `assetFileNames`。同时输出固定文件名的 `gss-manifest.json` 和 `gss-report.json`，分别封装现有 Compiler manifest/report，不新增 SSR helper 或插件配置项。

```ts
// gss-manifest.json
{ version: 1, cssAsset: 'assets/gss-<hash>.css', compiler: snapshot.manifest }

// gss-report.json
{ version: 1, cssAsset: 'assets/gss-<hash>.css', compiler: snapshot.report }
```

## Consequences

- `cssAsset` 相对输出目录，不包含部署 base；HTML 注入单独处理 base 与入口目录。
- 所有 Vite-managed HTML 入口引用同一个 asset，包含 lazy reachable Modules 的 CSS。
- 没有 reachable `.gss` 时，不输出上述三个文件，也不注入 stylesheet link。
- JSON 的 Compiler 字段直接使用当前 `finalize()` 结果，不假装提供尚未实现的统计字段。Manifest 的 Module references 使用 project-relative logical id，与 `moduleDetails` 和 rule/resource sources 一致；physical id 仍只承担 session lookup/lifecycle 职责。
- 本约定不修改 Vite 自己的 manifest schema，也不引入 runtime stylesheet discovery。
