# Rspack 集成内部模块

当前已提供 `gss({ adapter })` 与 `gssCssMinimizers(options)`，Rsbuild 通过薄封装接入。以下按职责说明内部实现；历史验证范围以文末及 docs/STATUS.md 最新记录为准。公共准备算法迁至 [integration-preparation](../shared/README.md)，本包保留原生宿主生命周期。

## 每轮输入契约

`createStylesheetPreparation` 每个 compilation 建立一次。宿主提供稳定的 Compiler 配置，以及已解析为规范 ID 的源码／资源引用；模块不负责 resolver、文件系统授权、资源 bytes 或 watch。相同规范 ID 的并发请求共享一次读取、一次局部编译及同一结果。失败也保留到本轮结束；修复在新 compilation 中读取，不能在同一候选内混用两代输入。

返回的输入快照复制并冻结资源引用。`module`、schema 与诊断是内部只读消费数据，不能被下游修改。局部准备不判断跨模块资源冲突，也不代表全局快照已成功；下一层汇总仍需重放本轮可达输入。默认配置由宿主在本轮保持稳定，不根据读取顺序调整。

`prepareSource` 通过 Adapter 发现原始 specifier，交给宿主解析，再用原始 specifier 查 schema。依赖解析成功后先登记 watch，随后准备输入；失败时不调用 transform，也不读取上一轮 schema。Compiler 诊断通过 `StylesheetPreparationError.diagnostics` 原样携带，loader 必须保留原始 id／range；IO、resolver 或 adapter 抛出的异常不伪装为 Compiler 诊断。

不支持的源码返回 undefined；支持但没有 `.gss` import 的源码返回空依赖和 null transformed，宿主可清除旧依赖。成功结果分开携带 stylesheet 与 adapter 诊断；宿主报告其中的 error 后不得发布 transform 代码。preserved fallback 成功和 GSS1104 warning 不是编译失败，不额外拒绝用户值。

## 验证与下一层

现有测试使用真实 Compiler 和 React Adapter，覆盖并发／跨轮输入、失败恢复、原始诊断、资产身份快照、preserved warning、别名和 no-import 路径。候选快照已实现，覆盖可达集合、全局冲突和导出一致性；后续是 Rspack loader／plugin 生命周期、CSS 后处理和 Rsbuild 封装。不新增 Compiler 公共接口。

## 候选快照

`prepareCandidateSnapshot` 只消费宿主从当前模块图得到的可达 ID（含 lazy），不枚举准备缓存或 loader 执行历史。去重、按规范 ID 排序后，将同一输入快照重放到独立 Compiler session。跨模块资源冲突在这里失败；局部模块导出必须与重放得到的完整 artifact 一致，否则拒绝该候选，防止 CSS 与已构建的 JS 使用不同输入或配置。

输入全集准备或重放失败时不返回部分结果，也不修改上一个候选。无输入返回空快照；减少可达输入会移除旧贡献，即使准备缓存仍持有它。宿主仍负责最终发布时机、资源 bytes、依赖集合替换和 LKG；本模块不把“候选成功”当成“构建已经发布”。生成资产 URL 通过既有 Compiler finalize resolver 传入，不新增身份或排序规则。

## Loader 与发布编排

`source-loader.ts` 是内部原生 loader。主 plugin 必须在每轮 NormalModule loader hook 注入 `createSourceLoaderPreparation`，与候选重放共享该轮 prepare；没有注入则明确失败。React 入口仍先解析／watch `.gss`，再取 schema 并转换。loader 应作为原始源码的 pre loader 使用，不承诺组合任意上游源码变换。没有转换时透传输入 map／附加数据；转换后使用 Adapter map，不能把旧 map 附到新代码。`.gss` JS 导出来自同轮 Compiler artifact，不假造源码映射。

Compiler／Adapter error 阻止代码交付；`SourceDiagnosticError.diagnostics` 原样保留 id／UTF-16 range，warning 交给原生 emitWarning，info 交给 logger。当前错误文本包含 code／原始 id，原生 overlay 的行列展示尚待正式宿主接入，不把数据保留等同于完整 UI 定位验收。IO／resolve 异常保持原错误，不额外判断 CSS 值是否合法。

`installPublication` 安装已获批准的 NoEmitOnErrorsPlugin，并区分 candidate、afterEmit 与 done。只有本轮确实经过 afterEmit、done 无任何编译错误且有候选时才推进 published；shouldEmit=false 即使没有错误也不推进。每轮候选以 Compilation 为键，结束后拒绝继续写入该轮。它不负责输出 CSS／HTML／runtime，也不代表 npm 包发布。

处理器 file／context／missing dependencies 登记到本轮 compilation；失败或未输出时保留此前恢复集合并合入本轮新发现项，成功时以本轮集合替换。不能在 compilation 的共享集合中删除旧值：其他 loader 可能也依赖同一文件。新 compilation 自有新集合，因此成功轮无需重新添加旧的 GSS 处理器依赖。宿主必须在处理器失败时也回传已发现依赖；fatal 编译器异常没有 done 时不会推进 published，但其 watcher 重启策略未验收。

