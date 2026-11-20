# GSS-l

GSS-l 把 `.gss` 样式表编译成 CSS，让 React 组件按静态路径选类名：`styles.card.title` 是卡片标题的 class 字符串，可以直接传给 `className`。如果你想用联级写法组织组件样式，又不希望一个元素只因放进某张卡片就自动换样式，可以先试下面的 Playground。

**当前是未发布的 MVP。** 从源码即可试用；已有 Vite、Rspack、Rsbuild 和 webpack 集成，但不保证任意 CSS 都能原子化，也不保证所有宿主配置都能接入。[查看已验证的宿主和版本](docs/HOST-SUPPORT.md)。

## 快速开始

准备 Git、Node.js 和 Corepack。仓库要求 Node.js ≥ 20.19.0，推荐使用已验证的 22.22.3；在仓库目录中由 Corepack 选择锁定的 pnpm 8.6.2。若 `pnpm` 不在 PATH，先运行 `corepack enable pnpm`，因为仓库脚本也会调用它。

```sh
git clone https://github.com/Gogo-Bytes/GSS-l.git
cd GSS-l
corepack pnpm install --frozen-lockfile
corepack pnpm playground
```

打开终端打印的本地地址。在「样式切换」场景里，卡片标题起初是红色；点击「切换选中态」变蓝，再点击「换一组样式」变绿。前一次点击改变 DOM 属性，后一次改用另一条样式路径。按 `Ctrl+C` 停止服务。

## 写一张卡片

下面是该场景的红／蓝两态，摘自 [Live.gss](examples/playground/Live.gss) 和 [LiveDemo.tsx](examples/playground/LiveDemo.tsx)，省略了第三种配色和页面控件。

`Live.gss`：

```css
.card { padding: 16px; background-color: white; }
.card .title { color: red; }
.card[data-active="yes"] .title { color: blue; }
```

```tsx
// Card.tsx，与 Live.gss 同目录
import { useState } from 'react';
import styles from './Live.gss';

function Title({ className }: { className: string }) {
  return <h2 className={className}>卡片标题</h2>;
}

export function Card() {
  const [active, setActive] = useState(false);
  return (
    <section className={styles.card} data-active={active ? 'yes' : 'no'}>
      <Title className={styles.card.title} />
      <button onClick={() => setActive(!active)}>切换选中态</button>
    </section>
  );
}
```

**先选路径，再判断 DOM 条件。** `styles.card.title` 选中 `.card .title` 的红色；这条纯路径规则不要求真实的卡片祖先。蓝色规则不同：浏览器还要找到带 `styles.card` 类名和 `data-active="yes"` 的真实祖先。切换状态时不必替换标题的 class。

如果再声明 `.title { font-weight: bold }`，`styles.card.title` 会组合浅层的粗体和深层的红色；单用 `styles.title` 只能取得浅层样式，即使这个标题恰好渲染在卡片里。`Title` 收到的是字符串，不是样式节点：需要标题类名就传 `styles.card.title`，不要先传 `styles.card` 再让子组件取 `.title`。[路径与 DOM 的设计说明](docs/ARCHITECTURE-DIRECTION.md#scope-path-selection)

## 接入项目

- **React + Vite：** 在现有 Vite React 插件旁配置 `gss({ adapter: gssReact() })`。包尚未发布；要在仓库外试用，按 [React TS 模板接入指南](docs/VITE-TEMPLATE-ACCEPTANCE.md) 从本地 tarball 安装。服务端渲染另见 [React Router Framework SSR](docs/FRAMEWORK-SSR-ACCEPTANCE.md)。
- **Rspack、Rsbuild、webpack：** 使用各自的 [Rspack](integrations/rspack/README.md)、[Rsbuild](integrations/rsbuild/README.md)、[webpack](integrations/webpack/README.md) 配置。不要把 Vite 专属的虚拟 CSS URL 搬到其他宿主。
- **TypeScript：** 消费项目直接声明开发依赖 `@gss-l/types`，在环境声明文件中添加 `/// <reference types="@gss-l/types/client" />`。已有 Vite 项目也可用 `@gss-l/vite/client`。这是通用声明，不提供逐文件路径补全或拼写诊断。

## 了解设计

| 想了解什么 | 从这里读起 |
| --- | --- |
| 样式如何变成 CSS？ | [Compiler 设计入口](compiler/src/domain/README.md)：框架无关的核心绑定路径、处理声明；[排序与复用](docs/PROPERTY-ORDER-DESIGN.md)解释哪些声明可以共享 atom，哪些必须保留顺序。 |
| 哪些 CSS 能写？ | [CSS 能力边界](docs/CSS-CAPABILITY-AUDIT.md)和[回退策略](docs/ARCHITECTURE-DIRECTION.md#preserved-fallback-贡献边界)：区分已支持的转换、保留原声明和无法保证语义时的拒绝。 |
| JSX 为什么能直接传字符串？ | [React 引用契约](docs/ARCHITECTURE-DIRECTION.md#react-引用与-typescript-契约)：适配器在引用所在文件转换静态路径，不跨组件追踪样式节点，也不支持用 `styles[variant]` 动态选路径。 |
| 生成的 CSS 如何加载？ | [宿主支持清单](docs/HOST-SUPPORT.md)：开发更新、生产提取和资源加载由宿主集成处理。开发与生产类名不同，SSR 与客户端应使用一致的命名模式。 |

同一模块的多个类名可以组合；不保证同一元素上不同 GSS 模块之间的覆盖顺序。更多完整页面可用 `corepack pnpm task-board` 或 `corepack pnpm article` 启动。

## 反馈与贡献

[GitHub Issues](https://github.com/Gogo-Bytes/GSS-l/issues) 跟踪缺陷和后续工作。报告样式问题时，请附上最小 `.gss`、实际使用的 JSX 路径、宿主与版本，以及期望和实际效果。

修改代码前阅读[仓库协作规范](AGENTS.md)。`corepack pnpm verify` 运行 lint、构建、单元测试与类型检查，**不含浏览器验收**；按改动范围选择[验证入口](docs/VALIDATION-EVIDENCE.md)。维护交接见 [HANDOFF](docs/HANDOFF.md)。
