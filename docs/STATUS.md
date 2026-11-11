# GSS 当前状态

## 当前摘要（2026-11-06）

阶段收尾完成：已有 Vite、Rspack、Rsbuild、webpack 四个宿主入口，统一事实与证据见 [宿主支持清单](HOST-SUPPORT.md)。产品代码基线 `eb47522`。2026-11-06 按 owner 要求清理已被替代的历史进度、交接与调研材料；有效的 React 引用契约并入架构文档，验证边界及本机恢复入口独立保留。本次仅文档清理，不产生新的产品或浏览器验证结果。

已确认的目录分层、Compiler 阶段拆分、只读 selector nodes/派生路径、rank/orderSlot 分离、有界 shorthand 展开与 atom 复用、React Adapter 边界及多宿主接入均已有实现。不是完整 CSS、全部 React 生态或通用构建工具支持；更宽能力不自动成为尾项。

最近完成：webpack 公开插件/隔离 minimizer；公共准备包无效导出清理；webpack 稳定符号链接目录的虚拟 CSS 修复；Rspack/Rsbuild 文档状态核对。无待合并正式实现；具体工作区以 git status 为准。

## 最新维护核查

嵌套 `self` 与父节点字符串的导出冲突已修复。React 业务源码直接使用静态路径；升级和保留名称规则见[React 引用契约](ARCHITECTURE-DIRECTION.md#react-引用与-typescript-契约)，验收与提交记录见 [#53](https://github.com/Gogo-Bytes/GSS-l/issues/53)。

Owner 已授权 [#33](https://github.com/Gogo-Bytes/GSS-l/issues/33) 的 Vite 模板有界验证：新增／移除未引用 scope、失败与同输入恢复，检查导出、最终样式、document 和组件状态。范围与证据见 [模板验收](VITE-TEMPLATE-ACCEPTANCE.md#scope-形状更新owner-授权)；不推及嵌套形状或其他宿主。

Owner 已批准并实现 [#32](https://github.com/Gogo-Bytes/GSS-l/issues/32) 的 webpack、Rspack／Rsbuild 有界切片：JSX 导入 `.gss` 编译失败且有可靠范围时，终端展示匹配失败快照的文件、行列和首行代码框；不承诺 overlay。契约及验证载体见 [webpack](../integrations/webpack/README.md#调用边界) 与 [Rspack／Rsbuild](../integrations/rspack/README.md#loader-与发布编排) 接线说明。

2026-11-04 owner 授权的 [React 更新链路只读核查](REACT-UPDATE-REVIEW.md)已完成。区分值/class/schema 变化、JS 更新、整页导航与组件 state；核对四宿主代码和既有证据，未确认新契约违约。没有运行新测试/浏览器或改产品，2569 项仍为原验证基线。scope 形状和通用 state 保持没有因此获得保证。

2026-11-04 owner 授权的 [诊断与定位只读核查](DIAGNOSTIC-LOCATION-REVIEW.md)已完成：Vite 有原生 loc/frame 断言；Rspack/Rsbuild/webpack 保留诊断范围但未转换为同等展示，部分 React 错误本来无范围。核查记录实际差距与证据层级，未确认新契约违约；没有新增产品或运行验证。

## 当前工作与授权

Vite 开发模式已实现 React 直接静态导入的 `.gss` 缺失报错、上一成功版保留、原路径恢复和最后一个引用移除后的清理。浏览器验证覆盖两个组件共享同一文件。[架构决定](ARCHITECTURE-DIRECTION.md#vite-开发时文件删除与恢复)、[验证记录](REACT-UPDATE-REVIEW.md#vite-开发时文件缺失与移除引用)、[#33](https://github.com/Gogo-Bytes/GSS-l/issues/33)

维护现有支持范围，修复可复现契约问题，补必要回归并同步文档。2026-11-06 owner 已批准将诊断定位、React 更新目标、Firefox Article 和性能线索迁入 Issues；[任务映射](NEXT-STAGE.md#已迁入-github-的跟踪事项)指向各自唯一动态状态。迁移不批准新能力或恢复暂缓事项。保持 main 直提，暂不采用 PR；其他能力边界仍按设计文档与 owner 授权。

## 语义与职责

Compiler 保持框架/宿主无关；React Adapter 负责 JSX 引用分析；各宿主负责模块图、批次失效、CSS/资源交付与发布。公共准备层只复用既定算法，不统一宿主生命周期。

排序、shorthand、身份/复用、marker 和 fallback 以 [属性设计](PROPERTY-ORDER-DESIGN.md)、[核心工作流](ARCHITECTURE-DIRECTION.md)、[domain 指南](../compiler/src/domain/README.md)为准。保持原生强度及已证明语义优先、同语义逻辑先物理后、同属性 rank/跨属性输出位置分离；不因宿主修复改变这些契约。

## 验收与已知边界

最近代码验证：Rspack／Rsbuild 终端定位变更运行完整 `corepack pnpm verify`（lint、build、单元测试和类型检查）；Rspack watch 与 Rsbuild 构建覆盖失败定位及恢复。verify 不包含浏览器。同轮未重跑浏览器；历史 Chromium 生产/开发更新与错误恢复证据及其他专项的基线、版本和限制见 [验证账本](HOST-SUPPORT.md#验证账本与恢复入口)，旧证据不能冒充当前提交重验。

浏览器脚本保留默认引擎范围，运行前检查实际入口。Firefox Article 暂缓不改变其他脚本默认值。保留独立 oracle、精确图片比较和失败证据。已接受限制与未验证范围分列于 [支持清单](HOST-SUPPORT.md#已接受限制与当前政策)，不把缺少证据当作新缺陷。

## 本机交接与证据恢复

直接使用现有 main；不相关改动先协调。旧 worktree、stash 备份与历史证据的原始位置完整保留在 [恢复记录](VALIDATION-EVIDENCE.md#本机交接与证据恢复)，恢复到隔离位置，不覆盖当前源码。artifacts 和外部临时 consumer 不保证存在于其他机器。

## 文档与追溯

当前任务见 [NEXT-STAGE](NEXT-STAGE.md)，新 session 使用 [HANDOFF](HANDOFF.md)。过期快照和研究过程不再在工作树维护；需要追溯时可用 `git show 266a87c:docs/<原文件名>` 读取清理前版本，不恢复为当前待办。
