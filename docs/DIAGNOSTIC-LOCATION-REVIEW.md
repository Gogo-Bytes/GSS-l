# 现有诊断与错误定位链路核查

## 最终 CSS map：2026-11-13 有界复现

在 `f15a12a` 基线上，使用当前公开 `gss({ adapter: react() })`、Rspack 2.3.0、`devtool: 'source-map'` 和原生 Lightning CSS loader／`gssCssMinimizers`，复用既有 CSS isolation 测试的配置路径核查 #43。宿主 targets 为 Safari >= 9，保留兼容转换和生产压缩。输入为同一 `.probe` 规则中的 `color: red`（第 2 行、第 2 列）和 `appearance: none`（第 3 行、第 2 列），列从 0 开始；普通 CSS 使用相同输入作对照。

以 source map 的 `originalPositionFor` 查询生成声明起点，结果如下：

| 位置 | 本次 GSS 输入的结果 |
| --- | --- |
| Compiler 原始输出 | 两条声明均准确映射到原声明行列 |
| Lightning CSS loader 之后 | `color`、`appearance` 及生成的前缀声明位置均无映射；规则起点仍有来源 |
| 开发模式最终 CSS | 保留上述规则级结果；普通 CSS 的声明位置同样无映射 |
| 生产模式最终 CSS | 经原生 minimizer 后，两条 atom 规则内的声明均映射到各自原始行列，生成的 `-webkit-appearance` 也指向第 3 行、第 2 列 |

只移除 loader 的归因对照保留了开发声明映射；生产对照仍运行相同 minimizer。该对照不作为建议配置，不能为了 map 跳过兼容转换。普通 CSS 的生产声明均指向原规则起点；GSS 本例每个 atom 规则只有一个原始声明，因此其规则来源恰好也是声明来源。不能把这个结果扩大为 preserved 多声明规则、任意 CSS 转换或 DevTools 点击行为的保证。

