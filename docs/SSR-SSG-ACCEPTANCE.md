# SSR／SSG 有界验收

## 范围与结论

本轮从 `1168716` 开始，先复验现有 gate，再补充 SSG 禁用 JavaScript 的独立读取。修改后的 gate 与 `corepack pnpm verify` 均通过。未改变产品语义、公开接口或默认引擎。

**结论：当前 Vite-managed HTML 范围的有界 SSG／hydration 验收通过；不能宣称任意生产 SSR 部署已验收。**

现有服务端渲染使用 Vite dev server 的 `ssrLoadModule` 与 React `renderToString`；随后把渲染结果插入生产构建的 HTML，由 preview 提供。这确实验证服务端／客户端 GSS class 一致性及生产 CSS 链接，但不是独立生产 SSR bundle、请求处理服务器或任意 SSR 框架的验证。

## 本轮验收

入口：`corepack pnpm --filter @gss-l/testing browser:check`，默认 Chromium。基线首次通过；增加断言后再运行通过，不是失败重试。

| 场景 | 结果 |
| --- | --- |
| 单页 SSG：服务端渲染与生产 CSS | 生成的 owned class 在生产 CSS 中存在，HTML 链接 manifest 指定 asset |
| 禁用 JS 的 SSG 页面（本轮新增） | 服务端文本 Hello、owned class、唯一 CSS link、红色计算值正确，未 hydration；不允许客户端修复掩盖初始错误 |
| 客户端 hydration | 服务端／客户端 class 一致，无 recoverable hydration error，最终文本与红色计算值正确 |
| 文本破坏负对照 | 故意篡改服务端文本，能观察到 recoverable error 和客户端修复 |
| class 破坏负对照 | 故意篡改服务端 class，检测 server/client 不一致；不声称 React 必然修复 class |
| 双 HTML 入口、共享 CSS | 直接 TS 入口与 hydrated React 入口共享生产 asset，各自保持独立原生 CSS 预期 |
| React lazy 与直接动态 import | 首次加载前／执行后有界读取符合预期；删除 lazy 规则的负对照有效 |
| owned attribute 动态状态 | 与原生 CSS 对照；删除 active rule 的负对照有效 |
| 多入口 hydration 文本负对照 | 检测错误并验证恢复后的读取 |

同一 gate 还通过原 123 个 fixture／1260 项对比、38 个 corpus controls，以及宿主资源／fallback／keyframe controls。它们是回归保护，不计入 SSR 场景数量。

`corepack pnpm verify`：lint、build、类型检查、当前 1419 项测试通过。

## 尚未证明的范围

- 独立 production SSR build 及真实请求时渲染、并发／请求隔离。
- 流式 SSR、流式 Suspense、选择性 hydration。
- 客户端 router 生命周期、嵌套路由和深链接；MPA/lazy 不能替代 router 验收。
- SSR 场景下的全部 base／CDN／资源／fallback／条件／layer 组合；不能把各自独立测试自动合成为组合证明。
- Firefox／WebKit 本轮未运行；不涉及暂缓的 Firefox Article 问题。
- 任意 SSR 响应自动注入 CSS、请求级 CSS 提取、新框架适配：未授权的新契约，不自动实施。

上面是验收覆盖缺口，不是本轮复现的实现缺陷。若下一步要验收 production SSR，先明确保持 Vite-managed HTML 还是扩展到自定义 HTTP 响应；后者可能需要新的宿主契约，不能静默扩展。

## 本机证据

- 基线：`/tmp/gss-l-ssg-baseline.log`、`/tmp/gss-l-ssg-baseline-result.json`。
- 修改后：`/tmp/gss-l-ssg-acceptance.log`、`artifacts/browser-reference.json`，包含新增 `ssgHydration.serverOnly`。
- 基础检查：`/tmp/gss-l-ssg-verify.log`。
- 临时应用由既有脚本清理；JSON 读取和日志保留。证据不作为包发布内容。
