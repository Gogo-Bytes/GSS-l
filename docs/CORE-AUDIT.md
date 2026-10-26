# 核心能力盘点与处理顺序

## 范围

本文保留 `529fd5e` 起的核心类型发现及后续修复事实；当前交付基线为 `4b7a982`，进度与后续顺序以 [当前计划](NEXT-STAGE.md) 为准。核心、已选脚手架和 Framework SSR 已完成，owner 已停止新增框架／验收场景。下列历史发现不是重新选型或扩功能的任务队列。

## 首要发现：隐式 className lowering 与 TypeScript 不是一回事

之前对话中将 `<Child className={styles.title} />` 描述为普通字符串传递的完整现有能力，需纠正；本轮已实现一个最小语法糖修复，但仍保留明确边界：

- Adapter 能在 JSX/TSX 源码中将它 lowering 为 `.self`；现在生成的 GSS 引用类型也可赋给 `string`。
- `packages/types/src/index.ts` 使用带 brand、兼容 `.self` 和递归子路径的编译期 `string & children` 引用；`packages/types/test/` 与 `packages/vite/test/consumer/` 已覆盖直接 string 赋值。
- React Adapter 已对直接静态 GSS 路径在普通表达式上下文做最小 lowering；普通函数、`window`／`document` 和模板字符串回归已覆盖。变量 alias 初始化、JSX 属性和既有 typed-prop/alias 流程仍按原有边界处理。
- 这不是完整 alias/data-flow lowering：可变 alias、跨文件传播仍沿用既有诊断／边界；不可证明的动态／未知路径按 owner 决定保留普通 JS 的 `undefined` 行为，不额外报错；本轮新增了不可变条件 alias 的静态目标读取（如 `branch.title`）展开；旧 `.self` 写法保持兼容。

在实现前，本轮曾用 TypeScript Compiler API、strict + react-jsx + NodeNext，以虚拟 TSX 源文件复现，不写入工作区；随后用仓库 pinned TypeScript 验证了最小类型修改：

```tsx
import type { GssScope } from '../../types/src/index.js';
declare const styles: { title: GssScope };
function Child(props: { className?: string }) {
  return <div className={props.className} />;
}
const implicit = <Child className={styles.title} />; // TS2322
const explicit = <Child className={styles.title.self} />; // 通过
```

原始结果只有 implicit 一处 TS2322；现已通过递归字符串引用类型消除该类型错误。这不是把运行时对象伪装成普通公共对象，而是要求 GSS Adapter 在运行前完成 lowering。

owner 随后决定采用“编译期语法糖 + 轻量 TS 兼容类型”：直接静态引用不要求用户写 `.self`，Adapter 在运行前 lowering，TypeScript 只需不报错，不追求精确补全。双 Symbol 研究见 [Symbol／点路径研究](SYMBOL-PATH-RESEARCH.md)；Symbol 仅可作为内部存储细节，未作为公共语义。

## 核心能力矩阵

| 核心契约 | 当前证据 | 判定与下一步 |
| --- | --- | --- |
| 解析、正向准入与不安全输入拒绝 | `parser-boundary`、`postcss-stylesheet-parser`、`external-target` 等测试 | 有界支持有回归；未定位新违约缺陷，不自动扩语法 |
| 所有权、结构与同模块排序 | `descendant-conditions`、`structural-relations`、`fixed-module-ranks`、`logical-physical-order` | 保留来源身份、原生层叠强度及既有语义；独立 fixture 不等于全部组合覆盖 |
| rank 复用 | `fixed-module-rank-reuse` | 已有保守门禁；不开展性能扩展 |
| 会话事务、回滚、回收、finalize | `compiler-session`、`session-convergence` | 已有公有会话回归；无本轮新复现失败 |
| 原子化与整模块 fallback | `compiler-session`、`compatibility-targets` | 已有有界覆盖；不能逐规则混合 fallback 或默默扩大范围 |
| 资源／URL／source map／来源 | `stylesheet-assets`、`conditional-keyframes`、`css-source-map`、`source-map-annotations`、`diagnostic-ranges` | 有界实现与证据；完整 token 映射和所有诊断位置不在当前承诺 |
| React 引用、alias、诊断、source map | React 三组测试；Adapter 目录 | 有界支持；隐式 TSX 类型体验见首要发现，不能只查转换输出 |
| 消费类型及 string className | `packages/types/test/`、父／子转换及真实 Task-board／外部模板回归 | 隐式字符串语法糖已决定并交付，旧 `.self` 兼容；不重新选型 |
| Vite dev 更新、错误恢复、资源 watch | `dev-css`、`dev-assets`；Playground、Task-board 浏览器记录 | 已有有界覆盖；class mapping 更新允许 reload，不默改为状态保留 |
| Vite production 全量 census 与元数据 | `production-css`、`production-assets`、`stylesheet-url` 及外部框架报告 | 已有公开 tarball 外部消费、Vite 8 和有界真实 SSR 证据；不外推任意 client/server graph |

## 处理顺序

类型契约与父子字符串路径已完成；`.gss` 删除明确不纳入支持契约。后续按 [当前计划](NEXT-STAGE.md#后续工作顺序) 核对现有 property effects 和 selector marker 的一致性，先复现再修复，复用已有回归。不重做类型决策、不新增框架或验收矩阵。

跨文件 scope 类型推导、跨模块覆盖优先级仍跳过；未覆盖组合不自动成为实现任务。
