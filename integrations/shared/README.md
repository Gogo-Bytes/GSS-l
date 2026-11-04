# 编译准备：宿主与 Compiler 之间的可选公共模块

内部 workspace 包 `@gss-l/integration-preparation`，不是用户配置入口或通用构建工具插件。由 Rspack 现有模块迁入；webpack 实验消费同一实现。只依赖 Compiler，React 仅为测试依赖；不要求 Vite 或未来宿主经过这一层。

## 责任边界

| 责任 | 所属 |
| --- | --- |
| 文件读取、canonical ID、URL 解析及资源依赖 | 宿主集成 |
| 创建/丢弃一个稳定输入批次、保持本批配置不变 | 宿主集成 |
| 批次内按 ID 复用准备结果、冻结源码资源输入 | createStylesheetPreparation |
| 发现 import、提供 schema 并委托框架分析 | prepareSource + 显式 GssSourceAdapter；React 语法属于 React Adapter |
| 模块图、完整可达集合、lazy 移除 | 宿主集成 |
| 按给定集合重放、核对模块导出、生成候选快照 | prepareCandidateSnapshot + Compiler |
| 候选是否可发布、错误恢复、处理器依赖保留 | 宿主集成 |
| CSS loader/minimizer、HTML、资源 bytes、HMR | 宿主及其原有处理链 |
| CSS 准入、排序、rank/复用、fallback | Compiler |

公共模块允许明确的 resolve/read/watch/finalize 回调；它们是能力接口，不接受整个 compilation 或 compiler。不得添加 hostType 分支来操作宿主状态。公共部分不负责寻找最低共同 hook 集，也不模拟统一构建生命周期。

## 输入与失败契约

一份 prepare 闭包代表调用方选定的稳定输入批次。webpack/Rspack 将其绑定到 compilation；这不是所有构建工具都必须存在 compilation 的要求。同 ID 成功与失败均缓存，本批次内磁盘改变也不会重读；调用方必须为新输入创建新批次。不可把它做成跨构建全局缓存，也不能在同一候选中混用两代输入/config。config 本身由调用方保持稳定，模块没有深冻结配置的行为。

prepareSource 先判断 Adapter 支持，发现原 specifier，再 resolve → watch → prepare，最后用原 specifier 查 schema 交给 Adapter transform。解析成功后，即使编译失败也已登记依赖；解析失败时尚无 canonical ID，missing/context 依赖由宿主 resolver 负责，公共层不能猜测文件名。无 import 和不支持源码分别返回 null transformed 和 undefined，宿主据此处理旧依赖/透传。

候选只依据显式传入的完整 ID 集合，不枚举缓存。集合变空就产生空快照；从集合移除的文件即使还在缓存也不再贡献 CSS。重新编译所得 module 必须与源转换使用的 artifact 一致；跨模块冲突失败不会返回部分候选。候选成功不等于宿主 CSS 处理成功，更不等于已发布。

IO 异常保持原异常，Compiler 诊断保留 id/range；loader 决定如何展示。preserved warning 不是失败，不新增无效值判断。未展开 shorthand 的源码覆盖、逻辑/物理固定顺序、语义高度、atom 复用边界全部沿用 Compiler。

## 提取理由、现状与扩展条件

2026-11-04 owner 要求先核对边界再决定共享。两个模块无宿主类型/运行时依赖；已有 webpack 实验是第二个消费方，准备缓存与重放不应维护两份。现有包 rootDir=src，直接跨包源码引用会破坏独立编译边界，所以以内部 workspace 依赖承载，而非新增公共 Compiler API。包依赖必须进入构建和 tarball 安装编排，不能只在 monorepo 中恰好可解析。

Rspack 与 Rsbuild 的专属接线不迁入本包。未来宿主可以只使用 prepareSource，或直接调用 Compiler；若无法提供稳定批次/完整集合，不能声称可复用整套快照流程。是否共享新的能力按具体需求重新判断，不预先扩大本包。

测试从原 Rspack 包原样迁入，覆盖并发、失败缓存/新批恢复、别名、watch 时序、Adapter 原始 range、资产快照、集合移除/清空、冲突、重放一致性、shorthand 与 preserved。原生 loader/watch/publication 回归留在 Rspack，不能用公共单测替代宿主生命周期证据。运行记录见 docs/STATUS.md 与 artifacts/host-preparation-boundary/。
