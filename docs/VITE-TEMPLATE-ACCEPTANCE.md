# 官方 create-vite React TS 外部消费验收

## 结论与范围

owner 选择官方 React + TypeScript 模板，并授权 Vite 8 实验及后续 React Router Declarative／BrowserRouter 客户端路由验收。已通过 **Chromium 145.0.7632.6** 的有界 install／类型／dev／production 用户路径及下述路由场景；不是全部 Vite 8／React Router 版本、浏览器、框架或所有 HMR 形状的兼容证明。现有 workspace 仍使用 Vite 7，不升级 lockfile 中的 Vite，不修改旧 gate 的引擎范围。

真实外部消费暴露一个宿主缺陷：Rolldown 的 ModuleInfo 没有 Rollup 的 `implicitlyLoadedBefore`，production census 展开 undefined 导致构建失败。现在只对这个可缺失字段使用空数组，保留 static／lazy 遍历和 Rollup implicit edges；`production-census.test.ts` 分别覆盖字段存在／缺失、循环、external 和 unreachable。完成外部 tarball 验证后，将 `@gss-l/vite` peer 扩展为 `^7.0.0 || ^8.0.0`。

## 运行与版本

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm vite-template:check
```

新 gate 位于 `tests/acceptance/vite-template/check.mjs`，只运行 Chromium；使用仓库已安装的 Playwright，不增加依赖。端口为 5196，要求空闲。需要 npm registry 网络访问和已安装的 Playwright Chromium。

- 官方入口：https://vite.dev/guide/；官方支持 `react-ts` template，Node 要求 20.19+／22.12+，命令为 `vite`／`vite build`／`vite preview`。
- 实际生成：`npm exec --yes --package=create-vite@9.3.1 -- create-vite app --template react-ts --no-interactive`。
- 环境：Node 22.22.3、pnpm 8.6.2。
- 固定工具链：Vite 8.3.5、`@vitejs/plugin-react` 6.1.2、React／React DOM 19.3.1、TypeScript 6.0.3；@types/node 24.19.2、@types/react／react-dom 19.3.0、oxlint 1.88.0。
- 客户端路由新增 `react-router` **8.5.0**，registry stable 查询结果和精确版本 engines／peers 已核对。该版本要求 Node **>=22.22.0**，React／React DOM **>=19.2.7**、@types/react／react-dom **>=19.2.0**；本验收固定环境满足这些约束，不代表 Node 20 可运行此版本路由。
- generator 原始请求 Vite `^8.3.4`；实验固定到同 major 的稳定 8.3.5，没有降级到仓库 Vite 7。完整 transitive 版本／integrity 见每次运行的外部 `pnpm-lock.yaml`。

## 实际用户接入

脚本每次在系统临时目录实际执行官方 generator，保留 untouched template，然后覆盖最小演示源文件；不是复制仓库内部 host 冒充官方脚手架。

1. 先构建仓库的 types／compiler／react／vite 包，再用 `pnpm pack` 生成原始 tarballs。
2. 在 workspace 外的官方模板内以 `file:../tarballs/...tgz` 安装四个包；这些包未发布，因此 `pnpm.overrides` 只将 transitive `@gss-l/*@0.0.0` 定向到同一批未修改 tarballs，不替换 Vite／React，不禁用 peer 检查。安装及 frozen-lockfile 再安装均使用 `--strict-peer-dependencies`。
3. 公共配置：

   ```ts
   import react from '@vitejs/plugin-react'
   import { defineConfig } from 'vite'
   import { gss } from '@gss-l/vite'
   import { react as gssReact } from '@gss-l/react'

   export default defineConfig({
     plugins: [gss({ adapter: gssReact() }), react()],
     build: { manifest: true },
   })
   ```

4. `src/gss.d.ts` 添加 `/// <reference types="@gss-l/vite/client" />`。父组件将 `styles.title` 直接传给另一个文件中 `className: string` 的 Child，Child 使用普通字符串；不导入私有 src、不用 aliases／workspace link／symlink。pnpm 自身 node_modules 链接指向外部项目内的 tarball 提取目录，真实解析路径已断言不落入仓库。
5. 使用 template 的 TypeScript project build；保留其 tsconfig 选项，未假装验证精确路径补全或所有严格类型选项。
6. 根据官方 [Declarative installation](https://reactrouter.com/start/declarative/installation)，在 Vite React 模板安装 `react-router`，从该包导入 `BrowserRouter` 包裹应用，以 `Routes`／`Route`／`Link` 声明路由。新增依赖只在外部 consumer 中固定为 `react-router@8.5.0`，不加入 GSS runtime 或 workspace 依赖；不使用 Data／Framework Router、`@react-router/dev` 或新 Adapter。

## 断言与观察

- dev 和实际 production preview：标题 literal 色值、primitive GSS class、背景资源的 3×2 解码尺寸与 30×20 布局、计数器交互。
- lazy route：首次 Home 不请求 Detail JS，点击 Link 后请求并渲染，literal 绿色；production 初始 central CSS census 已包含 Detail.gss，不是 lazy CSS。
- React Refresh：修改 Child.tsx 的可见文字后，document marker 和父组件 counter 保留。
- GSS 修改：literal 红色→蓝色，DOM exported class mapping 实际改变；document marker 和 counter 保留，且 counter 仍能从 1 点击到 2。
- 非法重复声明：真实 Vite overlay，保留蓝色、旧 class、counter=2 和 document marker；恢复源文件后 overlay 消失、红色和原 class 恢复，state／document 在本模板中仍保留。
- production：`tsc -b && vite build`、真实 `vite preview`；两份 GSS Module atomic，无 preserved output，单个 central GSS CSS link。
- 独立预期为手写 literal 色值／图像尺寸，不用 Compiler 输出生成样式期望。额外注入额外的 important 色值验证 canary 会破坏标题预期，移除后恢复；截图仅作运行证据，不宣称额外像素 oracle。

本模板的 React plugin 接受更新，因此本次没有 reload／state reset。**这不是新增 state-preserving HMR 的公共保证**；旧集成中 class-map 修改允许 reload 的契约和验收不变。

## 客户端路由验收（后续 owner 授权）

直接扩展同一 template fixture／gate，不另复制 harness。`App` 使用 `BrowserRouter`、`Routes`、`Route` 和 `Link`，Home 为 `/`，React.lazy Detail 为 `/details/:id`，以 `useParams` 展示 id；父级 counter、跨文件 `className: string` 仍保留。测试运行实际 Vite CLI dev 和 build 后的 preview，不用 memory router／模拟历史记录。

每个 dev／production 都检查：

- 初次 `/`、Link 到 `/details/42`、真实 `page.goBack()`／`goForward()`、Link 返回 Home：同时断言 URL、route heading、另一 route 已卸载、literal computed style／资源尺寸。
- Link、back／forward 保留 document marker 与父 counter=1，证明没有 document reload。Detail JS 导航前不请求、导航后请求；production 导航期间始终仅同一个 central GSS CSS link。
- 独立导航请求 `/details/99` 返回 HTTP 200 HTML，渲染参数 99、literal 绿色和 24×16 资源（解码 3×2）；真实 reload 再次通过。document marker 清空／counter=0，区分 document load 与客户端跳转。
- Home 资源为 30×20，Detail 资源为 24×16，均来自 GSS URL binding；颜色与尺寸均手写，不从 Compiler 输出生成预期。
- production route canary 注入错误的 important 色值，**同一个 route 校验函数必须抛断言错误**；移除后通过，另保留原标题 corruption control。
- 原有 React Refresh、GSS class-map 修改、invalid overlay／LKG／恢复、strict peer/frozen install、`tsc -b`、外部解析路径及 production lazy census 均继续通过。

本次记录 19 个成功的 routing checkpoints（dev 8、production 11）及原有六个生命周期 phases，没有新增产品修复或公共 API。

**部署边界**：BrowserRouter 深链接依赖 SPA host 将未命中的客户端路径 rewrite/fallback 到 `index.html`，并正确提供 assets。本次只证明 Vite dev 与实际 production `vite preview` 的 fallback；不证明 Netlify／任意 CDN／自定义服务器已配置正确。没有验证子目录 basename、SSR、请求时渲染、hydration、Data Router 或 Framework mode。

## 证据与失败保留

当前路由 gate 通过证据（完整版本／router engines+peers、原始模板、consumer sources/config、package／lockfile、命令日志、tarballs+SHA256、dist、production screenshot、19 个 routing checkpoints 与六个 lifecycle phases）：

`artifacts/vite-template/2026-10-26T06-45-04.945Z/`

此前无路由模板通过证据仍保留：`artifacts/vite-template/2026-10-25T08-01-37.969Z/`。路由扩展首轮即通过，没有失败记录被覆盖。

这些是本机 ignored artifacts，不发布包，也不是其他开发者的强制路径。`result.json` 记录外部工作目录和实际包解析路径，目录中的 tarballs 保持原始字节。新运行总是写独立时间目录，不覆盖旧失败。

保留的诊断运行：

- `2026-10-25T07-50-29.426Z`：测试错误地要求 GSS 修改必须 reload，实际 official plugin-react 发出 App.tsx HMR 并保留 state；更正的是不符合本次“观察行为”目标的测试假设，不是弱化样式／class mapping／LKG 检查。
- `2026-10-25T07-54-42.538Z`：dev 完成，production 因缺失 `implicitlyLoadedBefore` 失败；root fix 和回归之后通过。
- `2026-10-25T07-58-08.321Z`：第一次全路径通过；最终目录额外固定所有直接工具版本、保留相对 tarball 路径并强化映射／counter 检查。

基础验证：`corepack pnpm verify` 通过（Compiler 1539、React 49、Vite 151、Testing 334，共 2073）；Vite 7 原有 browser oracle 125 fixtures／1267 comparisons／38 controls 及宿主 checks 通过。

不纳入：`.gss` 删除、SSR／SWC、Firefox／WebKit 新模板验收、包发布、性能分析，以及通用 state-preserving HMR 保证。Declarative 客户端路由只有上述有界证据；其它模板／Router 模式／SSR 框架仍需要单独确定目标。
