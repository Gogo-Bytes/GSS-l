# React 更新链路只读核查

2026-11-04，基线 `2f86437`。Owner 授权核查已有代码、测试与日志，未授权新增状态保持承诺或验收矩阵。本轮没有运行构建/浏览器、修改产品或新增测试。结论分为代码事实、已有实证和未验证边界。

## 首要区别

“只修改 CSS 源码”不等于“只有 CSS 产物变化”。例如红→蓝的 atom class 可以改变；scope 的 `selfClassName` 属于 schema，schema 又决定导出的 JS。即使 scope 名称/树形完全不变，也可能需要传播 JS 更新。

[scope-exports](../compiler/src/application/scope-exports.ts)把规划的 class 写入 schema，再生成 `.self` 导出。已有 Vite 官方模板检查明确断言修改颜色后 DOM class 与修改前不同。不能为了避免 reload，直接吞掉这类 JS 更新或稳定化 class 身份；那将改变既有身份/复用契约。

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
