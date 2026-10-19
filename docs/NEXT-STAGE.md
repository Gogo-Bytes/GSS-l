# 阶段结项与真实集成阶段计划

## 决策与当前阶段

owner 已决定结束当前有限 MVP，并明确顺序为“基本核心能力收敛 → 扩展脚手架 → 常见 SSR 框架实验”。**第一步不是接脚手架。** 核心盘点、首要类型体验发现及待决策项见 [核心能力盘点](CORE-AUDIT.md)。本文件中的脚手架／框架仅为第二、三步候选，不授权自动实现。

不再为此新建 SSR/SSG Playground。保留现有 Playground 作为演示／调试台，fixture 作为语义回归，真实脚手架／框架示例作为用户路径验收载体。

## 有限 MVP 结项

代码与测试基线：`847698c`；本次结项仅调整文档。此处结项不创建 tag、release，不发布包。

- 已交付：框架无关编译核心、React/Vite 集成、中文 Playground、Task-board／Article、模块内固定排序、逻辑／物理属性排序修复、保守 rank 复用。
- 基础验证：1417 项测试，lint／build／类型检查通过。
- 最近专项：Playground Chromium dev/preview 各 123 cases／1260 comparisons 通过；有界 SSG／hydration Chromium gate 通过，新增无 JS 初始样式检查。
- 不宣称：任意 CSS 全面支持、全浏览器无缺陷、完整 router 生命周期、独立 production SSR 或流式 SSR 已验收。
- 历史已知问题保留：Firefox Article 导航和 readiness 原因未确定；性能继续暂缓。

证据与边界：[MVP 进度](MVP-PROGRESS.md)、[Playground](PLAYGROUND-COVERAGE.md)、[SPA](SPA-ACCEPTANCE.md)、[SSR/SSG](SSR-SSG-ACCEPTANCE.md)、[STATUS](STATUS.md)。结项不注销已知问题、不扩大已通过范围。

## 1. 缺陷与缺口分类

| 编号 | 分类 | 已知事实 | 下一步／授权状态 |
| --- | --- | --- | --- |
| D1 | 历史已知失败 | Firefox Article dev→production 导航失败 | 暂缓，不因新阶段自动重启 |
| D2 | 未归因的历史失败 | 通用 readiness 曾超时，随后固定样本通过，未找到因果修复 | 保留原始失败；新目标若复现，停止并诊断，不循环重试 |
| L1 | 已接受体验限制 | class mapping 改变允许 document reload、React 状态重置 | 在真实脚手架中显式暴露；是否要求 state-preserving HMR 需 owner 决定，不默认当 bug 修 |
| C1 | 验收覆盖缺口 | 浏览器中删除／重建 `.gss` 缺独立实际应用证明，已有 server 测试 | 首批脚手架选定后纳入场景；出现失败再建立缺陷最小复现 |
| C2 | 验收覆盖缺口 | 普通 className 跨文件传递有转换回归，尚无专门真实用户项目端到端证明 | 纳入真实脚手架的父／子组件场景，不扩展 scope 类型推导 |
| C3 | 验收覆盖缺口 | router、前进／后退、路由懒加载与深链接未整体验收 | 选定真实带路由脚手架后运行，不靠模拟 MPA 宣称通过 |
| C4 | 验收覆盖缺口 | 有界 SSG 不等于 production SSR bundle／请求时渲染 | 在选定常见 SSR 框架中实验，不先自创 SSR 宿主协议 |
| N1 | 本轮不做 | 跨文件 scope 推导、跨模块覆盖优先级 | owner 已跳过；普通 className 字符串是主要用法 |
| N2 | 暂缓 | 性能 profiling／优化 | 未重新授权，不启动 |

新缺陷记录必须包含：环境／固定版本、最小步骤、预期来源、实际结果、失败产物与是否违反既有契约。覆盖空白、体验限制和已复现缺陷不能合并计数。

## 2. 脚手架候选（待选择）

以下仅是候选和选择理由，不是当前兼容声明；尚未核对其当前版本与官方接入方式。

| 候选 | 用途 | 需验证的差异 |
| --- | --- | --- |
| 官方 create-vite React + TypeScript 模板 | 建议首项：最接近现有 React/Vite 能力，先暴露普通用户接入摩擦 | 正常插件组合、React 刷新、TS client reference、依赖安装和构建 |
| create-vite React + SWC + TypeScript 模板（若所选版本提供） | 比较另一 React 工具链 | 插件顺序、转换与 source map、开发更新 |
| React Router 官方脚手架 | 引入真实路由与后续框架模式候选 | 客户端导航、lazy、深链接、框架构建／SSR 模式；具体模式先选定 |

先做一个模板的完整用户路径，再扩展矩阵；不一次引入多个尚未证明的 Adapter 或配置。

## 3. SSR 框架实验候选（待选择）

| 候选 | 实验价值 | 必须先澄清 |
| --- | --- | --- |
| React Router framework mode | React 路由、框架构建及请求时渲染 | 所选版本与官方构建方式，不能将直接 Vite gate 结果套用 |
| Astro + React | 内容 SSG 与 React islands／hydration | 哪些样式属于 React，哪些属于 Astro；不默认新增 Astro 语法 Adapter |
| Next.js | 常见 React SSR／SSG 使用路径与非 Vite 集成约束 | 所选构建器、Server/Client Components、是否需要新宿主 Adapter；不能承诺现有 Vite 插件直接可用 |

每个框架先形成“可接入／受限／阻塞”的实验结论，再决定是否纳入正式支持。若必须新增公共 API、配置、运行时、fallback 或语法支持，先向 owner 提供选项和后果。

## 4. 测试与用户路径一致的门禁

1. 从所选官方模板开始，记录生成命令、模板／框架／Node／包管理器版本与 lockfile，依赖官方文档确定接入，不复制内部 harness 伪装成脚手架。
2. 使用包公开入口，不导入仓库 `src` 私有文件；最终用户路径需在 workspace 外验证，不能只依赖 workspace alias／symlink 成功。
3. 包尚未发布：实施前检查本地打包是否可安装、workspace 依赖是否正确转换；可用本地 tarball 实验但不发布，不用手改生成包内容掩盖 packaging 缺陷。
4. 验证 install、类型检查、dev、build、实际 production serve；记录用户必需的配置步骤。测试断言可观测状态，不增加只给测试使用的转换通道。
5. 普通样式传递：父组件传 `className={styles.title}`、子组件接收字符串；包含可见交互、资源与 lazy。
6. dev 覆盖修改、无效输入／overlay／LKG／恢复、删除／重建；同时记录是否 reload、React 状态是否保留，不把样式最终更新等同于 HMR 体验无损。
7. 有路由时才增加导航、前进／后退、懒加载与深链接。SSR/SSG 框架增加无 JS HTML、CSS 链接、hydration mismatch、生产请求及资源结果；流式功能只按框架实际采用范围验收。
8. 独立 literal／原生预期、有效负对照与原始失败证据保持不变；视觉对照保持同引擎精确比较，不削弱断言。
9. 每份报告明确版本、浏览器、实际入口、通过／失败／未测及限制；实验通过不自动升级为普遍兼容承诺。先确定浏览器范围，不擅改既有 gate。

## 下一步待 owner 决定

当前先按 CORE-AUDIT.md 收敛基本核心能力，首要决定为隐式 className lowering 与严格 TSX 的使用契约。核心阶段选定门禁通过后，再选择脚手架；官方 create-vite React + TypeScript 模板仅是第二步候选，不是当前任务。
