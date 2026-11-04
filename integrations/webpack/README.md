# webpack 内部宿主接线

此包没有公开 exports，不可作为已交付的 `@gss-l/webpack` 插件使用。当前实现限定 webpack 5.112.2；React 分析由显式 Adapter 提供，公共准备来自 `@gss-l/integration-preparation`。不引入独立 compiler，不修改排序、fallback 或 targets。

## 调用边界

`main-compilation` 在 thisCompilation 建立稳定输入批次并注入 source loader；finishMake 从真实模块图得到可达集合，调用公共 prepareCandidateSnapshot，通过原生 addEntry 把同一不可变 CSS/map payload 交给各入口。webpack-virtual-modules 只承载内存 CSS 路径。loader、resolver、moduleGraph、发布和处理器依赖均留在本包；公共准备不认识 webpack。

`source-loader` 使用 webpack 的 LoaderContext/LoaderDefinition；原始 JSX 交给 React Adapter，Compiler/Adapter 诊断保留范围。`stylesheet-io` 使用宿主 input filesystem/resolver，保留已确认的百分号交接规则；CSS 链负责资源 bytes/hash。`publication` 使用原生 NoEmitOnErrorsPlugin，仅成功输出后推进 published，失败保留上一版及恢复依赖。类型看似相近不能复用 Rspack 编排：webpack EntryPlugin.createDependency 需要 options，loader context 泛型也不同。

## 已复现的依赖差异

webpack 成功构建后将 buildInfo.file/context/missingDependencies 移到 filesystem snapshot。照搬 Rspack 的 buildInfo 读取会漏掉此前成功的处理器依赖：处理器在登记 token.txt 前抛错，随后修复 token 文件不再触发恢复。

本包对本轮**精确 aggregate request** 对应的模块调用原生 `module.addCacheDependencies`，由 webpack 统一读取 snapshot 或失败构建的 buildInfo，再交给 publication 保留/替换。不得扫描全部历史聚合模块或将其他 JS 依赖并入 GSS 专属恢复集合。成功空候选应移除旧处理器依赖。该差异是保留独立宿主接线的实证，不为此向公共准备增加 webpack 分支。

## 验证与边界

`test/main-compilation.test.ts` 使用真实 webpack + MiniCssExtractPlugin 2.10.2 + css-loader 7.1.5 watch，覆盖双入口、lazy 移除、GSS 失败/恢复、处理器失败/依赖文件修复、无 GSS 清空和旧依赖移除，保留 `margin-left` 在未展开 `margin: var()` 前被覆盖的断言。测试读取实际输出文件，避免成功构建后 SizeOnlySource 不再包含源码的问题。

测试使用 realpath 规范化后的项目 context。首次临时目录的 /var→/private/var 别名导致虚拟 CSS 在 extraction 内部重解析时找不到；该失败保留，不宣称任意 symlink context 支持。未通过创建实体 carrier 绕过虚拟文件，也未扩大资源 grammar。

现有 Chromium 实验改为直接消费本包 dist；双入口生产、CSS 顺序、资源、原生 accept 更新与错误恢复通过。CSS 分包、HTML 排序与 GSS-only Lightning 排除仍由实验配置负责，**尚未形成正式配置桥接或公共 helper**。原生 accept 不等于 React Fast Refresh/state 保持。开发稳定 CSS 文件名、生产 contenthash 的已验证边界仍在。

证据在 `artifacts/host-preparation-boundary/`：最初类型/虚拟路径/SizeOnlySource/处理器恢复失败以及后续通过均保留。完整验证见 STATUS 最新记录。无 SSR/style-loader/Module Federation/CRA、新 UI 框架或发布扩展。

## 下一步公共入口草案（未实现，待 owner 决策）

建议沿用现有宿主的使用形式 `gss({ adapter: react() })`，只覆盖已验证的 MiniCssExtractPlugin + HtmlWebpackPlugin 配置；插件负责主构建、GSS splitChunks 与 HTML 顺序。宿主自己的 JSX/SWC、CSS loader 和 extraction 配置保留。

CSS 压缩建议提供 webpack 专属 `gssCssMinimizers(options)`，替代一个 CssMinimizerPlugin 的构造；限定 Lightning CSS minify，沿用同一份 options/targets 分成普通与 GSS 两支，只有 GSS 关闭逻辑降级。不接受 Rspack 原生 minimizer options 冒充 webpack options，不额外提供 Compiler targets。开发 CSS 文件名需稳定；后置 loader 不能再次降低 GSS 逻辑属性，任意自定义处理器不在首版保证内。

正式 API 若获确认，先实现/回归配置桥接，再打开 exports 和核对外部打包。无需用户提前选择内部共享算法，也不默认引入 Fast Refresh 配置或替换宿主浏览器 runtime。
