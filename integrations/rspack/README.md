# Rspack 集成内部模块

当前只实现源码／stylesheet 准备，尚无可消费的 `gss()` 插件入口；package exports 为空，不能将 workspace 包存在解释为 Rspack／Rsbuild 已支持。总体方向与已确认决策见 [架构文档](../../docs/ARCHITECTURE-DIRECTION.md#主构建处理与真实-react-闭环2026-11-02)。

## 每轮输入契约

`createStylesheetPreparation` 每个 compilation 建立一次。宿主提供稳定的 Compiler 配置，以及已解析为规范 ID 的源码／资源引用；模块不负责 resolver、文件系统授权、资源 bytes 或 watch。相同规范 ID 的并发请求共享一次读取、一次局部编译及同一结果。失败也保留到本轮结束；修复在新 compilation 中读取，不能在同一候选内混用两代输入。

返回的输入快照复制并冻结资源引用。`module`、schema 与诊断是内部只读消费数据，不能被下游修改。局部准备不判断跨模块资源冲突，也不代表全局快照已成功；下一层汇总仍需重放本轮可达输入。默认配置由宿主在本轮保持稳定，不根据读取顺序调整。

`prepareSource` 通过 Adapter 发现原始 specifier，交给宿主解析，再用原始 specifier 查 schema。依赖解析成功后先登记 watch，随后准备输入；失败时不调用 transform，也不读取上一轮 schema。Compiler 诊断通过 `StylesheetPreparationError.diagnostics` 原样携带，loader 必须保留原始 id／range；IO、resolver 或 adapter 抛出的异常不伪装为 Compiler 诊断。

不支持的源码返回 undefined；支持但没有 `.gss` import 的源码返回空依赖和 null transformed，宿主可清除旧依赖。成功结果分开携带 stylesheet 与 adapter 诊断；宿主报告其中的 error 后不得发布 transform 代码。preserved fallback 成功和 GSS1104 warning 不是编译失败，不额外拒绝用户值。

## 验证与下一层

现有测试使用真实 Compiler 和 React Adapter，覆盖并发／跨轮输入、失败恢复、原始诊断、资产身份快照、preserved warning、别名和 no-import 路径。下一层是本轮可达输入的候选快照与全局校验，随后才是 Rspack loader／plugin 生命周期、CSS 后处理和 Rsbuild 封装。不新增 Compiler 公共接口。
