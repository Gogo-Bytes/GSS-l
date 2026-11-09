# webpack 内部宿主接线

Owner 已确认并接通公开 `gss({ adapter })` 与 `gssCssMinimizers(options)`，未发布 npm 包。当前实现限定 webpack 5.112.2；React 分析由显式 Adapter 提供，公共准备来自 `@gss-l/integration-preparation`。不引入独立 compiler，不修改排序、fallback 或 targets。

## 调用边界

`main-compilation` 在 thisCompilation 建立稳定输入批次并注入 source loader；finishMake 从真实模块图得到可达集合，调用公共 prepareCandidateSnapshot，通过原生 addEntry 把同一不可变 CSS/map payload 交给各入口。webpack-virtual-modules 只承载内存 CSS 路径。loader、resolver、moduleGraph、发布和处理器依赖均留在本包；公共准备不认识 webpack。

`source-loader` 使用 webpack 的 LoaderContext/LoaderDefinition；原始 JSX 交给 React Adapter，Compiler/Adapter 诊断保留范围。`stylesheet-io` 使用宿主 input filesystem/resolver，保留已确认的百分号交接规则；CSS 链负责资源 bytes/hash。`publication` 使用原生 NoEmitOnErrorsPlugin，仅成功输出后推进 published，失败保留上一版及恢复依赖。类型看似相近不能复用 Rspack 编排：webpack EntryPlugin.createDependency 需要 options，loader context 泛型也不同。

