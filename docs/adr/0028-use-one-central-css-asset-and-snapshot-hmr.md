---
status: accepted
---

# 第一版使用单一中央 CSS asset 与 snapshot HMR

GSS-l 第一版 production 对应用构建中所有 reachable Module（包括 lazy route）执行全局 census/finalize，并输出一个中央有序 CSS asset。Production 不包含 GSS runtime；SSR 通过 build manifest引用同一 asset。Dev Adapter拥有唯一 style owner，按 Module id transactionally replace/invalidate贡献并重建完整有序 snapshot，不做 append-only rule注入。

## Consequences

- Lazy route CSS首期提前进入中央 asset，以换取全局 property/relation/condition order、零跨 chunk重复和网络加载顺序无关性。
- JS class name由 semantic identity稳定生成；production HTML/SSR只需 `<link>` 中央 asset，client hydration不重新分配名称或规则。
- HMR compile成功后提交新 generation并替换 style全文；失败 rollback并保留 last-known-good CSS，同时展示 diagnostic。
- Module删除或替换后通过引用计数回收零引用 atom、marker和全局 resource；异步旧 generation不能覆盖新 snapshot。
- Finalize同时输出 CSS、manifest、report、generation和 source mapping；共享 atom记录所有来源并选择稳定 primary source。
- CSS code splitting在有真实体积与加载数据后单独设计，不能直接依赖 JS chunk注入顺序。
