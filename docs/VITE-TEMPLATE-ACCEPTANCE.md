# 官方 create-vite React TS 外部消费验收

## 结论与范围

owner 选择官方 React + TypeScript 模板，并授权 Vite 8 实验。已通过 **Chromium 145.0.7632.6** 的有界 install／类型／dev／production 用户路径；不是全部 Vite 8 版本、浏览器、框架或所有 HMR 形状的兼容证明。现有 workspace 仍使用 Vite 7，不升级 lockfile 中的 Vite，不修改旧 gate 的引擎范围。

真实外部消费暴露一个宿主缺陷：Rolldown 的 ModuleInfo 没有 Rollup 的 `implicitlyLoadedBefore`，production census 展开 undefined 导致构建失败。现在只对这个可缺失字段使用空数组，保留 static／lazy 遍历和 Rollup implicit edges；`production-census.test.ts` 分别覆盖字段存在／缺失、循环、external 和 unreachable。完成外部 tarball 验证后，将 `@gss-l/vite` peer 扩展为 `^7.0.0 || ^8.0.0`。

## 运行与版本

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm vite-template:check
```

新 gate 位于 `packages/testing/acceptance/vite-template/check.mjs`，只运行 Chromium；使用仓库已安装的 Playwright，不增加依赖。端口为 5196，要求空闲。需要 npm registry 网络访问和已安装的 Playwright Chromium。

- 官方入口：https://vite.dev/guide/；官方支持 `react-ts` template，Node 要求 20.19+／22.12+，命令为 `vite`／`vite build`／`vite preview`。
- 实际生成：`npm exec --yes --package=create-vite@9.3.1 -- create-vite app --template react-ts --no-interactive`。
- 环境：Node 22.22.3、pnpm 8.6.2。
- 固定工具链：Vite 8.3.5、`@vitejs/plugin-react` 6.1.2、React／React DOM 19.3.1、TypeScript 6.0.3；@types/node 24.19.2、@types/react／react-dom 19.3.0、oxlint 1.88.0。
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

## 断言与观察

- dev 和实际 production preview：标题 literal 色值、primitive GSS class、背景资源的 3×2 解码尺寸与 30×20 布局、计数器交互。
- lazy：首次不请求 Detail JS，点击后请求并渲染，literal 绿色；production 初始 central CSS census 已包含 Detail.gss，不是 lazy CSS。
- React Refresh：修改 Child.tsx 的可见文字后，document marker 和父组件 counter 保留。
- GSS 修改：literal 红色→蓝色，DOM exported class mapping 实际改变；document marker 和 counter 保留，且 counter 仍能从 1 点击到 2。
- 非法重复声明：真实 Vite overlay，保留蓝色、旧 class、counter=2 和 document marker；恢复源文件后 overlay 消失、红色和原 class 恢复，state／document 在本模板中仍保留。
- production：`tsc -b && vite build`、真实 `vite preview`；两份 GSS Module atomic，无 preserved output，单个 central GSS CSS link。
- 独立预期为手写 literal 色值／图像尺寸，不用 Compiler 输出生成样式期望。额外注入额外的 important 色值验证 canary 会破坏标题预期，移除后恢复；截图仅作运行证据，不宣称额外像素 oracle。

本模板的 React plugin 接受更新，因此本次没有 reload／state reset。**这不是新增 state-preserving HMR 的公共保证**；旧集成中 class-map 修改允许 reload 的契约和验收不变。

## 证据与失败保留

通过的完整版本、原始模板、consumer sources/config、package／lockfile、命令日志、tarballs+SHA256、dist、production screenshot、六个 phase 记录：

`artifacts/vite-template/2026-10-25T08-01-37.969Z/`

这些是本机 ignored artifacts，不发布包，也不是其他开发者的强制路径。`result.json` 记录外部工作目录和实际包解析路径，目录中的 tarballs 保持原始字节。新运行总是写独立时间目录，不覆盖旧失败。

保留的诊断运行：

- `2026-10-25T07-50-29.426Z`：测试错误地要求 GSS 修改必须 reload，实际 official plugin-react 发出 App.tsx HMR 并保留 state；更正的是不符合本次“观察行为”目标的测试假设，不是弱化样式／class mapping／LKG 检查。
- `2026-10-25T07-54-42.538Z`：dev 完成，production 因缺失 `implicitlyLoadedBefore` 失败；root fix 和回归之后通过。
- `2026-10-25T07-58-08.321Z`：第一次全路径通过；最终目录额外固定所有直接工具版本、保留相对 tarball 路径并强化映射／counter 检查。

基础验证：`corepack pnpm verify` 通过（Compiler 1539、React 49、Vite 151、Testing 334，共 2073）；Vite 7 原有 browser oracle 125 fixtures／1267 comparisons／38 controls 及宿主 checks 通过。

不纳入：`.gss` 删除、router／SSR／SWC、Firefox／WebKit 新模板验收、包发布、性能分析，以及通用 state-preserving HMR 保证。下一种模板／真实路由／SSR 框架仍需要单独确定目标。