结论：本例的开发定位损失发生于原生 loader，两侧 CSS 均受影响，未发现 GSS 漏传 map 的契约违约。生产端并非一律缺少声明映射。当前仍沿用已接受的规则起点契约，不增加猜测性的 map 回填；是否进一步改进由 [#43](https://github.com/Gogo-Bytes/GSS-l/issues/43) 记录决定。

本机重跑入口为 `node artifacts/issue-43-source-map/probe.mjs`，带断言的复测通过；`results.json`、`verified.log` 及分阶段 `.css`／`.map` 保留原始产物。初次探针错误地要求尚未经过处理器的普通 CSS 必须已有输入 map，失败保留在 `probe.log`，已修正探针后重跑。此次只做该输入的构建／map 查询，未运行浏览器 DevTools、Rsbuild／webpack、新增产品实现或全量 verify。

## React 别名错误的表达式位置

在 `className={card}` 中读取可变别名（GSS2103）或混有普通值的条件别名（GSS2104）时，诊断覆盖这一次读取的 `card`。重新赋值的 typed props 触发 GSS2103 时，`className={props.scope}` 的范围覆盖整个 `props.scope`。同名引用出现多次，每条错误都取自己的 Babel 节点在本次 Adapter 输入中的 UTF-16 半开区间。节点没有完整起止位置时，保留文件名及错误消息。

Vite 用传给 Adapter 的源码生成原生 `loc/frame`。webpack、Rspack 和 Rsbuild 在 loader 的终端诊断中展示同一快照上的文件、一基行列和首行代码框。多行表达式的首行下划线止于行末，诊断对象仍保存完整范围。已有前置转换时，位置对应转换后交给 Adapter 的文本。

回归覆盖可变与歧义别名、重新赋值的 props、同文件多处使用、CRLF 和表情字符。Vite 开发转换测试验证前置插件插入一行后的位置，webpack／Rspack watch 和 Rsbuild 编译测试验证实际错误文本及改回有效输入后的恢复。[Adapter 测试](../adapters/react/test/transform-react-gss-usage.test.ts) · [Vite](../integrations/vite/test/diagnostic-location.test.ts) · [webpack](../integrations/webpack/test/main-compilation.test.ts) · [Rspack](../integrations/rspack/test/main-compilation.test.ts) · [Rsbuild](../integrations/rsbuild/test/css-isolation.test.ts)

下文保留 2026-11-04、提交 `4408ab1` 的核查基线。随后完成的 CSS 终端定位见 [webpack](../integrations/webpack/README.md#调用边界) 和 [Rspack／Rsbuild](../integrations/rspack/README.md#loader-与发布编排)。

## 链路与位置契约

```text
.gss 原文 → PostCSS 原始 Source → Compiler diagnostic(id, range?)
JS/TS/JSX 原文 → React Adapter → adapter diagnostic(id, range?)
                     ↓
      宿主取得诊断与对应输入 → 宿主错误/警告 → 终端或 overlay
```

公共 `range` 为诊断 `id` 所指输入的零起始 UTF-16 半开区间 `[start, end)`，不是生成 CSS 的坐标，也不是字节偏移。范围可选，不能将“保留原始声明范围”理解为每条诊断都有声明级位置。契约见 [公共类型](../compiler/src/public-types.ts)、[Adapter 接口](../compiler/src/application/source-adapter.ts)。

- [CSS parser](../compiler/src/infrastructure/postcss-stylesheet-parser.ts)在 nesting 改写前保存 authored Source；克隆节点复用原来源，不从重新生成的 CSS 反推。语法错误只采用与本次输入匹配的 PostCSS Input 坐标，处理 BOM，缺少可靠来源时省略 range。selector 诊断可指向整个原始规则；重复声明 GSS1204 可以指向具体声明，二者精度不同。
- [React Adapter](../adapters/react/src/index.ts)目前为跨模块同元素组合警告 GSS2107 提供 className 属性范围；GSS2103/GSS2104 等错误没有 range。Babel parse 异常直接抛出，不会统一转换为带 range 的 GSS 诊断。
- [公共准备层](../integrations/shared/src/source-preparation.ts)保留 Compiler/Adapter 诊断；IO、resolve 和意外异常不伪装成 CSS 语法错误。准备算法不负责宿主行列转换或 overlay。不同错误通道不能假定有同一精度。

## 四宿主实际处理

| 宿主 | 当前定位与输出 | 已有证据及边界 |
| --- | --- | --- |
| Vite | [formatter](../integrations/vite/src/diagnostics.ts)仅在诊断 id 与传入源码快照相同、range 合法时生成 loc/frame；行从 1、UTF-16 列从 0 开始。保留诊断 code，按 severity 调用 error/warn/info；frame 有长度限制 | 真实 dev/build/watch 测试断言 CSS 文件、行列、frame 和 websocket error；合成测试补边界。没有据此证明浏览器 overlay 全部可视高亮或编辑器跳转 |
| Rspack | [source loader](../integrations/rspack/src/source-loader.ts)以 SourceDiagnosticError 保留 diagnostics，message 含 code/id/message；没有把 range 转成原生 loc/frame。warning 用 emitWarning，info 仅输出 message | 已有 watch/失败恢复证据；原始 range 保留不等于终端/overlay 展示行列 |
| Rsbuild | 使用 Rspack loader；薄封装没有另设诊断定位转换 | 外部 dev 探针断言 overlay 出现/消失、旧样式保留及恢复，没有断言其文件/行列/高亮 |
| webpack | [source loader](../integrations/webpack/src/source-loader.ts)与 Rspack 的诊断包装方式相同；原生宿主再包一层当前模块的构建错误 | 外部 dev 日志实际出现外层 `ERROR in ./App.tsx`、内层 GSS1001 指向 `styles/Card.gss`；该 message 无 CSS 行列。浏览器只证明 overlay 与恢复 |

Rspack/webpack 在 loader 中预编译被导入的 `.gss`，因此宿主模块标签可能是 JSX importer，并不表示 Compiler 把诊断归属改成了 JSX。两者 [主构建](../integrations/rspack/src/main-compilation.ts)的候选准备失败还会直接加入 compilation.errors，不能把所有错误都解释成同一种 loader 包装。任意 CSS 后处理器、JS/TS 或 resolver 的原生错误仍由宿主展示，不在此宣称统一定位。

Vite 使用该次处理持有的 source，而不是为生成 frame 再读取最新磁盘内容；设置 owning plugin 信息避免 CSS 位置被导入 JSX 的 map 再次映射。没有 range、快照不匹配、偏移越界或切断 surrogate pair 时不编造定位；格式化失败也不替换原诊断。上游转换后的 Adapter 输入位置不自动等于任意原始 JSX 的反向映射保证。

## 可追溯证据

| 载体 | 核对到的断言/记录 |
| --- | --- |
| [Compiler ranges 测试](../compiler/test/diagnostic-ranges.test.ts) | 原始声明/嵌套规则、LF/CRLF、两种 BOM、Unicode、inline map 误归属防护；不可靠 map-helper 范围省略 |
| [共享准备测试](../integrations/shared/test/source-preparation.test.ts) | 原 Compiler 诊断保留、Adapter range 对象保留、IO 异常不转换成 CSS 诊断 |
| [Vite formatter 测试](../integrations/vite/test/diagnostics.test.ts) | 零宽/EOF、多行半开区间、非法偏移、surrogate 边界、快照不匹配、frame 大小和 severity |
| [Vite 原生定位测试](../integrations/vite/test/diagnostic-location.test.ts) | dev/build/watch 的 GSS1001/GSS1204、CSS 不被 JSX map 重映射、失败快照不被新磁盘内容替换、过期错误不发布；GSS2107 JSX warning 非阻塞 |
| `artifacts/webpack-public/external-dev.log` | 实际 importer 外层标签与 `.gss` 内层 message；错误保留和同输入恢复通过，未输出 CSS 行列 |
| `artifacts/webpack-experiment/dev-public.mjs`、`artifacts/external-host-consumption/dev.mjs` | webpack/Rsbuild overlay attached/detached 与样式恢复断言；没有可视位置或跳转断言 |

测试源码说明已有覆盖内容，本轮没有重跑；历史运行记录和版本见 [验证账本](HOST-SUPPORT.md#验证账本与恢复入口)。artifacts 是本机证据，未因写入本报告而成为 Git 内可移植附件。

## 2026-11-04 核查时的差距

1. **内部位置尚未完整交付到 Rspack/Rsbuild/webpack 的展示层。** 即使 diagnostics 中有 range，当前 wrapper message 也没有行列/frame；webpack 历史日志证明 importer 标签容易干扰查找。代码层缺口明确，但未发现它违反已经承诺的 overlay 精度；本次不增加 formatter 或改错误 API。
2. **React 诊断的范围覆盖不一致。** GSS2107 有属性范围，部分 alias 错误仅有文件 id；不能笼统宣称 React Adapter 错误均可定位到表达式。可选范围符合当前接口，不据此自动开启覆盖扩展。
3. **证据层级不同。** Vite 原生错误对象/ws payload 有精确断言；Rsbuild/webpack 的 overlay 出现与消失不能替代位置断言。未验证跳转/可视高亮不等于已经复现错误。
4. **最终 CSS map 与诊断是两条链。** [已接受的原生处理器边界](ARCHITECTURE-DIRECTION.md)是生成规则起点可追溯；生成声明内部可能没有 mapping，不承诺每个位置均能回溯。该决定针对 Rsbuild/Rspack 最终 CSS map，不减少 Compiler 原始范围或 Vite 能力；webpack 已有 sources/sourcesContent 证据也不能升级为逐声明定位证明。

本次没有确认新的既有契约违约，不产生产品修复提交或新验收矩阵。若后续决定改善错误定位，可围绕已有的“JSX 导入错误 CSS，如何直接找到声明”具体场景限定目标；当前不把它排成已批准实施项。排序、身份/复用、fallback、React 用法和 targets 均不变。
