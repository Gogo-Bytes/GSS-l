# 核心能力盘点与处理顺序

## 范围

owner 已修正阶段顺序：先基本核心能力，再脚手架，最后常见 SSR 框架实验。本轮基线 `529fd5e`，核对公开类型、实现、回归与此前验收；不把检查通过等同于全面证明，不恢复历史路线图，不启动性能或 Firefox Article。

## 首要发现：隐式 className lowering 与 TypeScript 不是一回事

之前对话中将 `<Child className={styles.title} />` 描述为普通字符串传递的完整现有能力，需纠正；本轮已实现一个最小语法糖修复，但仍保留明确边界：

- Adapter 能在 JSX/TSX 源码中将它 lowering 为 `.self`；现在生成的 GSS 引用类型也可赋给 `string`。
- `packages/types/src/index.ts` 使用带 brand、兼容 `.self` 和递归子路径的编译期 `string & children` 引用；`packages/types/test/` 与 `packages/vite/test/consumer/` 已覆盖直接 string 赋值。
- React Adapter 已对直接静态 GSS 路径在普通表达式上下文做最小 lowering；普通函数、`window`／`document` 和模板字符串回归已覆盖。变量 alias 初始化、JSX 属性和既有 typed-prop/alias 流程仍按原有边界处理。
- 这不是完整 alias/data-flow lowering：变量声明、可变 alias、跨文件传播仍沿用既有诊断／边界；旧 `.self` 写法保持兼容。

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
| 消费类型及 string className | `packages/types/test/`、父／子转换回归 | 显式 `.self` 可用；隐式 TSX 需要产品决定 |
| Vite dev 更新、错误恢复、资源 watch | `dev-css`、`dev-assets`；Playground、Task-board 浏览器记录 | 已有有界覆盖；class mapping 更新允许 reload，不默改为状态保留 |
| Vite production 全量 census 与元数据 | `production-css`、`production-assets` | 已有回归；独立打包安装属于第二步，不提前接脚手架 |

## 处理顺序

1. **先决定类型使用契约**：A/B；随后把真实类型检查纳入相应回归与文档，而非仅检查转换字符串。
2. **再补核心生命周期浏览器缺口**：普通父／子 string className 的真实渲染、删除／重建 `.gss` 的恢复；在已有测试载体补断言，不新增脚手架。先核对入口和引擎，保留失败证据。
3. **遇到已支持语义反例再修复**：建立最小复现与独立预期，最小修改、回归、相关 gate；不为填表扩语义。
4. **核心阶段达到选定门禁后**，再由 owner 选择脚手架／版本，最后进行真实 SSR 框架实验。

跨文件 scope 类型推导、跨模块覆盖优先级仍跳过；历史 SSR／router 全量覆盖不作为核心阶段自动任务。