真实 Rspack 测试覆盖晚期非 GSS 错误、shouldEmit=false、空候选恢复和三类依赖替换。现有两宿主 Chromium 探针已消费正式 loader／发布模块，仍为手动 HMR，不代表默认 dev server、Fast Refresh、完整资源或公开插件已完成。

## 主构建 CSS 接入

`installMainCompilation` 是内部编排，尚非公开插件。每轮安装独立 prepare，并向 source loader 注入；finishMake 从入口沿模块图收集静态／lazy 可达 GSS，生成同一全局候选，再通过 addEntry 向每个现有入口附加同一聚合 CSS。候选仍由原有 Compiler 决定排序、fallback 和模块导出。不按入口或 lazy chunk 拆分 GSS 语义。

内部 `.gss-internal/aggregate.css` 仅为原生 VirtualModulesPlugin 的内存路径，不创建用户文件，也不逐轮 writeModule。CSS/map 编码在内部 resource query 中，使每个请求自带不可变输入。pre loader 解码后交给宿主现有 CSS rules；不另起 compiler，不复制 PostCSS／Lightning CSS 配置，不自行 emit CSS／HTML／link runtime。source map 的 sources 转为项目根下绝对路径，原 Compiler map 不被修改。请求包含完整输入，可能较长；尚未做性能／请求体积优化，也不承诺任意自定义 resourceQuery／include／issuer 规则兼容。

不可改回“稳定请求 + 非缓存 loader 读取当轮共享 seed”：原生 CSS 后续构建可能在 finishMake 前重建旧模块，此时当轮候选尚不存在。不可用旧 CSS 冒充当轮成功；不可变请求让旧模块只能消费自己的输入，新候选从当前图重新汇总。CSS extract 内部会构造伪 JS 请求，Adapter pre rule 排除内部 carrier，避免 React 解析器处理 CSS。

当前回归使用真实 Rspack native CSS watch，覆盖两个入口、lazy 移除、非法输入保留／恢复、无 GSS 清空及 shorthand 源码覆盖；Rsbuild probe 覆盖原生 CSS extraction／PostCSS 文件依赖更新。公开配置、完整资源 IO、默认 dev server、任意 CSS 规则和最终 map 定位仍需后续验证。测试载入 dist 中真实 loader，运行本包测试前需要 build（根 verify 已按此顺序执行）。

主链不意味着处理器失败会自动保留全部 watch 依赖。PostCSS 在抛错前记录的 dependency message 可能未交给 loader；实测修复 token 文件不触发重建。`afterCompile` 只读取**本轮精确 aggregate request** 对应模块的 buildInfo 依赖，交给既有 publication 状态保留／替换；不扫描全部历史模块，也不复制其他 JS 模块依赖。首次成功建立依赖后，即使失败处理器没返回消息，修复仍可触发；首次构建从未发现的隐藏依赖无法凭空推断。回归覆盖失败后同输入恢复，以及空 CSS 成功后旧 token 依赖移除。


## GSS CSS 局部隔离

`css-isolation.ts` 是内部主链桥接，与 `installMainCompilation` 配对使用。调用者先把宿主有效 minimizer options 交给 `isolatedCssMinimizers`，再安装 `installCssIsolation`，最后接主构建。仅 GSS 聚合 resource 的 builtin Lightning CSS loader 和 gss-l CSS 资产的 minimizer 禁止 logical lowering，其他选项原样继承；不从 targets 推导第二份配置，也不修改 Compiler fallback。

必须同时处理 loader 和 minimizer，否则生产会再次降级并增加逻辑 atom 的 selector 权重。原生 splitChunks 使用带 gss-l 名的资产；纯 hash 文件名明确失败。当前内部桥接仅消费一份已选定有效 minimizer 配置，不承诺任意多实例／自定义处理器。公开宿主桥接应在配置阶段完成，不能反射读取 plugin 私有参数。

