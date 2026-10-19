# SPA 验收结论与缺口

## 结论

已有单页 React 应用的有界验收，不是 SPA 尚未验收；但不能据此宣称完整客户端路由生命周期已验收。历史浏览器通过范围以 [STATUS.md](STATUS.md) 为准，本轮没有重跑浏览器。

普通跨文件 `className` 字符串传递不要求跨文件 scope 推导。父组件 `<Card className={styles.card} />` 在父文件内 lowering 成 `.self`，子组件 `props.className` 保持字符串。`packages/react/test/transform-react-gss-usage.test.ts` 本轮新增显式的父／子独立转换回归；这验证转换契约，不冒充真实浏览器或 TypeScript 类型兼容性验收。

## 已有覆盖与明确结论

| 场景 | 现有入口 | 结论／边界 |
| --- | --- | --- |
| React 单页真实交互、开发／生产样式对照 | `packages/testing/acceptance/task-board/check-engine.mjs`、`article/check-engine.mjs` | 历史已有独立原生对照及精确图像证据；Article Firefox 导航问题仍暂缓，不宣称三引擎全通过 |
| CSS-only 更新 | Task-board `dev/css-only-resource-hmr` | class mapping 不变时，验证资源样式更新且 document 不替换 |
| class mapping 改变 | Task-board `dev/class-map-edit-reload` | 当前允许且显式验证 document reload、React 状态重置；不保证无刷新或保留 React 状态 |
| 无效修改与恢复 | Task-board `dev/class-map-recovery-reload` | 验证错误 overlay、last-known-good 样式、无效修改时 document 保留；恢复后允许 reload |
| 删除／重建、晚发现模块、晚连接 HMR client | `packages/vite/test/dev-css.test.ts` | 有真实 Vite server 自动化测试，但这些测试本身不是浏览器交互验收 |
| 资源更新／丢失／恢复 | `packages/vite/test/dev-assets.test.ts` | 有宿主回归；不能据此推导任意应用状态下的浏览器恢复行为 |
| 懒加载与 hydration | `packages/testing/browser/vite-multipage-lazy-check.mjs`、`vite-host-check.mjs` | 有有界 MPA/lazy、SSG hydration fixture；不是完整 SPA router 验收 |

## 缺口分类

1. **验收覆盖缺口**：未找到显式使用 History API 或 React Router 的端到端路由 gate；路由切换、返回／前进、路由懒加载、卸载／重挂载、嵌套路由及深链接刷新不能算已整体证明。MPA 跳转和组件懒加载不等于 SPA 路由切换。
2. **已明确的体验限制**：class mapping 变化可触发整页 reload 并丢失 React 状态。这是现有验收明确接受的行为，不是本轮可擅自改成 state-preserving HMR 的授权。
3. **真实浏览器证据缺口**：样式删除／重建有 server 测试，但不能将它等同于真实单页应用 DOM／交互恢复的证明。
4. **历史已知问题**：Firefox Article dev→production 导航仍未解决；通用 readiness 历史超时原因未确定。不能通过本轮基础检查注销这些问题。

上述覆盖缺口不是已经复现的产品缺陷。后续若验收 SPA router，应先确定代表性应用与路由范围；若需要新增运行时、配置或改变 HMR 行为，先请求 owner 决策。性能和 Firefox Article 仍不纳入当前实施。
