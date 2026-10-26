# 阶段结项与真实集成阶段计划

## 决策与当前阶段

owner 已决定结束当前有限 MVP，并明确顺序为“基本核心能力收敛 → 扩展脚手架 → 常见 SSR 框架实验”。核心阶段门禁后，已授权并完成官方 create-vite React TS 的 workspace 外消费与 Vite 8 实验，见 [验收报告](VITE-TEMPLATE-ACCEPTANCE.md)。后续 owner 已选择并完成同一模板的 React Router Declarative／BrowserRouter 客户端路由验收；其余脚手架／框架仍为候选，不授权自动实现。

不再为此新建 SSR/SSG Playground。保留现有 Playground 作为演示／调试台，fixture 作为语义回归，真实脚手架／框架示例作为用户路径验收载体。

## 代办进度总览

最近交付：官方 React TS 外部消费与 Vite 8 兼容（`c9013d1`）及后续同模板 Declarative 客户端路由验收；后续 owner 已授权并完成 React Router Framework Mode 的有界 SSR 实验，见 [SSR 验收](FRAMEWORK-SSR-ACCEPTANCE.md)。当前没有已授权但尚未完成的实现任务。

| 状态 | 项目 | 交付／剩余边界 |
| --- | --- | --- |
| 已完成 | 有限 MVP 与核心收敛 | Compiler、React/Vite、隐式字符串引用、property/state 扩展、nth-of marker 和有界 native relation；不是任意 CSS 支持 |
| 已完成 | 核心生命周期用户路径 | Task-board 三引擎父子 className、HMR/LKG/恢复、生产输出；每引擎 76 phases／13 精确图像对 |
| 已完成 | 官方 create-vite React TS 外部消费 | workspace 外未修改 tarballs、strict peers、类型、dev/build/preview、资源/lazy、错误恢复；新模板仅 Chromium |
| 已完成 | Vite 8 兼容修复 | Rolldown census 可缺失字段回归；peer 为 Vite 7／8，workspace 仍为 Vite 7 |
| 已完成 | 真实客户端路由 | React Router 8.5.0 Declarative／BrowserRouter；dev／production preview 导航、前进/后退、lazy route、深链接／reload；仅 Chromium，不包含 SSR |
| 可选 | 其它模板／浏览器矩阵 | React SWC 模板、官方新模板 Firefox/WebKit；未授权，不是当前兼容声明 |
| 已完成，有界 | React Router Framework SSR | 官方 8.5.0 外部模板、production request-time HTML/CSS、JS-off、资源、hydration 和路由；仅 Chromium，[实际范围](FRAMEWORK-SSR-ACCEPTANCE.md) |
| 待选择 | 其它 SSR 框架实验 | Astro + React 或 Next.js；不自动恢复为任务 |
| 待决策，非当前任务 | 更广 CSS 能力 | 更多 at-rule/resource、value grammar、unknown property 注册策略；既有 fallback 不变 |
| 明确排除 | `.gss` 删除支持 | owner 已选不承诺删除时 overlay/LKG；失败证据保留，不作为未完成修复任务 |
| 暂缓 | 性能、Firefox Article 历史问题 | 未重新授权，不自动重启 |
| 本轮不做 | 跨文件 scope 推导、跨模块同节点优先级 | 已跳过；普通字符串 className 仍为主要用法 |
| 单独授权 | 发布、release、tag | 尚未执行；本地 tarball 验收不是发布 |

最新验证：全仓 `verify` 2083 项测试及 lint/build/types；Vite 7 browser oracle 125 fixtures／1267 comparisons／38 controls；Vite 8 官方模板有界 Chromium 外部验收。各证据不是全浏览器／全版本保证。

## 有限 MVP 结项

历史结项基线为 `847698c`；当前核心收敛基线为 main 的 `088811d`。此处不创建 tag、release，不发布包。

