# React 更新链路只读核查

> 后续 owner 已授权 Vite 模板中新增／移除未引用 scope 的有界浏览器验证；当前结果及限制见 [模板验收](VITE-TEMPLATE-ACCEPTANCE.md#scope-形状更新owner-授权)。下文保留原只读核查基线。

2026-11-04，基线 `2f86437`。Owner 授权核查已有代码、测试与日志，未授权新增状态保持承诺或验收矩阵。本轮没有运行构建/浏览器、修改产品或新增测试。结论分为代码事实、已有实证和未验证边界。

## 首要区别

“只修改 CSS 源码”不等于“只有 CSS 产物变化”。例如红→蓝的 atom class 可以改变；scope 的 `selfClassName` 属于 schema，schema 又决定导出的 JS。即使 scope 名称/树形完全不变，也可能需要传播 JS 更新。

[scope-exports](../compiler/src/application/scope-exports.ts)把规划的 class 写入 schema，再生成供适配器读取的节点导出。已有 Vite 官方模板检查明确断言修改颜色后 DOM class 与修改前不同。不能为了避免 reload，直接吞掉这类 JS 更新或稳定化 class 身份；那将改变既有身份/复用契约。

还要区分三个层次：原生 CSS 更新、JS HMR 接受后重新渲染、React 组件状态保持。页面没有整页导航不能证明组件未重挂载；要证明 state 保留必须有组件状态断言。这里“schema 变化”分为 class 映射变化与 scope 名称/嵌套形状变化，不能用前者的证据覆盖后者。

## 各宿主调用链

### Vite

[hotUpdate/startReplacement](../integrations/vite/src/index.ts)记录每文件最新任务，读取/编译失败不替换成功贡献。成功后 [dev-css](../integrations/vite/src/dev-css.ts)通过 Vite 原生 css-update 发布聚合 CSS；失败后的恢复即使 CSS bytes 相同也发布更新，以清除 overlay。

对于 `.gss` 修改，先收集/失效虚拟 GSS 模块和已记录的源文件 importer，再编译并比较修改前后完整 scope schema。成功且 schema 相同返回空传播集合；不同则把模块交回宿主传播。底层缓存失效与浏览器 JS 更新不是同一回事。对资源 bytes 变化，只有 scope schema 改变才返回 JS 传播集合。

结论：GSS 决定哪些代码需要重新转换、哪些模块进入传播，不决定所有 React 边界是否可接受 HMR。React 插件/宿主可以接受，也可能按其规则 reload。代码中的删除分支不等于 `.gss` 删除已成为支持契约。

### Rspack 与 webpack

两个 [source loader](../integrations/rspack/src/source-loader.ts) / [webpack loader](../integrations/webpack/src/source-loader.ts)都为引用者登记 `.gss` 文件依赖，通过 [公共准备](../integrations/shared/src/source-preparation.ts)取得新 schema 并调用 React Adapter；`.gss` 的 JS 来自同批次 moduleCode。宿主决定哪些缓存模块重建及浏览器如何接受更新，没有 Vite 式的 schema 比较后返回空传播集合。

各自 main-compilation 从可达图汇总候选，immutable CSS/map query 进入原生 CSS 链；publication 只在本轮 emit 且无编译错误时推进成功结果，NoEmitOnErrorsPlugin 对整个编译生效。webpack 处理器依赖从其 snapshot/API 回传，Rspack 使用自身方式；这些负责构建/恢复，不提供 React 状态保持 runtime。

### Rsbuild

[pluginGss](../integrations/rsbuild/src/index.ts)组合 Rspack 插件与 CSS/HTML 桥接，没有另写 React 更新协议。React 插件由用户原配置提供。可以继承编译层实现，但 Rsbuild 浏览器证据不能反向当成原生 Rspack dev server 证据。

## 三类修改与已有实证

| 修改 | Vite | 原生 Rspack | Rsbuild | webpack |
| --- | --- | --- | --- | --- |
| CSS 值变化，class 映射改变 | 官方模板颜色/class 更新，document marker 与 counter 保留且继续可点击 | 原生 watch 有新产物；早期手动 accept 探针有页面更新；无通用 state 结论 | 默认 React dev server 的颜色/边距更新通过；所查外部脚本没有 counter 或 document marker 断言 | 无接收边界的早期探针出现整页导航；显式 accept 版本无整页导航且样式更新，未检查组件 state |
| scope 名称/嵌套形状变化 | 代码会重新准备 schema/转换 importer；不能借用颜色变化的状态保持结论 | 依赖重建与候选一致性机制存在；没有此场景的完整 React state 实证 | 同左，不能因默认 React 插件存在就认定状态保持 | 同左，原生 accept 颜色探针不是 scope 形状验收 |
| 非法输入→恢复 | 保留旧贡献；官方模板检查旧样式/class/counter/document，恢复后继续保留；另有同 bytes 恢复机制/测试 | watch 检查发布对象不前进、恢复/清空及依赖；手动 HMR 证据范围有限 | 外部默认 dev 检查 overlay、旧蓝色、恢复同蓝与下一次红色编辑 | 公开 dev 检查 overlay、旧样式、同输入恢复和再编辑；原生 accept 中无整页导航 |

恢复为“最后成功输入”和恢复为“更早的原始输入”也不同：Vite 模板先改蓝，失败后恢复原红；Rsbuild/webpack 外部探针明确恢复同蓝，再改红。不能仅凭模板恢复通过就声称所有宿主的 identical-input recovery 都已验；后两者有各自独立证据。

## 证据定位

| 证据 | 本次读到的断言/结果 |
| --- | --- |
| [Vite 模板报告](VITE-TEMPLATE-ACCEPTANCE.md)；[检查脚本](../tests/acceptance/vite-template/check.mjs) | child TSX 修改、CSS class 变化、错误与恢复时检查 counter 和 document marker；属于指定 Vite 8.3.5/plugin-react 6.1.2/React 19.3.1/Chromium |
| [Vite dev CSS 测试](../integrations/vite/test/dev-css.test.ts)、[资源测试](../integrations/vite/test/dev-assets.test.ts) | 新 CSS、importer revalidation、原生 css/js-update、LKG 和资源更新；HTTP/消息断言不是 React state 断言 |
| `artifacts/external-host-consumption/dev.mjs` / `dev.log` | Rsbuild 默认 dev server；样式、asset bytes、overlay、同输入恢复；未读取 counter/document marker |
| `artifacts/webpack-experiment/dev-delivery.log` | 原始无显式接收边界版本记录 NAVIGATION TOTAL 3，不能标为无刷新更新 |
| `artifacts/webpack-public/dev-peer.log` / `external-dev.log`；`artifacts/webpack-experiment/dev-public.mjs` | 入口显式 `import.meta.webpackHot.accept('./App', ...)` 后 root.render；NAVIGATION TOTAL 1。没有 counter，不能升级为 Fast Refresh/state 保持 |
| [Rspack watch](../integrations/rspack/test/main-compilation.test.ts)、[webpack watch](../integrations/webpack/test/main-compilation.test.ts) | 候选/发布、错误恢复、lazy 移除和处理器依赖，不是浏览器 React state 验收 |

上述都是既有检查/运行记录。本次未重跑、不新增脚本、没有把历史基线升级为当前全量验收；版本和完整恢复路径见 [宿主清单](HOST-SUPPORT.md)。

## 具体发现与处理结论

1. 将所有 `.gss` 值修改称为“CSS-only HMR”会掩盖 class/schema/JS 变化；记录应按产物变化区分。
2. Rsbuild 外部脚本的 `PASS native CSS HMR` 标签只证明样式结果，不证明无整页刷新或组件状态保持。现有代码/日志不足以确定这两个维度，不猜测结果。
3. webpack 有显式 accept/无 accept 两种不同导航证据；公开版本只验证前者，不能称为默认 Fast Refresh 已通过。
4. scope 名称/形状变化的 React 浏览器结果证据不足；已有准备/转换机制不能替代运行证据。这是未验证组合，不自动构成产品 bug。

本轮没有确认新的当前契约违约，因此不修改实现或增加测试。保持既有排序、class 身份、fallback 与恢复策略。若 owner 后续选择 state 保持或 schema 编辑体验，应先选定宿主/React 插件与具体编辑场景，分别断言样式、导出、document 与 component state；本核查不授权该新目标。

## Vite HMR 绘制调查（2026-11-09）

Owner 同意以“限定场景避免用户可见失样式，保持最终正确性与失败恢复，不通过强制刷新或改变 atom 身份掩盖问题”为调查目标。本轮只调查，未批准或实施发布协议变更。

复用既有外部 Vite 8.3.5／plugin-react 6.1.2／React 19.3.1 consumer 与原始 tarball，Chromium 145.0.7632.6 headless；固定三轮新增／移除未引用 `.extra`，共六次编辑，无网络降速或故意延迟。逐 requestAnimationFrame 记录 computed color／class，记录 Vite beforeUpdate／afterUpdate 与 DOM class mutation，同时保存 CDP screencast 的实际合成帧。

六次均捕获标题由红色变为默认深色再恢复的合成画面，最终 document marker 与 counter=1 均保留。错误颜色连续 RAF 样本跨度为 17–34ms；异常合成帧至下一恢复合成帧的时间间隔约 25–42ms。这是带仪器的 headless 样本，不是最坏延迟、人眼感知或所有设备的时间保证。

首轮相对写入时间：CSS beforeUpdate +22ms，CSS afterUpdate +55ms 时标题已失样式且 class 仍旧；JS afterUpdate +76ms 仍未恢复；DOM class mutation +94ms 后恢复红色。由此确认该场景存在旧 DOM class 与已更新 CSS 的交接空档，且 JS afterUpdate 不能单独证明 React 已提交 DOM。具体修复方案仍待决定，不能仅用固定延时回收旧 CSS。没有确认所有样式变化都具有相同根因或表现。

证据：`artifacts/hmr-paint-investigation/2026-11-09T09-53-30.456Z/`（result.json 时间线、13 张合成帧、server.log）；探针为同目录上层 `probe.mjs`，运行命令 `node artifacts/hmr-paint-investigation/probe.mjs`。使用的外部 consumer 与 tarball 哈希记录在 result.json；运行后已恢复外部输入、关闭浏览器和本轮 server。实际源码／构建产物仍来自原 Vite 模板运行，不冒充本轮重新打包验证。

候选方向是先评估宿主现有更新完成信号与发布顺序，再评估有界的新旧 CSS 交接；任何双版本方案必须证明同名规则竞争、资源回收、失败恢复及多个 importer 的行为。未引入自定义 HMR runtime，也未改变 class 身份、排序或 fallback。动态进度见 [#33](https://github.com/Gogo-Bytes/GSS-l/issues/33)。

## Vite 开发时文件缺失与移除引用

以 `d7cd393` 重新构建的工作区包测试：Vite 7.3.6、React 19.3.0、GSS React adapter、Chromium 145.0.7632.6。临时应用仅有一个 JSX 文件导入 `Card.gss`，没有 Fast Refresh 插件。通过真实文件系统和 Vite watcher 更新；浏览器读取节点的实际颜色与错误浮层，另通过 HTTP 读取中央 CSS。两次独立运行得到相同结果。

| 编辑（同一次运行中依次执行） | 页面与中央 CSS |
| --- | --- |
| 初始 `.card` 设置为红色 | 节点为预期红色，中央 CSS 有红色规则。 |
| 仅删除 `Card.gss`，保留 JSX import | Vite 整页重载并显示缺失依赖；节点不再挂载，中央 CSS 变空。 |
| 原路径恢复，写入重复的 color 声明 | 错误变为 GSS1204；节点仍未挂载，中央 CSS 仍为空。 |
| 不手动刷新，修成有效蓝色 | 错误消失，节点和中央 CSS 均变蓝。 |
| 文件还在，移除 JSX 的最后一个 import 和 class 引用 | 节点恢复默认黑色，但中央 CSS 仍返回蓝色规则。 |

删除文件和移除引用不能共用同一个清理信号。前者可能仍有消费者，后者即使文件未动也可能需要清理。回归应分别检查页面、中央 CSS 及模块导出；本次没有单独请求缺失时的导出，不能从 DOM 消失推断导出内容。清理需以成功更新后的引用关系为依据，并保留其他消费者仍需要的样式。

本机探针、日志与逐阶段快照位于 `artifacts/issue-33-vite-deletion/`；运行 `node artifacts/issue-33-vite-deletion/probe.mjs` 会创建独立临时应用。未测试其他宿主、首次启动、生产缺失、重命名或原子保存；不据此承诺组件状态保持。行为目标见[架构决定](ARCHITECTURE-DIRECTION.md#文件删除与恢复目标2026-11-09-owner-决定待实现)，实施范围在 [#33](https://github.com/Gogo-Bytes/GSS-l/issues/33) 确定。
