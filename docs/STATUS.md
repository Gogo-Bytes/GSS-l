# GSS 工作状态

## 当前摘要（2026-11-01）

本次整理基线 `51c12a4` 已推送 main。已批准的 border-width 展开、隔离物理 longhand 复用、同条件链纯 atom 复用均已交付，无待提交实现。顶层目录、selector 节点、编译阶段拆分和排序分离的阶段目标已落地；更宽 CSS／关系／框架支持不因此获得保证。

最近浏览器验证基线：`9216360` 的完整 verify **2537 项**及默认三引擎排序验收、独立 Chromium browser oracle 125／1267／38 与宿主检查通过。`51c12a4` 仅修正身份编码注释；2026-10-31 的进度整理未产生新运行证据；2026-11-01 的等价重构验证另列下方。

CSS 能力接入流程与策略归属核对已按 owner 授权完成，形成三个代表属性的接入路径、文件级清单、重复项与保留项结论。GSS1206 的同轴冲突列表已集中生成，保持原白名单及诊断顺序；完整 verify 2537 项、7344 组 validator 与 14 次完整公共编译／恢复对照通过，证据在 `artifacts/css-capability-workflow/`。本轮没有新增能力或浏览器运行；详细结论见 [当前计划](NEXT-STAGE.md#已完成css-能力接入流程与策略归属)。

## 当前目标：React 多构建工具接入

2026-11-04 已修复 webpack 稳定符号链接项目目录下的虚拟 CSS 路径错误：原生 CSS 对照成功而 GSS 失败，现由宿主 FS 解析并登记 carrier 真实路径；不改用户 context、模块身份、排序或 fallback。真实/别名生产对照与别名目录完整 watch 回归、完整 verify 2569 项及 lint/build/types、现有 Chromium 生产/开发更新与错误恢复均通过；详细边界见 [webpack 模块说明](../integrations/webpack/README.md)，证据 `artifacts/webpack-linked-context/`。Parcel 继续暂缓。

2026-11-04 owner 已决定**暂缓 Parcel，保持现有宿主维护**。Parcel 只读调查保留为参考，实验不再待确认，也不安装或实施。当前范围为 Vite、Rspack／Rsbuild、webpack 的既有能力维护及已复现契约问题修复；未验证组合不自动成为任务，不从历史路线图启动新宿主、框架或验收矩阵。排序、fallback、React 作者用法与单份宿主 targets 契约不变。恢复 Parcel 需新的 owner 指令。下方历史“下一步／待决”不覆盖本项最新决定。

2026-11-04 已修正公共准备包误复制的 CSS 隔离子路径导出：原目标 JS/d.ts 不存在，且不属于共享职责；保留真正的 Rspack 内部隔离入口。八个产品包实际 tarball 的 20 个 exports 目标全部存在，公共准备 20 项测试通过，证据 `artifacts/package-boundary-audit/`。下一项依照 React 生态规划做 Parcel 接入的只读可行性核对；不安装/实施新宿主或扩大框架矩阵，形成具体方案后再决策。

2026-11-04 owner 已批准并接通 webpack 公开 `gss({ adapter })` / `gssCssMinimizers(options)`，API 不再待决。宿主同一份 targets，GSS-only 逻辑属性排除，普通 CSS 与独立纯宿主逐字对照；HtmlWebpackPlugin 以同一 peer 实例连接 hooks。使用说明与限制见 [webpack 模块文档](../integrations/webpack/README.md)。完整 verify 2568 项及 lint/build/types、公开配置 Chromium 生产/开发、workspace 外五包 tarball 的 strict TypeScript 配置/生产双入口/开发更新与错误恢复均通过。证据在 `artifacts/webpack-public/`；不改变排序/fallback，不发布包，不自动启动新框架或矩阵。

2026-11-04 已继续实现 webpack 的内部 TypeScript loader/主编译/发布/资源 IO，公开 exports 仍为空。完整 verify 2567 项及 lint/build/types、消费正式 dist 的 Chromium 双入口生产与原生 accept 更新/恢复通过（`artifacts/host-preparation-boundary/verify-webpack-delivery.log`、`webpack-internal-*.log`）。真实 watch 发现 webpack 将处理器依赖移入 filesystem snapshot，已用原生 addCacheDependencies 修复失败后的依赖恢复；该适配仅留在 webpack。详见 [模块契约、验证与公共入口草案](../integrations/webpack/README.md)。下一待决是首版公开插件及 webpack 专属 minimizer helper 的配置形式，不是重新讨论共享层或排序。

2026-11-04 已按 owner 最新方向核对宿主/公共准备边界，并将两个准备模块及既有测试迁入内部 `integrations/shared` 包；宿主仍负责批次失效、模块图、发布、CSS 链和更新。详细契约与反例见 [公共准备说明](../integrations/shared/README.md)，不是所有宿主必经层，不改排序或 fallback。完整 verify 2566 项及 lint/build/types、webpack 双入口生产/原生 accept 更新恢复、workspace 外四包 tarball 的依赖解析与准备调用均通过，见 `artifacts/host-preparation-boundary/`；正式 webpack 内部实现为下一步，公开 API 尚未确定。此段替代下方“共享边界待决”的历史状态。

2026-11-04 owner 已批准并完成 webpack 5 最小接入实验，见 [实验报告与下一阶段建议](WEBPACK-EXPERIMENT.md)。主构建生产双入口、CSS 顺序、资源、开发更新、错误保留／恢复和 lazy 候选移除通过；默认示例会自动整页刷新，另以原生 accept 验证无整页刷新更新，不承诺 Fast Refresh/state 保持。开发 hash CSS 文件名失败证据保留，稳定文件名通过。产品代码未变，尚无公开 webpack 包；下一待决是内部 webpack 集成 + 仅两个纯准备模块的共享层，不是再次批准实验。排序、fallback 与 targets 配置不变。下方为历史记录，以本段和实验报告为最新状态。

2026-11-04 已修复相对资源路径的重复百分号解码：保持 identity 与 suffix，在交给宿主 CSS 链前转义已解析路径中的 `%`。两个宿主的错误目标文件回归、完整 verify 2566 项及 Chromium 资源／CSS 更新和错误恢复通过；宿主自身的特殊输出文件名限制独立保留。见 [资源交接记录](ARCHITECTURE-DIRECTION.md#资源路径交接修复与下一阶段2026-11-04)。接下来按整体 React 规划只调查 webpack 5 复用成本；新集成实施／架构变化仍须具体方案决策。

2026-11-04 已完成 Rsbuild／Rspack 的 workspace 外五包 tarball 消费核对：公开配置与 React TSX 类型检查、两个宿主生产构建及四个 Chromium 页面通过；外部 Rsbuild 默认 HMR、资源 bytes 更新、错误保留／恢复通过。无新产品缺陷，产品代码未变；首次样例触发既有 scope coercion 诊断的证据已保留。完整范围、版本、恢复命令见 [外部消费报告](RSPACK-RSBUILD-CONSUMPTION.md)。本轮有限消费目标完成，未发布包；未验证组合不自动成为下一任务，后续由具体需求或可复现问题驱动。

2026-11-04 owner 已确认并实现通用 `@gss-l/types/client`，Vite 原入口兼容且继续提供其虚拟模块；新宿主不依赖 Vite 声明。完整 verify 2566 项及 lint/build/types 通过，workspace 外 types tarball 的 NodeNext／Bundler 类型消费通过。详见 [通用类型入口](ARCHITECTURE-DIRECTION.md#通用-typescript-client-入口2026-11-04)，证据 `artifacts/common-client/`。类型入口不再待决；完整新宿主外部应用消费仍待核对，未发布包。

2026-11-02 owner 已批准 GSS CSS 局部隔离，内部实现与验证已完成：仅聚合 GSS 的原生 Lightning CSS loader／minimizer 排除 logicalProperties，普通 CSS 保持宿主处理；不新增 targets，不改 Compiler 排序或 fallback。原生 splitChunks 共用 GSS 资产，HTML hook 保持普通 CSS 在前、聚合 GSS 在后。两个真实 HTML 入口及默认 Rsbuild React HMR（含普通 CSS 更新、错误保留／恢复）通过；完整 verify **2563** 项及 lint/build/types 通过。详见 [实施记录](ARCHITECTURE-DIRECTION.md#gss-css-局部隔离实施2026-11-02)，证据在 `artifacts/gss-css-isolation/`。仍是内部模块，公开入口／自动资源 IO 尚未交付；下一项连接宿主的有效 minimizer 配置与 Rsbuild 薄封装，不要求用户重复 targets。

2026-11-02 已继续接通公开 `gss({ adapter })`／`pluginGss({ adapter })` 与基础相对资源 IO：宿主 resolver／input filesystem 负责输入，主 CSS 链负责资源输出和更新，无重复 targets。完整 verify **2566** 项及 lint/build/types 通过；公开入口的双 HTML、默认 React HMR、SVG bytes 更新及错误恢复通过（`artifacts/minimizer-entry/public-*`）。详见 [入口与资源记录](ARCHITECTURE-DIRECTION.md#公开插件组合与基础资源-io2026-11-02)。尚未做 workspace 外 tarball／完整资源组合验收，未发布包。下一待决是通用 `*.gss` 声明使用 `@gss-l/types/client`，或各宿主独立 client 入口；不要要求新宿主引用 Vite 专属声明。

2026-11-02 owner 已确认原生 minimizer 辅助函数。`@gss-l/rspack` 已导出 `gssCssMinimizers(options)`；新增 Rsbuild 内部薄桥接自动继承宿主有效配置。修复静态 loader 被回调化后 ordinary CSS options 丢失的问题，压缩开／关均与独立纯宿主输出逐字一致。完整 verify **2566** 项及 lint/build/types、正式桥接的双入口 Chromium 页面／默认 React HMR 通过。详见 [实施记录](ARCHITECTURE-DIRECTION.md#minimizer-辅助函数与-rsbuild-桥接实施2026-11-02)，证据 `artifacts/minimizer-entry/`。公开 `gss`／`pluginGss` 和自动资源 IO 尚未交付；继续接通，不再询问 helper API，不新增 targets 或改 fallback。


2026-11-02 owner 已明确暂不新增 targets 配置，先验证宿主后置兼容语义。[核对结果](ARCHITECTURE-DIRECTION.md#宿主后置兼容转换的语义核对2026-11-02)：真实 Rsbuild 生产链将逻辑／物理 margin 的 GSS 预期 2px 改为 1px（selector 权重增加）；直接 authored CSS 也受影响，旧 GSS 路径是拒绝而非 preserved 修复。另一方面，33 行主探针中的其余 29 行、独立 68 次 flex／align／复用比较及 4 个资源输出检查未证明不同属性名 fallback 必要。既有 compatibility 30 项通过。无产品修改，原“显式 targets／限制配置二选一”暂停；下一步基于反例讨论后处理契约，不能自动删除保护或新增配置。

2026-11-02 主链资源交接／最终 map 的有限核对通过，见 [记录与待决](ARCHITECTURE-DIRECTION.md#主链资源map-核对与公共配置待决2026-11-02)。当时提出的显式 compatibilityTargetStages／限制配置待决，已由上方最新 owner 指令暂停。未新增该选项，自动资源解析和 Rsbuild 薄封装也未完成；主构建实现与恢复修复已提交，独立 compiler 不引入。

2026-11-02 主链处理器失败恢复已修复：afterCompile 只登记本轮精确聚合模块的原生依赖，失败保留、成功替换；回归包含修复 token 文件触发恢复及清空后移除旧依赖。默认 Rsbuild Chromium PostCSS overlay／同值恢复通过（`main-dev-postcss-fixed.log`），首次失败及 red 测试保留。完整 verify **2559** 项及 lint/build/types 再次通过，见 `main-processor-verify.log`。下一项核对资源／map 与消费入口，不引入独立 compiler。

2026-11-02 已按 owner 确认实施内部主构建接入，见 [实现记录](ARCHITECTURE-DIRECTION.md#主构建接入实施2026-11-02)。finishMake 汇总 → addEntry → 原生 CSS 链；未引入独立 compiler。完整 verify **2559** 项及 lint/build/types 通过（`main-compilation-verify.log`）；Rspack native CSS watch 覆盖多入口／lazy 移除／失败恢复／清空；Rsbuild 默认 dev server 的 Chromium React 更新、错误 overlay、同输入恢复已通过（`main-dev-server.log`）。日志均在 `artifacts/rspack-lifecycle-design/`。下一项核对 PostCSS 自身失败恢复、资源／map，再连接公共入口；仍无公开插件导出。

2026-11-02 owner 暂停引入独立 compiler，要求先比较主构建 CSS 链。[调研结论](ARCHITECTURE-DIRECTION.md#主构建-css-链与独立-compiler-对比2026-11-02)建议优先主构建 finishMake + addEntry：Rsbuild 生产处理／HTML 和五轮 watch（PostCSS 依赖、lazy 移除、GSS 失败保留／同输入恢复）已通过；finishModules 对照 panic 保留。仅隔离探针及文档，无产品变更；默认 dev server、资源／map、多入口仍待验证。此前独立 compiler 只是备选，不得自动实施。

2026-11-02 内部 loader／发布编排已完成，见 [架构记录](ARCHITECTURE-DIRECTION.md#rspack-loader-与发布编排实现2026-11-02)。原生 loader 负责依赖和诊断返回；发布须同时满足已 emit、整轮无错及候选成功，处理器依赖失败保留／成功替换。两宿主 Chromium 手动 HMR 探针已改用正式模块并通过；完整 verify **2558** 项（Compiler 1991／React 49／Rspack 21／Vite 163／Testing 334）及 lint/build/types 通过，日志 `artifacts/rspack-lifecycle-design/loader-publication-verify.log`。下一项是 CSS 后处理架构确认及实现，然后接通 Rsbuild 封装与完整交付；仍无公共插件入口。

2026-11-02 可达候选快照已接续实现，见 [架构记录](ARCHITECTURE-DIRECTION.md#rspack-可达候选快照实现2026-11-02)：仅重放当前可达输入，集中检查全局冲突和局部 artifact 一致性；失败不返回部分结果。Rspack 内部共 20 项测试，完整 verify **2557** 项及 lint/build/types 通过；两宿主真实 React Chromium 探针已改用正式内部模块并通过更新／失败／恢复。日志为 `candidate-verify.log`、`modules-react-rspack.log`、`modules-react-rsbuild.log`（均在 `artifacts/rspack-lifecycle-design/`）。下一项为 loader／plugin 的依赖与发布编排及 CSS 处理／Rsbuild 封装；没有公开插件导出，默认 dev server 和完整资源验收仍未完成。

2026-11-02 源码准备内部模块已实现，见 [模块说明](../integrations/rspack/README.md) 与 [架构记录](ARCHITECTURE-DIRECTION.md#rspack-内部源码准备实现2026-11-02)。新增 `@gss-l/rspack` workspace 暂无插件导出；11 项新测试覆盖真实 React／Compiler、同轮输入、诊断及 fallback。完整 `verify` **2548** 项（Compiler 1991／React 49／Rspack 内部 11／Vite 163／Testing 334）及 lint／build／types 通过，日志 `artifacts/rspack-lifecycle-design/source-preparation-verify.log`；初始测试把空值误当必报错输入的两项失败保留，改用明确语法错误，未增加无效 CSS 兜底。后续可达候选快照／全局校验结果见上方。未新增浏览器运行，尚不表示两个宿主插件可用。

2026-11-02 最新 [主构建与真实 React 闭环](ARCHITECTURE-DIRECTION.md#主构建处理与真实-react-闭环2026-11-02)：真实 Compiler CSS／map 已接入处理步骤，PostCSS 依赖修改触发主 watch、失败保留和同内容恢复通过；两个宿主的真实 React Adapter／moduleCode／CSS 原生处理／手动 HMR Chromium 探针均通过。owner 已接受首版最终 CSS map 的原生规则起点精度，Compiler 原始诊断位置保留。仍非正式插件、完整 dev server 或 Fast Refresh 验收。下一项实现 Rspack 内部源码／schema 准备及候选数据契约，再连接两个入口；资源、动态配置及完整发布仍未完成。原始证据在 `artifacts/rspack-lifecycle-design/`，产品代码未变，当前无待 owner 决策。

最新 [CSS 处理阶段对照](ARCHITECTURE-DIRECTION.md#css-loadertargetspostcss-对照2026-11-01) 已完成：直接 asset 确实跳过 loader targets 和 PostCSS；复用实际解析出的原生处理器后，默认／Safari 9／自定义 PostCSS 三组与普通 CSS 输出一致（仅去首尾空白），另确认 PostCSS 文件依赖可从处理器 compilation 取得。证据为 `artifacts/rspack-lifecycle-design/css-stages.log`、`css-processor.log`、`css-dependency.log`。该轮为隔离探针；主构建处理步骤、依赖回传、失败恢复及 map 的后续结果见上方；不直接引入独立 compiler 架构或新公共接口。无产品变更，无新浏览器／全仓验收，当前无新增 owner 决策。

最新 [CSS 输出与更新核对](ARCHITECTURE-DIRECTION.md#css-asset-输出与更新生命周期核对2026-11-01)：两宿主的 asset／runtime 传输探针在 Chromium 通过 CSS-only 更新、失败保留、同 bytes 恢复及再次更新；生产压缩后 HTML／JS 引用与最终 CSS 文件名一致。owner 已确认启用 GSS 时任何编译错误均不发布本轮产物，采用原生 NoEmitOnErrorsPlugin 机制维护恢复链。仍是假模块和手动 HMR 探针，不是 React 集成或完整 dev server 验收。CSS loader／targets／后处理对照结果见上方，随后连接主构建与 Compiler／React／资源／map；不得静默绕过处理阶段。当前无待 owner 决策。

最小配置与生命周期设计已形成 [详细方案](ARCHITECTURE-DIRECTION.md#rsbuildrspack-最小配置与生命周期设计2026-11-01)。Rspack 2.3.0 的三轮 watch 探针验证缓存命中下仍可按图恢复 GSS 假模块集合；Rsbuild 2.3.0 的晚期 CSS 重建探针触发原生异常，取消重建的对照通过，失败证据保留。输出机制尚未定案，不能标记新宿主可用。owner 已确认 Rspack 核心 + Rsbuild 轻量配置封装；asset／HTML／HMR 后续探针见下方当前结果，不改变 React／排序／fallback。证据在 `artifacts/rspack-lifecycle-design/`，未改 workspace 依赖或产品代码，未跑全仓／浏览器。

owner 已补充整体目标：先稳定 React 生态，再进入 Vue 等 UI 框架。本轮已完成 [React 生态粗规划](ARCHITECTURE-DIRECTION.md#react-生态覆盖规划2026-11-01-调研)：第一批 Vite 与 Rsbuild／Rspack；第二批评估 webpack／Parcel；React Router、TanStack Start、Next.js 和 Storybook 按上层框架／消费场景分别验证。优先级不是市场份额排名，也不是全部工具已经获准实施；进入其他 UI 框架前须有支持范围、运行证据及剩余限制结论。下一具体工作是 Rsbuild／Rspack 最小配置与生命周期设计，本轮只调研与更新规划。

owner 已指定优先支持 React + Rsbuild／Rspack，暂不新增 Vue／Svelte。具体 [接入方案与交付顺序](ARCHITECTURE-DIRECTION.md#react-多构建工具接入方向2026-11-01) 建议以一套 Rspack 集成供原生 Rspack 和 Rsbuild 复用，保留现有 React Adapter／Compiler。两个入口已获确认，当前未实现新宿主；先确定最小配置和缓存／编译生命周期，再完成构建、开发更新及两个消费入口。排序、fallback、既有 Vite 支持和发布授权边界不变。本次仅文档更新，无新增运行验证。

## 已完成：Parser／Adapter／宿主接口评估

2026-11-01 owner 批准的调用链核对与 Vue／Svelte、非 Vite 宿主纸面推演已完成，基线为 `f7acf1a`。详见 [接口评估与最小调整方案](ARCHITECTURE-DIRECTION.md#接口评估与最小调整方案2026-11-01)：现有职责分离保留，未发现必须立即修改运行时的契约反例；新框架的输入阶段、模板绑定、虚拟 id、预处理依赖与 map 仍需真实需求决定。未新增框架、公共 API 或通用宿主引擎，排序／fallback 不变。

既有 React 49 项及 Vite 插件／诊断定位／dev-CSS 51 项通过，日志在 `artifacts/adapter-contract-review/`；仅文档变更，未重跑全仓 verify 或浏览器。该轮接口核对已结束；后续目标已由 owner 指定为上方 React 多构建工具接入，不自动进入 Vue／Svelte。

## 最近切片记录

同条件链连续复用已提交 `9216360`。后续继续核对命名与资源身份，修正通用编码器 NFC 行为的过时注释；现有编码保持 Unicode 序列区别及资源 ASCII 转义格式，未改变运行时。说明见 [资源身份核对](ARCHITECTURE-DIRECTION.md#全局资源规划的职责边界)，已有相关回归包含在本次完整 verify；注释切片未重复运行测试。状态／属性 selector、pseudo、ownership／结构等剩余复用屏障继续保留，当前未证明可进一步放宽。

同条件链连续复用的原 atom-ranks 默认 Chromium／Firefox／WebKit 全部通过：每引擎 fixed 部分 **86 fixtures／254 comparisons／127 exact image pairs／7 corruptions**；新增 media／supports／container 条件成立／不成立、嵌套条件与跨异值错误合并负对照。原逻辑／物理 418 simple＋59 semantic、2852 paired＋800 authored-native readings 以及状态 96 comparisons／32 exact image pairs／2 corruptions／6 external checks 均保留通过。四组歧义、七组诊断／LKG、两种 compatibility fallback／恢复与基线一致。证据在 `artifacts/conditional-atom-reuse/`，旧浏览器产物已备份；当前完整排序报告为 `artifacts/rank-integration/browser/result.json`。未放宽图像比较或独立预期。独立 Chromium browser oracle **125 fixtures／1267 comparisons／38 controls** 与 Vite host、SSG、multipage 同样通过，日志为同目录 `browser-oracle.log`，当前报告为 `artifacts/browser-reference.json`。

物理 longhand 连续复用已提交 `1080947`。后续完成相同条件链的保守屏障核对：media／supports／container 内各一组同属性相邻同值在修改前输出三个 class，原因是当时的纯 atom 条件要求 conditions 为空。owner 已确认并实现仅放开完全相同有序条件链，其他复用／语义／fallback 屏障保留；具体范围与回归要求见 [同条件链复用](PROPERTY-ORDER-DESIGN.md#已实现完全相同条件链内的纯-atom-连续复用)。完整 `verify` **2537** 项（Compiler 1991／React 49／Vite 163／Testing 334）及 lint／build／types 通过；初步定向 159 项通过。证据在 `artifacts/conditional-atom-reuse/`，feature-red 含 9 项预期行为失败和 1 项已修正的测试 scope 读取错误。浏览器结果见本文开头。

物理 longhand 连续复用实现验证：完整 `verify` **2522** 项（Compiler 1976／React 49／Vite 163／Testing 334）及 lint／build／types 通过；随后补充 alias 加入／移除时的共享拆分与恢复回归，复用测试文件 **112** 项、对应 lint 和 Compiler typecheck 通过（该切片当时全仓测试数为 2523，未把这次定向运行写成第二次完整 verify）。复用仍取最早 `(atomRank, orderSlot)`，不重编号后续竞争者，来源／map 汇总与跨模块位置隔离保留。四组歧义、七组诊断／LKG、两种 compatibility fallback／恢复与既有基线一致。证据见 `artifacts/physical-longhand-reuse/`，保留 41 项 feature-red 和首次全仓 4 项旧方向屏障断言失败；旧断言按已批准范围拆为物理正例和混合属性负例，没有削弱独立排序预期。

原 atom-ranks 默认 Chromium／Firefox／WebKit 全部通过：每引擎 fixed 部分 **76 fixtures／234 comparisons／117 exact image pairs／4 corruptions**，包含新复用的五种 scope 子集、两种保留屏障及错误跨异值合并的计算样式／几何负对照；原逻辑／物理 418 simple＋59 semantic、2852 paired＋800 authored-native readings 与状态 96 comparisons／32 exact image pairs／2 corruptions／6 external checks 保持通过。当前报告 `artifacts/rank-integration/browser/result.json`；旧报告／图像及运行日志保存在 `artifacts/physical-longhand-reuse/`，无图像容差或预期放宽。独立 Chromium browser oracle **125 fixtures／1267 comparisons／38 controls** 及 Vite host、SSG、multipage 同样通过，见同证据目录 `browser-oracle.log` 与当前 `artifacts/browser-reference.json`。

2026-10-31 owner 已指定转入 atom 身份与 class 复用核查。已完成当前排序／命名／汇总链路及八组公共会话输出核对，确认方向属性一律禁止连续复用是可进一步设计的保守限制，跨模块 orderSlot 和完整桶屏障仍必要。owner 已批准「完整竞争组只有同一种物理单 effect longhand 时复用合格连续同值桶」，现已实施，排序投影、混合属性／上下文屏障与 fallback 准入保持。详细方案、反例及证据见 [Atom 复用核查](PROPERTY-ORDER-DESIGN.md#atom-复用核查与下一切片提案2026-10-31)。实施前 Compiler build 和既有定向 435 项通过；实施证据另列下方，不启动 profiling。

border-width 切片已提交 `8cc95c2`。后续完成 planner／五个专用 emitter 的绑定消费核对，未发现新的重复目标决策或契约反例；保留候选／存活 occurrence、authored scope 与实际绑定的区别。核对为只读，没有新增运行验证，详见 [架构核对](ARCHITECTURE-DIRECTION.md#绑定消费后续核对2026-10-30)。该轮已授权有限范围已完成；2026-10-31 已转入上方 atom 复用核查，物理 longhand 连续复用已获批准；除此之外不自动扩展 CSS 族、值域或复用边界。

有限 border-width 安全展开已按 owner 授权实现：只处理隔离的同规则非负静态 px／零与物理侧宽度竞争，按原位置展开四侧，保留 importance、来源、selector-list 共享和排序／复用屏障；跨规则竞争、逻辑别名、复杂值及 compatibility／preserved 保持原路径。范围及反例见 [属性排序设计](PROPERTY-ORDER-DESIGN.md#已实现有限-border-width-安全展开)。

完整 `verify` **2491** 项（Compiler 1945／React 49／Vite 163／Testing 334）及 lint／build／types 通过，定向 378 项通过。旧 545 样本完整输出、四个歧义、七个诊断／LKG、两种 compatibility fallback／恢复序列对照不变；新 19 个浏览器用例独立使用 authored CSS 和字面预期。原 atom-ranks 默认 Chromium／Firefox／WebKit 均通过：每引擎 fixed 部分 69 fixtures／220 comparisons／110 exact image pairs／3 corruptions，逻辑／物理部分 418 simple＋59 semantic、2852 paired＋800 authored-native readings，状态部分 96 comparisons／32 exact image pairs／2 order corruptions／6 external boundary checks。证据在 `artifacts/border-width-expansion/`；保留首次 feature-red（11 项失败）、focused／verify／rank-browser 日志和旧浏览器产物备份。完整报告在 `artifacts/rank-integration/browser/result.json`，不扩大值域或性能承诺。独立 Chromium browser oracle 125 fixtures／1267 comparisons／38 controls 及 Vite host、SSG、multipage 均通过，日志为同目录 `browser-oracle.log`，当前报告为 `artifacts/browser-reference.json`。

既有五族 box 安全展开策略已集中描述目标属性顺序、非负／百分比限制及别名隔离，算法不再按 family／axis 分支计算策略；仍按 physical → inline → block 处理每族。没有新增 CSS 族、值域或注册 API，既有保守边界不变。完整 `verify` 2456 项及 545 样本／歧义／诊断／fallback 对照通过，见 `artifacts/box-expansion-policy/`；未重跑浏览器。

关系计划不再返回与 plannedDescendants 是否存在重复的 hasDescendantConditions；输出按规划结果是否存在选择路径，保留已规划但实例为空的 scope 登记。原准入谓词及 planner 调用时机不变。完整 `verify` 2456 项与 545 样本／歧义／诊断／fallback 对照通过，见 `artifacts/descendant-plan-presence/`；未重跑浏览器。

已删除 `ResolvedTarget.declarations`：它只是 occurrences 的声明投影且无消费方。目标结果只保留路径和包含规则／声明身份的 occurrences，不影响排序候选或存活声明顺序。完整 `verify` 2456 项与 545 样本／歧义／诊断／fallback 对照通过，见 `artifacts/ownership-occurrence-only/`；未重跑浏览器。

普通 ownership 的 layer／条件分组、局部目标前缀和胜出解析移入 `application/ownership-planning.ts`；输出只消费目标分组与可选 descendant 实例，不再读取整个 relation plan。保留空目标 scope、剪枝前排序候选与存活输出的区别、解析顺序及 fallback 后调用时机。完整 `verify` 2456 项、545 样本完整输出及歧义／诊断／fallback 序列对照通过，见 `artifacts/ownership-planning-boundary/`；本切片未重跑浏览器。

方案 A 后续切片：external 同节点／后代 anchor 在原子输出入口建立绑定，排序候选与输出共用 `OwnedTargetBinding`；`:has()` 主体复用同一字段契约。外部目标仍不导出 scope，两类 external 的 effect 检查范围及诊断顺序保留。完整 `verify` 2456 项与 545 样本完整输出、四个歧义、七个诊断／LKG、两种 compatibility fallback／恢复序列对照通过，见 `artifacts/external-anchor-binding/`。未重跑浏览器 gate。

2026-10-30 owner 确认 marker 架构方案 A：保留专用输出分支和共享命名／scope／selector 基础能力，不新增 MarkerPlan。输出消费已规划绑定，排序、身份和 fallback 不变；该架构选择已决，不再等待 owner。理由与重评条件见 [架构方向](ARCHITECTURE-DIRECTION.md#已确认保留专用-marker-输出分支方案-a)。本次仅文档变更，没有新运行验证。

`:has()` 主体绑定已在关系规划阶段建立，排序候选和 marker 输出共用 rule／targetPath；逐 observation 身份、原生 selector-list specificity 和结构歧义的独立计算保留。完整 `verify` 2456 项和 545 样本完整输出、歧义／诊断／fallback 序列对照通过，见 `artifacts/observed-subject-binding/`；未重跑浏览器 gate。

结构输出类型进一步明确为 `RuntimeStructuralInstance`，要求 planner 返回的 sourcePath 必须存在；普通／继承的 descendant 实例仍允许无来源路径。输出端移除非空断言，运行时算法不变。完整 `verify` 2456 项及 545 样本／歧义／诊断／fallback 对照通过，见 `artifacts/structural-source-contract/`；未重跑浏览器。

已交付宿主基线为 `4b7a982`，核心修复为 `af02efe`，统一固定排序为 `e04327b`：核心收敛、官方 Vite 模板、Declarative 客户端路由和 Framework SSR 的已选任务均已交付。本文保留历史证据，不把旧快照当成未来代码的自动验收。后续工作以 [当前计划](NEXT-STAGE.md) 为准。

有限 MVP 的逐项目标进度及后续 `2f115b1` 基线上的基础验证、演示生产构建结果见 [MVP 进度](MVP-PROGRESS.md)。该核对未新增浏览器验收，也不将历史开放项改判为全部完成。


目录迁移现状：产品代码位于 `compiler/`、`adapters/react/`、`integrations/vite/`、`types/`；测试基础设施位于 `tests/`，Playground 已迁至 `examples/playground/`，其他验收应用仍在 `tests/acceptance/`。最新迁移验证和外部证据见 [当前计划](NEXT-STAGE.md)。同属性独立 rank 已与跨属性输出位置分离，完整安全 shorthand 展开仍未完成；静态 margin／padding／inset／scroll-margin／scroll-padding 同规则与跨单节点 scope 展开已有有界切片，五族逻辑轴 inline/block 的静态双向展开也已加入，范围见当前计划。

静态负 px padding 误剪枝已在 owner 确认后按受限范围修复；原始三引擎反例、适用范围及 compatibility 等未改变路径见 [当前计划](NEXT-STAGE.md)。

属性排序分离切片将同属性版本 `atomRank` 与跨属性输出位置 `orderSlot` 分离；仍由原 effect 竞争族和语义高度规划输出，身份保留位置以限制复用，未展开 shorthand 及 fallback 不变。`verify` 2222 项通过；534 个既有排序 fixtures 去除新身份编码差异后的输出投影与基线一致，source-map 列编码由既有映射测试验证。此前 occurrence 收集重构的完整字节等价证据保留在当前计划。本项原 atom-ranks 三引擎、Chromium browser oracle 125／1267／38 及每引擎 12 项独立原生对照通过，原始日志与边界见当前计划。

此前 shorthand 切片加入静态 scroll-margin／scroll-padding 的四方向展开，保留逻辑别名竞争和不安全值的原路径；未扩大负值过滤、compatibility 或 preserved 范围。`verify` 2259 项、原 atom-ranks 三引擎、Chromium browser oracle 125／1267／38 及每引擎 43 组四侧原生对照通过；具体边界和证据见当前计划。

此前逻辑轴切片加入五族 inline/block 的静态双向展开，生成 start/end 而不映射物理方向；遇其他潜在别名仍保留原路径，排序和 fallback 不变。`verify` 2347 项、原 atom-ranks 三引擎、Chromium browser oracle 125／1267／38 及每引擎 654 组原生／字面对照通过；适用边界及完整运行证据见当前计划。

此前百分比切片在原安全展开边界内支持 margin／padding／inset／scroll-padding 的静态百分比，百分比计算由浏览器负责；scroll-margin 和负百分比 padding 保持原路径。`verify` 2400 项、原 atom-ranks 三引擎、Chromium browser oracle 125／1267／38 及每引擎 648 组原生／字面对照通过，具体验证与限制见当前计划。

最新字体长度切片在原安全展开边界内支持五族简单静态 em／rem，浏览器负责计算；负相对单位 padding 仍沿用原路径。`verify` 2452 项、原 atom-ranks 三引擎、Chromium browser oracle 125／1267／38 及每引擎 810 组原生／字面对照通过，具体验证与限制见当前计划。

最新架构切片提取 scope 路径、schema 和 JS／类型输出到内部模块，marker／atom membership、排序和 fallback 规则保持原流程。`verify` 2452 项及 537 个样本的完整 replacement／finalize 前后等价通过；此行为保持式移动未重跑浏览器 gate，详见当前计划。

最新架构切片提取全局资源规划和 keyframes 引用处理，资源冲突仍在会话提交前检查。`verify` 2452 项、329 项定向测试及 538 个样本完整输出前后等价通过；行为保持式移动未重跑浏览器 gate，详见当前计划。

最新架构切片提取关系 selector 渲染并保留局部 marker 登记，规划与 preserved 路径不变。`verify` 2452 项、362 项定向测试及 538 个样本完整输出前后等价通过；行为保持式移动未重跑浏览器 gate，详见当前计划。

最新架构切片集中规则形态判断，冲突检查仍对 external 上下文保留额外约束；`verify` 2452 项、722 项定向测试及 538 个样本完整输出前后等价通过，未重跑浏览器 gate，详见当前计划。

最新架构切片集中条件／layer 分组与未注册诊断；`verify` 2452 项、375 项定向测试及 539 个样本完整输出前后等价通过，未重跑浏览器 gate，详见当前计划。

最新 parser 切片将 selector 构建改为节点片段，保留原 parser port 输出和 external 状态处理；`verify` 2453 项、281 项定向测试及 539 个样本 parser／编译输出前后等价通过，未重跑浏览器 gate。

最新架构切片将资源冲突检查移至资源模块，会话仍在提交前调用；`verify` 2453 项、280 项定向测试及 539 个样本与资源冲突／恢复序列前后等价通过，未重跑浏览器 gate。

最新架构切片集中关系 planner 的调用与歧义顺序，各关系证明及 fallback 不变；`verify` 2453 项、654 项定向测试、539 个样本及三组歧义／旧快照前后等价通过，未重跑浏览器 gate。

最新架构切片将排序候选的原有组合移入关系规划模块，保留 candidate／instance 区别及延迟时机；`verify` 2453 项、513 项定向测试及 539 个样本与三个歧义场景前后等价通过，未重跑浏览器 gate。

最新有界核对梳理了 Adapter／Vite 接缝：现有简单非 React 假 adapter 可传递 schema，但 Vue／Svelte 与虚拟模块等仍未验证；31 项相关现有测试通过，未修改 API 或运行浏览器验收。

最新架构切片将整模块 preserved 贡献生成隔离，入口和排序／fallback 决策不变；`verify` 2453 项、329 项定向测试、539 个样本及两种兼容设置的失败／恢复序列前后等价通过，未重跑浏览器 gate。

最新架构切片提取兼容性声明分析，冲突检查与 fallback 选择仍在原调用方；`verify` 2454 项、330 项定向测试、539 个样本及两种兼容设置的 fallback 序列前后等价通过，未重跑浏览器 gate。

最新架构切片分离 atomic／关系 marker 输出阶段，保留各分支的身份与准入；`verify` 2454 项、735 项定向测试、539 个样本及歧义／fallback 序列前后等价通过，未重跑浏览器 gate。

最新架构切片集中 external selector 上下文与准入检查；`verify` 2454 项、641 项定向测试及 539 个样本与歧义／fallback 序列前后等价通过，未重跑浏览器 gate。

最新架构切片集中 selector 形态准入并保留条件、声明与形态检查的先后顺序；`verify` 2454 项、650 项定向测试和 539 个样本及 7 个诊断／LKG 场景等价通过，未重跑浏览器 gate。

最新架构切片分离 `:has()` observation 输出和共享声明类型，逐分支身份、native specificity 与 marker 保持不变；`verify` 2454 项、654 项定向测试及 540 个样本与歧义／fallback 序列等价通过，未重跑浏览器 gate。

最新架构切片分离结构关系的 source／中间／target marker 输出；`verify` 2454 项、673 项定向测试、541 个样本及歧义／fallback 序列等价通过，未重跑浏览器 gate。

最新架构切片分离 ownership 与祖先条件输出，保留各自 DOM／marker 语义；`verify` 2454 项、722 项定向测试、542 个样本及歧义／fallback 序列等价通过，未重跑浏览器 gate。

最新架构切片分离 external condition／target 输出，保留外部节点与 scope 的边界和 overlap 拒绝；`verify` 2454 项、645 项定向测试、544 个样本及歧义／fallback 序列等价通过，未重跑浏览器 gate。

最新架构切片分离 pseudo-element 输出并集中输出上下文类型；`verify` 2454 项、658 项定向测试、545 个样本及歧义／fallback 序列等价通过，未重跑浏览器 gate。

最新架构切片引入 selector 节点状态／属性只读视图，保留 descendant 与结构 planner 的独立证明；`verify` 2454 项、513 项定向测试、545 个样本及歧义／fallback 序列等价通过，未重跑浏览器 gate。

最新公共类型变更按 owner 确认加入 Adapter 诊断可选 range，Vite 原有位置行为保持不变；`verify` 2455 项及 51 项 Vite 定向检查通过，类型擦除后的诊断模块运行时代码相同。

最新架构切片将节点条件视图用于语义高度与 ownership 输出，证明和缺失值行为不变；`verify` 2455 项、722 项定向测试及 545 个样本与歧义／fallback 序列等价通过，未重跑浏览器 gate。

已三引擎复现负百分比／em／rem padding 导致先前有效声明被误删；合法负零仍有效。owner 决定无效 CSS 由作者负责，不扩大过滤；既有负 px 处理保留，反例及证据见当前计划。

结构 marker 输出现直接消费 planner 已确定的 sourceIndex／sourcePath／targetPath，不再重复从规则搜索和派生绑定。尾部 descendant 仍参与 CSS 渲染，结构证明过滤后的 edges 不能替代完整组合符；排序查询、身份、来源和 fallback 不变。完整 `verify` 2456 项及 545 样本完整输出、歧义／诊断／fallback 序列对照通过，见 `artifacts/structural-bound-emission/`；本切片未重跑浏览器 gate。

2026-10-30 按 owner 确认完成只读节点／派生路径迁移：移除规则 `path` 与准备阶段投影，无 WeakMap／getter／响应式缓存。完整 `verify` 2456 项、545 样本完整输出及歧义／诊断／fallback 对照通过，首次构建失败已修复并保留日志；本次未重跑浏览器。具体证据及下一步见当前计划。

内部 CSS parser port、准入、关系规划、排序和输出已改为节点绑定，状态／属性／observation／pseudo 平行数组已移除；ownership 名称路径已按 owner 决策从只读节点按需派生，不保存第二份字段或增加缓存。公共编译输出不变，完整绑定模型仍未完成。`verify` 2456 项和对照验证见当前计划。

准入、规划与输出中 authored selector 的节点数量和位置已改由节点读取；实际 ownership 目标／来源绑定仍保留独立路径，验证见当前计划。

Parser 与规划规则现共用 `ParsedStyleRule`，准备阶段的 ownership 路径投影及过渡 `ParsedSourceRule` 别名已移除，验证见当前计划。

节点及派生路径返回值有类型层面的只读约束，运行时不冻结；验证见当前计划。

关系规划、语义高度和输出已直接读取节点条件，旧条件视图已移除，证明与缺失位置行为保持原样；验证见当前计划。

Selector 节点迁移后的默认 Chromium／Firefox／WebKit 排序验收及独立 Chromium browser oracle 已通过；旧产物备份和具体覆盖见当前计划。

排序绑定的 rule／targetPath／sourcePath 已从已有 planner instance 类型选取，结构 instance 原本已共享该类型；只收敛数据契约，不合并关系证明。验证见当前计划。

逻辑／物理冲突上下文已按节点形成等价分组键，不再重建条件平行数组；验证见当前计划。

`:has()` 关系候选、结构规划、语义高度和 atom／preserved 输出已改读节点 observation，相关平行数组已移除，验证见当前计划。

Pseudo 规划／输出、固定排序上下文及复用判断已改读节点，原 pseudo 主体、specificity 和排序屏障不变，验证见当前计划。

规则分类与 background 特例已改读节点，逻辑／物理冲突的 external 限制及上下文分组保持原样，验证见当前计划。

既有 Playground 已迁至 `examples/playground/`；独立浏览器参考和验收留在 `tests/`，根命令不变。冻结安装、完整 `verify`、原 Chromium Playground 与独立 browser oracle 已验证；旧产物备份和范围见当前计划。

Playground 的运行、构建和类型检查归示例包，原 testing 脚本保留转发；根与旧入口验证见当前计划。

结构关系规划与排序中的严格细化证明共用实例约束构造，runtime／ownership 和 observation 的证明边界不变；验证见当前计划。

结构约束中的未使用重复路径已清理，实际 source 绑定与 runtime edges 保持不变，验证见当前计划。

逻辑／物理冲突校验复用统一 ownership 路径匹配，`GSS1206` 准入与 fallback 不变，验证见当前计划。

Compatibility 物理声明身份的写入与查询已集中，资源标记、importance 与 fallback 行为不变，验证见当前计划。

已有 compatibility transformer 契约归应用层，Lightning CSS 实现通过该契约注入，运行行为不变，验证见当前计划。

已清理未使用的旧状态歧义检查器；实际歧义判断仍由关系 planner 负责，验证见当前计划。

已记录当前节点 background 特例的准入与竞争闭包，未扩大属性或 selector 支持，验证见当前计划。

Ownership 路径匹配已从 background 特例中移出，关系规划与语义高度不再依赖该特例模块；匹配语义和准入不变，验证见当前计划。

声明胜出也复用该路径匹配，删除等价的重复实现；空路径、重复名称和现有输出对照见当前计划。

已明确 property effect 登记与安全展开分别负责写入／重置和语法／值分配；不从登记表推导通用 shorthand 展开，验证见当前计划。

结构关系输出也使用共享节点条件视图读取 source 状态／属性，marker 和 selector 的来源位置不变，验证见当前计划。

## 当前阶段

owner 已决定有限 MVP 结项，已批准并完成官方 create-vite React TS 外部消费、Vite 8 实验及同模板 React Router Declarative／BrowserRouter 客户端路由验收。最新基础验证为 2456 项测试通过；Browser oracle 为 125 fixtures／1267 comparisons／38 controls，Playground 同范围通过。另已按 owner 授权完成 React Router Framework Mode 的有界 request-time SSR 实验；不覆盖历史 Firefox 失败或通用／完整 SSR。

owner 已要求按整体规划推进核心架构与排序目标，确认更强 GSS 语义优先、同高度逻辑先／物理后；[架构方向](ARCHITECTURE-DIRECTION.md) 和 [属性排序设计](PROPERTY-ORDER-DESIGN.md) 区分目标与当前行为。会话提交／失效、贡献准备与快照汇总已分离；产品包、测试基础设施和 Playground 已按上述职责迁移，其他验收应用仍在 `tests/acceptance/`。可原子化的 pure ownership 规则内及跨规则累积的已登记逻辑／物理 longhand 对已准入。preserved 模式、shorthand 及其他上下文仍可能报告 GSS1206，同属性 rank／输出位置已分离，完整安全展开仍未完成。无法安全展开的既有输入暂时沿用当前 shorthand 处理和 fallback，不额外拒绝。

owner 仍要求**不自行新增框架或验收场景**。隐式 className 类型、native marker 策略和公共 stylesheet URL／插件数组返回值均已决策；不重复要求重选。property effects、selector marker、统一排序及会话事务／资源生命周期的有界核查已交付；遗留问题和授权边界见 [当前计划](NEXT-STAGE.md)。

## 会话事务／资源生命周期有界核查

基于 `e1cbcdf`，按[当时的核查顺序](NEXT-STAGE.md#已完成的会话资源核查顺序)先读现有测试与实现，再执行定向检查；没有新增运行时代码、测试、fixture、配置或公共契约。

- 会话入口：`compiler-session` 的 prepare／commit／finalize 与对应测试、`session-convergence`；宿主入口：Vite 插件 replacement 编排、`dev-css`、`stylesheet-url`。失败贡献在 commit 前退出，已提交 schema／CSS／export 不被替换；rank／scope 为新 contribution 局部数据。最新 task 身份防止旧异步读取反向覆盖；成功恢复清除失败标记，identical-byte recovery 仍更新 native CSS owner。既有输入未复现污染或恢复遗留。
- 资源入口：compiler `stylesheet-assets`／`asset-values` 与 Vite `stylesheet-assets`、`dev-assets`、`production-assets`、`production-census`、`production-output` 及已有测试。核对绑定身份、共享资源所有者、失败时字节快照保留、成功替换、static／lazy 可达集、aggregate CSS href／hash／manifest；未发现违约。dev 的一代旧 URL／30 秒退休保留既有 in-flight 契约，fallback 保留 URL 不构成问题。
- 断言不是只比较数量：convergence 比较 CSS、完整 manifest／report、单独 generation，target-aware 路径另比较 schema；但通用 helper 不比较 sourceMap，也不穷举每步 module code／诊断。已有失败全快照与 Unicode 顺序断言含 map，production watch／fresh 比较 manifest／CSS／map／report 并有独立字面预期。此处记录覆盖限制，不把未测组合认作 bug 或为扩覆盖新增测试。
- 四组定向检查 **339** 项通过；`corepack pnpm verify` 在重新 build 后再次覆盖这些测试，共 **2124** 项（1580／49／161／334）及 lint／build／types 通过。原始日志 `artifacts/lifecycle-consistency/01-session-baseline.log` 至 `05-verify.log`，详细检查及证据索引 `inspection.md`。无反例，无 root-cause fix／red→green。
- 仅复核已保存的 core-consistency browser initial／final 成功日志及历史 readiness 未归因记录；没有据通过样本宣称因果修复。本轮无 timeout，不新增采样或 browser／外部 SPA／SSR 执行。代码／宿主输出／排序均未改，无受影响浏览器 gate；历史浏览器证据仍是历史证据。

该轮已按两处有界核查的停止标准结束，不证明任意 CSS、并发时序或资源组合正确；`.gss` 删除、reload／state 保证、跨模块优先级、Firefox Article、性能及发布边界不变。新的架构和排序目标见当前阶段。

## 本轮核心一致性修复

基于 `451dd5c` 核对现有 registry、selector parser/emission 与相关排序规划器，修复 `mask` 缺失 mask-border reset-only effects、`corner-shape` 错判 singleton、nth-of global compound 误改 local、functional attribute 字符串／CSS escape 被破坏、嵌套 global wrapper 遗留及 runtime-source 漏做 marker rewrite。各修复在现有测试文件保留 red→green 回归；没有新框架、fixture 项目或验收矩阵。

owner 已明确将复杂 `:has()` 丢失 native specificity 作为 bug 修复：仅对已准入复杂 residual 保留完整原生 `:has(list)`，每条 emission 另用零 specificity 的 branch witness 保留观察身份；planner 不再用猜测的 class/type 数做这类 list 的强度判断。简单已有路径不变，不新增语法或 DOM 推理。独立 Chromium native/literal 对照在 weaker-only／stronger／both／none 及规则正反序均通过，分支来源与 LKG 回归保留。

owner 已确认统一固定策略：原生 strength／layer／condition／pseudo 上下文不变；已证明 ownership／结构语义高度优先，同高度潜在竞争属性按逻辑先、物理后输出，而不是原生 source order。相同属性及同类型同级声明仍按 authored occurrence 决胜。`module-order-policy.ts` 集中定义潜在重叠、属性优先级、保守复用屏障和属性输出总排序键（优先级／严格 shorthand 包含深度／稳定名称）。已覆盖原五类 box、size/min-size/max-size、border 各 aspect／radius、overflow／overscroll 的已登记方向 effects。潜在别名仍不当作 definite effect 剪枝，GSS1206 原准入／LKG 不变，无新语法／配置。

证据目录：`artifacts/core-consistency/2026-10-26-audit/`（baseline/remaining probes、各阶段 red logs、最终 verify/browser/playground logs、has-native-red/green）。该核心 bug 修复阶段的 browser oracle 125／1267／38 与 Playground dev/preview gate 重跑通过，未新增外部 SPA／SSR／Article 执行证据；后续统一排序阶段的 Article 两引擎复验见下文。

## 已完成交付

| 阶段 | 关键提交 | 已交付内容 |
| --- | --- | --- |
| 初始有限 MVP | `c99a0d3` | 编译器、React／Vite 及原生 CSS 对照基线；当时 1081 项测试通过 |
| Playground 与真实页面 | `e4ad1ba` 及其祖先，PR #29 | 中文 Playground、Fieldwork task-board、article/comments；真实交互、独立原生参考、精确图像比较；跨模块警告 `GSS2107` |
| 模块内固定排序 | `399444f`，PR #30 | 已准入的同模块多 scope 竞争统一排序，修复 target-local 排序不足 |
| 逻辑／物理属性排序 | `1012d98`，PR #31 | 潜在方向别名参与排序族及语义优先级候选，保留所有权／结构优先级 |
| 安全 rank 复用 | `dc9ad13`，PR #31 | 仅收缩连续、完整且符合条件的同语义 rank 桶，降低真实示例输出 |
| 核心 CSS／引用收敛 | 至 `088811d` | 隐式字符串引用、有限 alias、property/state 扩展、nth-of 和有界 native relation marker |
| 官方模板／Vite 8 | `c9013d1` | workspace 外公开 tarball 消费及 Rolldown census 修复，保留 Vite 7 回归 |
| 客户端路由 | `f54a963` | 官方模板中的 Declarative／BrowserRouter 用户路径 |
| Framework SSR／公共 CSS URL | `4b7a982` | 真实请求时渲染、无 JS 样式、hydration；`virtual:gss.css?url` 与 `gss(): Plugin[]` |
| 核心一致性修复 | `af02efe` | shorthand/reset、local/global marker、CSS 文本序列化与复杂 has 原生 specificity |
| 统一固定排序核心 | `e04327b` | 同语义高度逻辑先／物理后，统一潜在竞争／复用屏障，消除属性比较器循环 |

上述实现全部已合入 main，不存在待合并的正式交付分支。保留的 `prototype/module-local-atom-ranks` 是独立演示原型，不是待合入代码。

### 输出改善

安全复用前后，业务 CSS 不变：

| 示例 | 原子数 | CSS 字节数 |
| --- | --- | --- |
| Article | 147 → 131 | 21863 → 19545（约 -10.6%） |
| Task-board | 162 → 135 | 24181 → 20453（约 -15.4%） |

这是两个指定示例的结果，不是所有样式表的复用率保证。

## 必须保留的语义契约

1. **模块内排序**：先使用已证明的所有权／结构关系形成语义依赖高度，再按固定属性优先级（逻辑先、物理后），最后按原始规则 source ordinal 和声明位置规划 `orderSlot`。`atomRank` 只在同属性内计数，不作为跨属性排序键；source order 不是与语义边同等强度的图边，也不存在通用 selector 等级。
2. **原生层叠强度**：rank 不覆盖原生 importance／specificity。layer、条件和伪元素主体等上下文必须保持区分。
3. **来源身份**：共享声明对象不能替代 selector-list 分支身份；保留原始规则、分支、目标／来源／观察绑定，避免错误剪枝或覆盖。部分 shorthand 胜出及 scope membership 也不能丢失。
4. **不透明关系**：owner 已接受 equal-native-strength 的 `:global()`／`:has()` 竞争在缺少既定语义关系时按 source order 决胜；这不是扩大语法准入。
5. **逻辑／物理别名（统一固定策略替代旧 Policy B 的 source-order tie）**：潜在重叠用于排序，不代表确定相同 effect；同语义高度物理后发，不扩大 definite 删除、属性准入或运行时映射。浏览器仍负责 direction／writing-mode 映射。
6. **安全复用**：仅限语义高度为 0、无条件、简单单节点 pure occurrence，完整连续桶的 property／精确 value／importance 相同；同时保留最早的同属性 rank 和输出位置，不跨越竞争者，不重排后续编号；生成身份和汇总 key 均保留输出位置，不能仅按属性／值／局部 rank 合并。所有已建模方向 effects（含 shorthand）统一作为保守复用屏障；不再维护分散的五族正则。
7. **模块边界**：同模块多 scope 组合是支持能力；跨模块同节点优先级仍不支持。`GSS2107` 是保守、非阻塞诊断，不能通过禁用同模块组合来回避排序缺陷。
8. **准入与 fallback**：既有 external-target 保护及 last-known-good 行为保持不变。新语法、API、配置、fallback 或范围取舍需 owner 明确决定。

关键实现：[fixed-module-ranks.ts](../compiler/src/domain/fixed-module-ranks.ts)、[module-order-policy.ts](../compiler/src/domain/module-order-policy.ts)、[compiler-session.ts](../compiler/src/application/compiler-session.ts)。回归入口：[fixed-module-rank-reuse.test.ts](../compiler/test/fixed-module-rank-reuse.test.ts)、[logical-physical-order.test.ts](../compiler/test/logical-physical-order.test.ts)。

## 验收与已知边界

### 当前 main 的基础验证

本轮统一排序已运行 `corepack pnpm verify`：Compiler 1580、React 49、Vite 161、Testing 334，共 2124 项测试，另有 lint／build／类型检查通过。

### 浏览器证据

- 官方 React Router Framework Mode 8.5.0／Vite 8.3.5 workspace 外未修改 tarballs：Chromium dev 与实际 production server、请求级 loader token、无 JS 初始样式/资源、hydration/interactivity、导航/history/deep-link/reload 与负对照通过。新增公开 `virtual:gss.css?url` 通过标准 emitted asset URL 对接框架正常 `links()`；不声称 native route CSS extraction 或 streaming 验收。`gss()` 现在返回 plugin array，标准 Vite 配置不变，直接访问单插件 hooks 的消费者需调整。详见 [Framework SSR 验收](FRAMEWORK-SSR-ACCEPTANCE.md)。

- 官方 create-vite 9.3.1 React TS 在 workspace 外安装本地未修改 tarballs，Vite 8.3.5／plugin-react 6.1.2／React 19.3.1／TypeScript 6.0.3；Chromium install／类型／dev／build／preview、跨文件 implicit string className、资源、lazy、overlay／LKG／恢复及 state 记录通过。Rolldown census 缺失 implicit-load 字段已修复，Vite peer 扩展为 7 或 8；workspace 保留 Vite 7。详见 [验收报告](VITE-TEMPLATE-ACCEPTANCE.md)。
- 同一外部官方模板的 React Router 8.5.0 Declarative／BrowserRouter：Chromium dev 與 production preview 的 Link 导航、back/forward、lazy route、直接深链接／reload、route GSS literal style／资源和 central CSS census 通过，保留六个 HMR/LKG phases，新增 19 个 routing checkpoints／route corruption control。证据 `artifacts/vite-template/2026-10-26T06-45-04.945Z/`；Node >=22.22.0，部署依赖 SPA rewrite，不代表 SSR 或通用 host 已配置。详见 [验收报告](VITE-TEMPLATE-ACCEPTANCE.md#客户端路由验收后续-owner-授权)。
- 当前 Browser oracle：125 fixtures、1267 comparisons、38 controls；Vite host、SSG hydration、multipage lazy/hydration/state controls 通过。
- Task-board 三引擎真实用户路径：每引擎 76 phases、13 exact image pairs、dev HMR/LKG/recovery、父子 implicit `className`、production lazy/CSS census 通过。删除 `.gss` 不属于当前支持契约：独立实验发现 Chromium/Firefox/WebKit 的 overlay/LKG 行为不一致，因此当前只承诺文件修改、非法输入 LKG、恢复和显式重建；删除场景的失败 artifact 保留在 `artifacts/cross-browser-rendering/task-board/2026-10-23T04-10-04.608Z/`，不宣称删除重建已通过。
- 统一固定排序：原 atom-ranks gate 默认三引擎通过，逻辑／物理 carrier 仍为 418 simple／55 semantic、每引擎 2772 paired readings，额外保留 800 次原始 authored-native 断言。原生预期未被改成 GSS 结果：同 fixture 独立记录 raw CSS 值与显式 GSS physical-priority oracle；精确图像和 order corruption controls 保留。
- Article 受扩展 border 复用屏障影响，atomic census 131→132：form／field 的 identical border 不再跨 rank 合并。业务 CSS 未改；现有 per-engine 入口 Chromium／WebKit 各 82 phases／22 exact image pairs 与负对照通过。默认三引擎 Article script 未改，Firefox Article 未运行。历史 147→131／字节数表保留为当时结果，不是本轮数字。
- 本轮证据：`artifacts/unified-order-core/`（red、transitivity red、verify/browser/playground、Article 两引擎、census delta）；最终三引擎 rank 产物在 `artifacts/rank-integration/browser/`。首次 rank 全套因 300s wrapper 预算不足中断，后一次因 child 1800s session 上限中断，原始产物均已备份；增加有界预算后同入口全套通过，不是 readiness 缺陷修复。
- 安全复用交付：独立审查接受 **Chromium／WebKit** 范围；Article 每引擎 82 phases／22 对精确图像。Firefox Article 的 dev→production 导航问题由 owner 暂缓，不宣称已修复。
- rank 验收曾因两引擎加载器入口失配，意外跑了原三引擎 gate 并通过。已披露执行范围偏差；这不能消除 Article 的历史 Firefox 失败。
- 通用 browser readiness 曾出现 120 秒超时，原因未确定；owner 授权的固定三次未加仪器样本随后通过。不把这些通过说成已找到因果修复，也不允许无限重试直到绿。
- Article 截图曾因 locator 自动滚动丢失 hover；已改为相同全页 clip，并检查截图前后交互／滚动／几何状态，保留负对照。

脚本事实：`browser:check`、`task-board:check`、`article:check`、`atom-ranks:check` 的默认执行范围不能被“Firefox 暂缓”自动改写；尤其 Article 和 atom-ranks 默认跑三引擎。需要两引擎复验时先确认已有入口和运行范围，不能假设存在 skip flag 或私自改默认 gate。当前 main 已重新运行 browser oracle 与 Playground gate；Firefox Article 仍未重新启动。

普通场景用独立原生 CSS／literal oracle，所有权／结构语义用明确 GSS oracle。图像在同引擎内精确比较，不增加容差／遮罩，不修改业务 CSS、删 fixture 或削弱断言来换取通过。失败和仪器化试验属于证据，不能覆盖原始失败记录。

## 暂缓事项：不是默认待办

### 性能

owner 已要求先记录、以后再看；不启动 profiling、排序优化或 no-op 快路径。

测量源码为 `dc9ad13`，当时在独立测量分支，不是 main 上的新性能验收。36 场景 × 3 样本，共 108/108，另有 smoke；共享主机、预热 public-session 调用，非 SLA 或最坏情况证明。

| 场景 | replace + finalize 中位数 |
| --- | --- |
| Article | 9.39ms |
| Task-board | 8.80ms |
| 单模块 500 条不同 width 声明 | 78.72ms |
| 单模块 1000 条不同 width 声明 | 248.40ms（样本范围 241.40–403.36ms） |
| 100 模块中修改一个 5 声明模块 | 3.86ms |
| 250 声明 no-op 替换 | 25.17ms |

大型单模块成本、重复值仍有 replace 成本、no-op 重建都是后续研究线索，不是已确认热点。macOS 测量采用 native normal-pressure guard；最初仅凭空闲页的 guard 停止不代表内存耗尽。RSS 派生结果以 `corrected-derived` 为准：未采样／zero-only 记为 null，不当成零值观测；原始数据及所有耗时统计保持不变。

### Firefox 与后续范围

Firefox Article 导航问题仍暂缓。包发布、其他框架适配器、新语法或新 fallback 均未获本轮授权。已选模板、路由和 SSR 任务已完成；Astro／Next.js／SWC 等不是下一项候选队列，owner 已要求停止新增验收场景。当前已讨论的架构和排序目标及未决事项见 [当前计划](NEXT-STAGE.md)。

## 本机交接与证据恢复

以下是本机状态，不是其他开发者必须具备的运行依赖：

- 唯一工作目录：`/Users/gan/Desktop/🥷/css-plugin/GSS-l`，使用 main。额外 17 个 worktree 已归档并移除。
- 完整归档：`../GSS-l-worktree-archive-20261019T160632/`。有 `manifest.json`、逐文件校验、恢复说明和 `repository-refs.bundle`；不含可重装的 node_modules。
- 主要历史证据位于该归档的 `GSS-l-rank-integration.tar.gz` 内 `./artifacts/`：`fixed-module-ranks/`、`logical-physical-order/policy-b/`、`rank-reuse/`、`compiler-scale/`。
- 性能记录：同一压缩包内 `./artifacts/compiler-scale/DEFERRED.md`；修正派生数据在 `./artifacts/compiler-scale/pressure-aware/attempt-01/corrected-derived/`。历史记录中的分支名、未合并状态和旧路径是当时快照，以本文和当前 Git 为准。
- 旧未提交 Dev React HMR 工作的本地 stash 已经 owner 授权删除；本次清理后 stash 列表为空。备份仍保存在上述 `repository-refs.bundle` 的 `refs/stash`，对象为 `f4a8330836cc301e0e7a32c69e02e70e37be70f4`。如需恢复，先从 bundle 导入到隔离的恢复位置并审查与现有实现的差异，不直接应用到 main。
- warning 审计目录的未提交修改保存在 `GSS-l-warning-verify-20261016T094553Z.tar.gz`，不视作待合入功能。
- 独立审查报告仍在 `~/.pi/agent/sessions/--Users-gan-Desktop-🥷-css-plugin-GSS-l--/subagent-artifacts/outputs/`。复用最终验收工作流：`dbf137f9-0ca2-4f21-8daa-fc539e0aca0b`；性能审查：`105dafe8-321e-44a3-ae8b-61ab56cd243d`。
- Git SSH 已恢复：本仓库 `core.sshCommand` 使用指定密钥、443 和 `UseKeychain=yes`；GitHub 实测认证账号是 Gogo-Bytes。提交署名不等于认证账号；不需要在新 session 重配凭据。

恢复证据时只解压需要的文件到单独位置，不覆盖当前源码。历史文档如确有需要，可从初始冻结提交读取；不批量恢复已删除的 ADR／路线图。
