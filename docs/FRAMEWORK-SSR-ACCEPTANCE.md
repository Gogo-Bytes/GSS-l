# React Router Framework SSR 外部消费验收

## 范围与结论

owner 授权官方 Framework Mode SSR，并在首次失败后明确选择新增公共 stylesheet URL seam。使用 `create-react-router@8.5.0` 官方默认模板，在 workspace 外安装本地未修改 tarballs，通过 Chromium 的 dev 与实际 production request-time SSR 验收。不是 Vite preview／SPA fallback／预渲染，也不是所有框架、版本或浏览器的支持声明。

首次失败证据仍保留：`artifacts/framework-ssr/2026-10-26T07-17-32.639Z/`。此前 GSS 只向 Vite HTML pipeline 注入 CSS，框架请求时生成的 `<Links>` 没有 GSS link；JS 关闭及 hydration 后均为黑色且没有资源图像。没有用硬编码 hash、私有 manifest reader、tarball patch 或自定义 server 注入修补这个问题。

## 公共接入

保留原来的公开插件配置，GSS 在框架插件之前：

```ts
import { defineConfig } from 'vite';
import { reactRouter } from '@react-router/dev/vite';
import { gss } from '@gss-l/vite';
import { react } from '@gss-l/react';

export default defineConfig({
  plugins: [gss({ adapter: react() }), reactRouter()],
});
```

`app/gss.d.ts` 保留 `/// <reference types="@gss-l/vite/client" />`。在普通 root route 中使用显式 URL：

```tsx
import stylesheetHref from 'virtual:gss.css?url';

export const links = () => [
  { rel: 'stylesheet', href: stylesheetHref },
];
```

root Layout 保留框架的 `<Links />`、`<Scripts />` 和 SSR 配置 `ssr: true`。全应用只声明一次 GSS aggregate link。

这个 seam 是**native emitted asset URL + 框架正常 links() href**，不是把 GSS 注册成框架逐 route CSS extraction graph；没有新的 compiler 框架依赖或请求级运行时。CSS 仍汇总包含当前构建中可达的 static／lazy GSS Modules，不是 lazy CSS。原有 HTML SPA/MPA 无需添加这个 import，仍自动获得 central link；不要额外用 JS 再 append 第二份 link。

返回值采用 Vite base。已验证绝对根 base、非根 `/app/` 的 client／SSR 构建；相对 base 仍按 native `new URL(..., import.meta.url)` 语义解析，不作为本次请求级 SSR 部署保证。SSR 部署应设置与 public assets 一致的绝对路径／CDN base。框架须发布 client assets，不能只部署 server bundle。所验框架会搬移／去重 SSR emitted assets 到 client 目录。

### 返回类型兼容说明

owner 已确认采用插件组方案。`gss()` 现在返回 Vite plugin array，而非单个 `Plugin`，以分离 manifest 之前的临时 asset 清理与 manifest/HTML 之后的自动链接。标准 `plugins: [gss(...)]` 不变，Vite 会展开嵌套数组；本仓库所有调用均为该形式。直接读取 `gss(...).name` 或手工调用 hooks 的程序化消费者需要调整，不承诺旧的单对象形状。没有改变 `GssOptions` 或增加配置开关。

## 实现约束与回归

- `virtual:gss.css?url` 的 URL 是标准 emitted-file reference，通过 `resolveFileUrl` 解析到最终 CSS；不在 load 时冻结未完整发现的 CSS，不硬编码 hash。
- 在 renderStart 对已完成的 static/lazy graph 重新 census，使用 source/asset snapshots；不在输出阶段重读 source 文件。
- 初始 forward reference 和未采用的 CSS candidate 在 native manifest 收集前清理，固定 metadata 仍在原有 post 阶段做冲突检查。CSS/asset hash、map、conditional wrappers 和 automatic HTML injection 保留。
- dev 显式 href 复用同一 CSS session，但使用独立 linked endpoint。普通 source 修改／恢复仍走 native CSS HMR；首次／重连 socket 不对 framework-owned SSR link 做初始 href 替换，避免在 hydration 前制造 DOM mismatch。SSR 模块处理在 HTML/CSS 请求前发现所需声明；新请求读取最新完整 CSS。
- `stylesheet-url.test.ts` 覆盖 client／SSR 非根 base、lazy census、资源、conditional wrappers、native manifest 文件存在、placeholder 清理及其它插件 dedup asset 的引用保留、automatic link 去重、metadata collision、watch removal/restoration 与 clean build 一致、初始/重连 link 稳定、后续修改/LKG/恢复；消费类型回归覆盖 `href: string`。
- Compiler 与 React Adapter 未引入 Framework Mode 分支。workspace 仍为 Vite 7，未改 lockfile 或依赖版本。

