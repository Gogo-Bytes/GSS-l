# 核心能力盘点与处理顺序

## 范围

owner 已修正阶段顺序：先基本核心能力，再脚手架，最后常见 SSR 框架实验。本轮基线 `529fd5e`，核对公开类型、实现、回归与此前验收；不把检查通过等同于全面证明，不恢复历史路线图，不启动性能或 Firefox Article。

## 首要发现：隐式 className lowering 与 TypeScript 不是一回事

之前对话中将 `<Child className={styles.title} />` 描述为普通字符串传递的完整现有能力，需纠正：

- Adapter 能在 JSX/TSX 源码中将它 lowering 为 `.self`；现有父／子独立转换回归通过。
- 但 TypeScript 检查的是原始源码，不读取 Adapter 的转换结果。子组件参数为 `className?: string` 时，`GssScope` 不可赋值，报 TS2322。
- `packages/types/src/index.ts` 明确将 scope 定义为带 brand 的对象；`packages/types/test/gss-scope.test-d.ts` 通过 `@ts-expect-error` 明确保护“scope 不是 string”。
- Playground 的 TSX 可视示例使用显式 `.self`，隐式演示在 JSX 中；不能把其通过说成隐式 TSX 类型体验已闭环。

本轮用 TypeScript Compiler API、strict + react-jsx + NodeNext，以虚拟 TSX 源文件复现，不写入工作区：

```tsx
import type { GssScope } from '../../types/src/index.js';
declare const styles: { title: GssScope };
function Child(props: { className?: string }) {
  return <div className={props.className} />;
}
const implicit = <Child className={styles.title} />; // TS2322
const explicit = <Child className={styles.title.self} />; // 通过
```

结果只有 implicit 一处 TS2322。这是**已复现的源码类型体验限制及此前表述／覆盖遗漏**，不是编译器丢样式，也不是新的跨文件推导需求。

### 需要 owner 决策

- **A：保留对象类型契约**。TSX 使用显式 `.self`，JSX 可隐式 lowering；补明确使用说明与类型回归。最小风险，无新运行时或公共类型承诺。
- **B：要求严格 TSX 也能直接传 scope 给 string className**。先设计类型／工具链契约，不能直接把真实对象伪装成 string，也不能把所有 className 改成宽类型或用断言绕过检查；需要单独评估与授权。

建议先选 A 收敛基本能力；若隐式 TSX 是核心产品目标则选 B，不能以“已有转换”宣称已解决。

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