- 已交付：框架无关编译核心、React/Vite 集成、中文 Playground、Task-board／Article、模块内固定排序、逻辑／物理属性排序修复、保守 rank 复用。
- 基础验证：Compiler 1539、React 49、Vite 161、Testing 334，共 2083 项测试，lint／build／类型检查通过。
- 最近专项：Browser oracle 125 fixtures／1267 comparisons／38 controls 通过；Playground dev/preview 同范围通过；有界 SSG／hydration 与 multipage lazy/state controls 通过。
- 不宣称：任意 CSS 全面支持、全浏览器无缺陷、完整 router 生命周期、任意框架的 production SSR 或流式 SSR 已验收。
- 历史已知问题保留：Firefox Article 导航和 readiness 原因未确定；性能继续暂缓。

证据与边界：[MVP 进度](MVP-PROGRESS.md)、[Playground](PLAYGROUND-COVERAGE.md)、[SPA](SPA-ACCEPTANCE.md)、[SSR/SSG](SSR-SSG-ACCEPTANCE.md)、[STATUS](STATUS.md)。结项不注销已知问题、不扩大已通过范围。

## 1. 缺陷与缺口分类

| 编号 | 分类 | 已知事实 | 下一步／授权状态 |
| --- | --- | --- | --- |
| D1 | 历史已知失败 | Firefox Article dev→production 导航失败 | 暂缓，不因新阶段自动重启 |
| D2 | 未归因的历史失败 | 通用 readiness 曾超时，随后固定样本通过，未找到因果修复 | 保留原始失败；新目标若复现，停止并诊断，不循环重试 |
| L1 | 已接受体验限制 | class mapping 改变允许 document reload、React 状态重置 | 在真实脚手架中显式暴露；是否要求 state-preserving HMR 需 owner 决定，不默认当 bug 修 |
| C1 | 已接受范围边界 | 删除 `.gss` 的三引擎失败实验已保留 | owner 选择不纳入支持契约，不要求新脚手架覆盖删除 |
| C2 | 已有有界证据 | Task-board 父子字符串路径与官方模板跨文件 `className: string` dev／production 已验收 | 不扩展为跨文件 scope 类型推导或所有组件调用方式证明 |
| C3 | 已有有界证据 | 官方外部 Vite 模板中 React Router 8.5.0 Declarative 客户端导航、前进／后退、lazy route、深链接／reload 已验收 | 仅 Chromium dev／production preview；部署需 SPA rewrite，不等于 Framework Router／SSR／全 Router 生命周期证明 |
| C4 | 已有有界证据 | 官方 React Router Framework Mode 独立 production server／请求时渲染已验收 | 仅指定版本和 Chromium；其它 SSR 框架、server-only 图差异、streaming 仍未覆盖 |
| N1 | 本轮不做 | 跨文件 scope 推导、跨模块覆盖优先级 | owner 已跳过；普通 className 字符串是主要用法 |
| N2 | 暂缓 | 性能 profiling／优化 | 未重新授权，不启动 |

新缺陷记录必须包含：环境／固定版本、最小步骤、预期来源、实际结果、失败产物与是否违反既有契约。覆盖空白、体验限制和已复现缺陷不能合并计数。

## 2. 脚手架

首项已按 owner 选择完成；其余仍为候选，不是兼容声明。

| 候选 | 用途 | 需验证的差异 |
| --- | --- | --- |
| 官方 create-vite React + TypeScript 模板 | 已完成 create-vite 9.3.1／Vite 8.3.5 的有界 Chromium 外部消费 | 本地 tarballs／strict peer／frozen install／类型／React Refresh／dev LKG／production 已通过；[完整范围](VITE-TEMPLATE-ACCEPTANCE.md) |
| create-vite React + SWC + TypeScript 模板（若所选版本提供） | 比较另一 React 工具链 | 插件顺序、转换与 source map、开发更新 |
| React Router | 同一官方 Vite 模板新增 Declarative／BrowserRouter 已完成 | 8.5.0 客户端导航／lazy／深链接／history 有界通过；独立 Framework mode 官方脚手架／SSR 已有后续有界验收 |