## 可复验命令与固定版本

```sh
corepack pnpm framework-ssr:check
```

脚本：`packages/testing/acceptance/framework-ssr/check.mjs`。需要 registry/GitHub 网络、Node 22.22.0+、已安装 Playwright Chromium、空闲端口 5197；每次运行写独立时间目录，保留外部 consumer，不覆盖失败。

- 官方文档：https://reactrouter.com/start/framework/installation 与 https://reactrouter.com/start/framework/rendering。
- 实际生成：`npm exec --yes --package=create-react-router@8.5.0 -- create-react-router app --no-install --no-git-init --yes`；保存 pristine template 后才覆盖最小演示源文件。
- Node 22.22.3、pnpm 8.6.2、create-react-router／@react-router/dev／node／serve／react-router 8.5.0、Vite 8.3.5、React/DOM 19.3.1、TypeScript 6.0.3。框架 engines/peers、其余直接版本、完整 transitive integrity 见产物。
- 外部项目只通过 public exports 消费原始 types/compiler/react/vite tarballs；对未发布 0.0.0 transitive GSS 依赖使用同一批 file tarballs overrides，不 override Vite/React，不关闭 peer 检查；strict install、frozen strict reinstall、framework route typegen+tsc 均通过。
- 外部真实解析路径断言不进入 workspace。保存 package/lock/config/source、命令日志、tarballs/SHA256、build 和原始 HTTP HTML。

## 实际断言

1. 官方 `react-router dev` 与 `react-router build` 后的 `react-router-serve ./build/server/index.js`，不自造 server／不使用 preview。
2. Home 的两个独立请求返回不同 query token，Detail `/details/99` 返回 request token 和参数；HTTP 200 HTML 直接含真实 loader 数据、GSS class 和一份 stylesheet link，排除静态壳冒充 SSR。
3. JS 禁用的 Home/Detail：手写预期红/绿 literal 色值，背景 SVG 解码 3×2，布局分别 30×20 和 24×16。HTML 中链接的 CSS 实际响应为 CSS，资源可解码。
4. JS 开启：相同初始样式、父组件 implicit scope → 另一文件 `className: string`；真实 counter 点击；browser page/console 及 server hydration/recoverable diagnostics 均无错误。不通过 suppressHydrationWarning 忽略问题。
5. Link 导航、真实 back/forward、直接深链接/reload；导航保留 document marker/counter，reload 重置。production Detail JS 初始未请求，导航后请求；Detail CSS 已进入初始 aggregate census。
6. client/server compiler manifest 与 href 相同，production HTML、hydrated DOM 和导航均恰好一份同名 central CSS link；框架正常搬移输出文件，无私有读取协议。
7. 每个模式注入错误 important 色值，**同一个样式校验函数必须失败**；移除后恢复。截图只是运行证据，不宣称像素级独立 oracle。

## 证据与限制

最终通过目录见本报告下方运行记录。所有失败均留在 `artifacts/framework-ssr/` 独立目录：包括原始无链接失败、CSS fetch 未带浏览器 accept header 的测试问题、初始 socket sync 导致 hydration mismatch、Rolldown 不支持 deferred asset source、manifest 在 speculative asset 清理前收集、框架正常搬移 server assets 导致过严文件检查，以及对已被 native CSS minify 的源码拼写作过严断言。修正对应根因／测试假设，不删除 literal 样式、JS-off、href、hydration 或负对照断言。

不覆盖：显式 streaming 场景、其它 SSR 框架、部署平台、server-only GSS 与 client graph 不同的任意多 environment 情况、相对 base SSR 部署、Firefox/WebKit 新模板验收、`.gss` 删除、性能、发布/release/tag。一次框架实验通过不扩大为完整 SSR 产品保证。

### 本轮运行记录

- 最终 Framework gate：`artifacts/framework-ssr/2026-10-26T09-05-07.674Z/`（6 个 raw HTTP responses、10 个 browser phases，8 张 JS-off/hydrated 截图，dev/production 各一组负对照）。
- 原有 SPA/Declarative 外部 gate：`artifacts/vite-template/2026-10-26T09-05-50.220Z/`。
- Vite 7 browser oracle：125 fixtures／1267 comparisons／38 controls 及原有 host/SSG/multipage controls 通过。
- 全仓 `verify`：Compiler 1539、React 49、Vite 161、Testing 334，共 2083 项；lint/build/types 通过。
- 初始“没有 CSS link”失败、所有根因诊断运行和第一次全路径通过 `2026-10-26T08-09-47.452Z` 均保留。没有重跑掩盖未解释的 readiness 问题。