对于 JSX 导入的 `.gss` 编译失败，有可靠范围时终端错误包含 CSS 文件、从 1 开始的行列和首行代码框。位置只从该次失败的不可变输入快照及匹配 id 的合法 UTF-16 range 计算；缺少或无效的范围只显示原诊断，不读取新磁盘内容猜测位置。代码框限长，多行范围只展示起始行；webpack 外层仍可能标记 JSX importer。该目标不承诺 overlay 高亮、编辑器跳转或 React 诊断定位。Rspack／Rsbuild 的范围见[其接线说明](../rspack/README.md#loader-与发布编排)。

## 已复现的依赖差异

webpack 成功构建后将 buildInfo.file/context/missingDependencies 移到 filesystem snapshot。照搬 Rspack 的 buildInfo 读取会漏掉此前成功的处理器依赖：处理器在登记 token.txt 前抛错，随后修复 token 文件不再触发恢复。

本包对本轮**精确 aggregate request** 对应的模块调用原生 `module.addCacheDependencies`，由 webpack 统一读取 snapshot 或失败构建的 buildInfo，再交给 publication 保留/替换。不得扫描全部历史聚合模块或将其他 JS 依赖并入 GSS 专属恢复集合。成功空候选应移除旧处理器依赖。该差异是保留独立宿主接线的实证，不为此向公共准备增加 webpack 分支。

## 验证与边界

`test/main-compilation.test.ts` 使用真实 webpack + MiniCssExtractPlugin 2.10.2 + css-loader 7.1.5 watch，覆盖双入口、lazy 移除、GSS 失败/恢复、处理器失败/依赖文件修复、无 GSS 清空和旧依赖移除，保留 `margin-left` 在未展开 `margin: var()` 前被覆盖的断言。测试读取实际输出文件，避免成功构建后 SizeOnlySource 不再包含源码的问题。

首次临时目录的 /var→/private/var 别名导致虚拟 CSS 在 extraction 内部重解析时找不到，原失败保留。2026-11-04 已复现并修复稳定目录符号链接：原生 CSS 成功而 GSS 失败，原因是虚拟 carrier 仅登记别名路径，提取器再次解析后请求真实路径。现在 beforeRun/watchRun 通过宿主 inputFileSystem.realpath 解析内部 carrier 根目录，只登记一次空虚拟文件；payload 仍在每个不可变 query 中，不逐轮写 CSS seed。loader 匹配与 CSS 分组读取同一个解析后 carrier 路径。不改 compiler.context、全局 resolve.symlinks、Compiler projectRoot 或模块/资源身份。宿主没有 realpath 能力时保留其 context，不改用 Node 原生 FS 绕过宿主。

生产回归以同一真实目录与显式符号链接分别运行，普通 CSS 对照先成功，再核对 GSS 输出和 HTML 顺序；原有完整 watch 回归改为从别名 context 启动，覆盖 lazy 移除、错误恢复及处理器依赖清理。未创建实体 carrier；构建进程中重定向符号链接或任意自定义虚拟 FS 仍未验证，不能外推为所有 symlink 行为支持。

现有 Chromium 实验改为直接消费本包 dist；双入口生产、CSS 顺序、资源、原生 accept 更新与错误恢复通过。CSS 分包、HTML 排序由公开插件接管，GSS-only Lightning 排除由公开 helper 接管；探针已移除原来的手工接线。原生 accept 不等于 React Fast Refresh/state 保持。开发稳定 CSS 文件名、生产 contenthash 的已验证边界仍在。

证据在 `artifacts/host-preparation-boundary/`：最初类型/虚拟路径/SizeOnlySource/处理器恢复失败以及后续通过均保留。完整验证见 STATUS 最新记录。无 SSR/style-loader/Module Federation/CRA、新 UI 框架或发布扩展。

## 公开配置（owner 已确认）

使用现有 React/SWC、CSS loader/extraction 与 HTML 配置。插件负责主构建、GSS splitChunks 和 HTML stylesheet 顺序；helper 替换一个 Lightning CSS minimizer，不替换 JS minimizer。TypeScript 使用通用 `@gss-l/types/client`。

```ts
import { gss, gssCssMinimizers } from '@gss-l/webpack';
import { react } from '@gss-l/react';
import { browserslistToTargets } from 'lightningcss';

// 同一份宿主配置；如果已有 cssOptions，直接传入，不另填 targets。
const cssOptions = { minimizerOptions: { targets: browserslistToTargets(['defaults']) } };
// 现有配置中：
// plugins: [...existingPlugins, gss({ adapter: react() })],
// optimization: { minimizer: ['...', ...gssCssMinimizers(cssOptions)] }
```

首版已验证 MiniCssExtractPlugin 2.10.2 + css-loader 7.1.5 + HtmlWebpackPlugin 5.6.8，CssMinimizerPlugin 8.0.0 + Lightning CSS 1.33.0。默认 helper 选择 Lightning CSS；若 options.minify 已填写，必须是 CssMinimizerPlugin.lightningCssMinify，不支持其他 minifier/数组。GssCssMinimizerOptions 使用 webpack 插件配置与 Lightning TransformOptions，而非 Rspack options。GSS 分支清除 LogicalProperties include 位并增加 exclude 位，其余值不变；普通分支保留宿主配置并排除 GSS 资产，传入对象不变。Plugin 8 的 runtime schema 支持 exclude 数组但声明仅列单 Rule，内部依据实际 schema 合并排除条件。

**HtmlWebpackPlugin 必须使用同一 peer 实例。** 其 hooks 位于包内 WeakMap，两份物理安装副本的 getHooks 不互通。插件将它声明为精确版本 peer + devDependency，不私自安装第二套宿主 HTML hooks。外部消费者应直接安装该 peer；自定义依赖隔离产生双副本不在保证内。

开发使用稳定的 `[name].css`，生产可 `[name].[contenthash].css`；必须保留 gss-l chunk 名（纯 hash 文件名会报错）。自定义已有 gss-l cacheGroup 明确冲突，原 splitChunks=false 不应开启默认 JS 分包。普通 CSS 原有规则不修改。后置 loader 不得再降低 GSS 逻辑属性；任意自定义 PostCSS/Lightning loader、多 minimizer、运行中重定向 symlink 和 Fast Refresh/state 保持仍未形成保证。

公开回归 `public-entry.test.ts` 使用相同配置的独立纯宿主构建逐字对照普通 CSS；检查 GSS 逻辑属性保留、物理属性保留、双入口 HTML 顺序和 options 不被修改。原有 watch 回归继续覆盖处理器恢复与清空。公开浏览器检查只看页面/原生错误状态，不添加读取内部 publication 的公共 API。

本轮证据 `artifacts/webpack-public/`：首次类型声明修正见 build.log；实验两份 HTML plugin 的排序失败见 production.log/dev.log，修正 peer/单实例后见 production-peer.log/dev-peer.log。外部 tarball 消费见 external.log 与 external-path.txt，完整 verify 见 verify-delivery.log。失败证据保留，不将默认整页刷新或未验证组合描述成全部支持。

外部消费在系统临时目录安装 types/compiler/react/integration-preparation/webpack 五个本地 tarball 和固定宿主依赖；strict NodeNext 类型检查不开 skipLibCheck，双入口 production 页面与 dev 原生 accept 更新、普通 CSS 更新顺序、SVG bytes 更新、错误 overlay/保留/同输入恢复通过。`external-types.log` 为类型检查退出 0 的空日志，`external-dev.log` 记录实际开发 phases。未验证 React 组件 state 保持，不发布包或 tag。完整 verify 2568 项通过。

稳定符号链接目录修复证据：`artifacts/webpack-linked-context/red.log` 为原生成功/GSS 失败，`green.log`/`watch.log` 为修复后生产与 watch，浏览器与完整 verify 见同目录。本轮仅修复内部 carrier 路径，既有排序、fallback 和稳定开发 CSS 文件名契约不变。