先做一个模板的完整用户路径，再扩展矩阵；不一次引入多个尚未证明的 Adapter 或配置。

## 3. SSR 框架实验

| 候选 | 实验价值 | 必须先澄清 |
| --- | --- | --- |
| React Router framework mode | 已完成 8.5.0 的官方框架构建／请求时渲染实验 | [独立 SSR 证据](FRAMEWORK-SSR-ACCEPTANCE.md)，不套用 SPA gate 或扩大为所有框架支持 |
| Astro + React | 内容 SSG 与 React islands／hydration | 哪些样式属于 React，哪些属于 Astro；不默认新增 Astro 语法 Adapter |
| Next.js | 常见 React SSR／SSG 使用路径与非 Vite 集成约束 | 所选构建器、Server/Client Components、是否需要新宿主 Adapter；不能承诺现有 Vite 插件直接可用 |

每个框架先形成“可接入／受限／阻塞”的实验结论，再决定是否纳入正式支持。若必须新增公共 API、配置、运行时、fallback 或语法支持，先向 owner 提供选项和后果。

## 4. 测试与用户路径一致的门禁

1. 从所选官方模板开始，记录生成命令、模板／框架／Node／包管理器版本与 lockfile，依赖官方文档确定接入，不复制内部 harness 伪装成脚手架。
2. 使用包公开入口，不导入仓库 `src` 私有文件；最终用户路径需在 workspace 外验证，不能只依赖 workspace alias／symlink 成功。
3. 包尚未发布：实施前检查本地打包是否可安装、workspace 依赖是否正确转换；可用本地 tarball 实验但不发布，不用手改生成包内容掩盖 packaging 缺陷。
4. 验证 install、类型检查、dev、build、实际 production serve；记录用户必需的配置步骤。测试断言可观测状态，不增加只给测试使用的转换通道。
5. 普通样式传递：父组件传 `className={styles.title}`、子组件接收字符串；包含可见交互、资源与 lazy。
6. dev 覆盖修改、无效输入／overlay／LKG／恢复；删除 `.gss` 按 owner 选择排除。同时记录是否 reload、React 状态是否保留，不把样式最终更新等同于 HMR 体验无损。
7. 有路由时才增加导航、前进／后退、懒加载与深链接。SSR/SSG 框架增加无 JS HTML、CSS 链接、hydration mismatch、生产请求及资源结果；流式功能只按框架实际采用范围验收。
8. 独立 literal／原生预期、有效负对照与原始失败证据保持不变；视觉对照保持同引擎精确比较，不削弱断言。
9. 每份报告明确版本、浏览器、实际入口、通过／失败／未测及限制；实验通过不自动升级为普遍兼容承诺。先确定浏览器范围，不擅改既有 gate。

## 下一步

隐式 className lowering 已按“编译期语法糖 + 轻量 TS 兼容类型”决策并完成。当前核心生命周期验收已完成父子 `className={styles.title}`、dev LKG／恢复、reload/state 记录和 production 用户路径。根据 owner 决策，`.gss` 删除不属于当前支持契约；删除／重建的跨引擎失败 artifact 保留，不作为当前 gate。官方 create-vite React TS 外部消费和 Vite 8 实验已按 owner 授权完成。同模板 React Router 8.5.0 Declarative／BrowserRouter 客户端路由也已按 owner 授权完成；后续 React Router Framework Mode 的有界 SSR 已按 owner 选择 A 完成，公共 URL seam 接入和限制见 [SSR 报告](FRAMEWORK-SSR-ACCEPTANCE.md)。下一项若进入其它脚手架、Router 模式或 SSR 框架，需先确定具体目标／版本，不能将本次有界成功当作普遍兼容。