CSS 分包会改变默认 HTML link 顺序，因此用宿主 hook 调用 `orderGssStylesheets`，保持普通 CSS 在前、全局 GSS 在后；Rsbuild 须接自己的 modifyHTMLTags，原生 HtmlRspackPlugin hook 不替代它。保留非 stylesheet 标签槽位及所有属性。不能靠重复 class 或额外 specificity 修补顺序，也不生成私有 HMR runtime。实现、独立预期、失败证据及有限浏览器范围见 [架构记录](../../docs/ARCHITECTURE-DIRECTION.md#gss-css-局部隔离实施2026-11-02)。


## 原生 CSS minimizer 辅助函数

Owner 已确认并导出 `gssCssMinimizers(options)`：用 `...gssCssMinimizers(cssOptions)` 替代原来的 `new LightningCssMinimizerRspackPlugin(cssOptions)`。它返回两个原生插件，使用同一份宿主 options；GSS 分支仅覆盖逻辑属性开关，普通分支沿用原条件并排除 GSS 资产。JS minimizer 不由此函数管理。支持版本目前固定为已验证的 Rspack 2.3.0；未发布 npm 包。

```ts
import { gssCssMinimizers } from '@gss-l/rspack';
// optimization.minimizer 中替换原 CSS minimizer，其余 JS minimizer 保持原配置：
const cssMinimizers = gssCssMinimizers({ minimizerOptions: { targets: ['safari >= 9'] } });
```

该 helper 负责 CSS 压缩隔离；公开 `gss({ adapter })` 负责主构建与资源 IO，二者配对使用。Rsbuild 配置桥接在 `integrations/rsbuild` 自动读取有效 options；用户无需手配此 helper。internal 子路径只供配套 workspace 使用。

**静态规则必须保持静态。** 不要把所有 `rule.use` 包装成回调来按 resource 修改 options。Rsbuild 提取 CSS 的子请求使用原生 builtin options ident；动态注册迟于初始 references 表，可能丢失 ordinary CSS 的 targets 和前缀，而压缩器会掩盖错误。当前使用原生 resource/oneOf 分支隔离 GSS；静态 options 在初始化时登记，原有 rules／oneOf 和 ordinary use 保留。新增未压缩的普通 CSS 与纯宿主构建逐字对照，修复前失败、修复后通过。用户原有动态 use 保持动态；不承诺任意动态 loader 与 extraction 的组合。


## 公开主构建入口与资源 IO

`gss({ adapter })` 已导出，组合既有局部隔离、main-compilation 与 publication；projectRoot 使用 compiler.context，无 targets 选项。React 用法和显式 adapter 不变。

```ts
import { gss, gssCssMinimizers } from '@gss-l/rspack';
import { react } from '@gss-l/react';
// 合入现有 React/SWC、CSS rules 和 HTML 配置：
// plugins: [...existingPlugins, gss({ adapter: react() })],
// optimization: { minimizer: [...existingJsMinimizers, ...gssCssMinimizers(cssOptions)] }
```

`stylesheet-io.ts` 从宿主 inputFileSystem 读取源码，通过已有 Compiler discovery 找 URL；相对 URL 由原生 resolver（preferRelative／url 依赖类型）相对原 stylesheet 解析，登记 file/context/missing 依赖。身份包含项目相对文件名及 query/fragment；finalize 输出原生 CSS 链可读取的绝对资源请求。资源 bytes、hash、emission、publicPath 与更新由主链处理，不另建资源服务器或 emitAsset。根路径 URL、remote/data 与单独 fragment 不受聚合目录影响，原样交给宿主；不复制 Vite 的 publicDir 读取策略，不承诺任意自定义 URL filter／预处理器。

每轮 read 接收本轮 compilation，避免把依赖登记到旧轮；已有只接收 id 的内部调用仍兼容。CSS 解析失败仍交给原 Compiler 诊断，不用 IO 错误替换它。已验证嵌套目录图片、#fragment、生产 hash／真实资源文件，以及默认 Rsbuild dev server 的图片 bytes 更新和 GSS 错误恢复。根路径/publicDir、自定义 resolver 组合、完整资源语法与 workspace 外消费尚未形成完整验收，不据此宣称全部资源支持。

默认提取 CSS／带 gss-l chunk 名的文件名是当前验证范围；自定义多 minimizer、纯 hash 文件名、style 注入、SSR／库构建没有升级为保证。包未发布；TypeScript 使用 `@gss-l/types/client`，无需引用 Vite client。


TypeScript 项目直接依赖 `@gss-l/types`，在环境声明文件中使用 `/// <reference types="@gss-l/types/client" />`，或在 tsconfig 的 types 中加入该入口。它仅声明 `.gss`，不提供 Vite 虚拟 URL。现有 scope 类型、字符串用法与动态路径边界不变；声明不会执行任何运行时加载。


2026-11-04 已通过已选版本的 workspace 外 tarball 消费；类型、生产双入口及浏览器范围、Rsbuild 开发更新证据见 [消费报告](../../docs/RSPACK-RSBUILD-CONSUMPTION.md)。此记录覆盖此前外部消费待验项的有限范围，不扩大自定义配置或资源语法保证。


### 资源路径的解码边界

已解析文件路径是文件系统数据，不是可直接重新解释的 URL。`image%20%2520.svg` 指向字面文件 `image %20.svg`；finalize 把原路径直接写进 CSS，会被宿主再次解码成另一个文件 `image  .svg`。`stylesheetAssetUrl` 现在仅将已解析路径中的 `%` 转回 `%25`，再拼接原 query/fragment；资源 identity 与 Compiler 不变。不要对完整 URL（含 suffix）再次 decode/encode，也不要在 Compiler 内处理宿主文件路径。

两个宿主回归均放入内容不同的空格文件，防止成功构建却引用错图；Rsbuild 还与普通 CSS 独立构建比较。此修复不改变宿主输出文件名规则。Rsbuild 默认 SVG 文件名含字面百分号时，普通 CSS 的最终 URL 也存在歧义；针对本反例的 HTTP/HMR 验证使用宿主现有 `output.filename.svg: '[contenthash].svg'`。原生 Rspack 测试配置的最终 fragment 行为也遵循其普通 CSS 输出，不用 GSS 补写另一套规则。证据见 `artifacts/asset-url-boundary/`。
