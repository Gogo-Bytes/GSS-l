# Playground 范围与覆盖核对

## 定位与结论

Playground 是交互式能力演示／调试台，也是一个有真实 React/Vite 集成的单页应用；不是完整业务 Pilot，也不承诺覆盖全部 CSS 语义组合。

本轮在 `677cc18` 代码基线上核对案例目录、实际断言，并首次运行 `corepack pnpm playground:check` 通过。**按现有演示台定位，主要范围已有覆盖，未发现本轮必须修复的缺口。** 不因此引入 router 或扩大产品语义。

入口：`packages/testing/playground/check.mjs`。默认仅 **Chromium**，先在临时副本运行 dev，再 build/preview；HMR 探针不修改作者源码。此轮此前没有 `artifacts/playground/` 旧目录，未覆盖旧产物。

## 实际覆盖

| 范围 | 案例／断言与本轮结果 |
| --- | --- |
| 六组可视化演示 | 状态与别名、hover／键盘 focus／disabled、结构与 observed 关系、外部 class、资源与 lazy、JSX 隐式 self；dev 和 preview 均通过 |
| 场景生命周期 | 验证切换后旧场景卸载而不是隐藏；reset 恢复指定状态；源码面板默认收起／按需展开 |
| 资源与生产集成 | 图片 decode 为 72×40；仅一个 GSS stylesheet link；lazy 组件可加载，生产 manifest v2 包含 Lazy.gss |
| 浏览器 fixture 浏览器 | dev、preview 各全跑 123 个案例／1260 项对比并通过；包含 phase 选择、搜索、无匹配时保留选择 |
| Compiler-only 目录 | 114 个有界案例；生成目录时每项校验预期 atomic／preserved／rejected，失败即抛错；session lifecycle 校验资源共享、回收、回滚与收敛。浏览器额外抽查拒绝回滚和 conditional keyframes 的 compiler-only 标签 |
| React Adapter 目录 | 15 个案例；检查可展示转换、诊断及已知限制。浏览器抽查 mutable alias、GSS2107 warning、条件 alias 目标路径展开；不能把目录展示等同于真实组件运行 |
| 开发更新与错误恢复 | 临时副本修改 Live.gss 后颜色更新；重复属性触发 overlay，保留有效颜色；恢复后 overlay 消失且颜色恢复 |
| 单页导航与布局 | 四个区块、六个场景；区块切换滚动归零；生产模式 320／390／768／1440 宽度无页面横向溢出 |
| 辅助文字可读性 | 生产桌面态指定 UI 辅助文字 4.5:1 对比度，并有刻意降低对比度的负对照；不是完整无障碍审计 |
| 错误收集 | `pageErrors: []`；HMR 错误由 overlay 断言确认，不要求一定出现 pageerror |

目录数量及部分内容另由 `packages/testing/test/playground.test.ts` 核对。Compiler-only 114 和 Adapter 15 不能加到浏览器效果案例数中。

## 边界与剩余覆盖机会

- 仅本轮 Chromium 结果，不能推导 Firefox／WebKit 通过。
- 当前 123 个内嵌 fixture 是有界集合，不代表仓库所有后续排序、逻辑／物理属性与 rank 复用 gate；这些由独立测试及专项脚本负责。
- HMR 断言检查最终颜色、overlay 与恢复，未检查 document identity 或 React 状态保留；后者不能据此宣称通过，也不是当前必须新增的语义。
- 未覆盖真实浏览器中的 `.gss` 删除／重建；已有 Vite server 回归与此不同。
- 界面使用预置案例，不是任意源码编辑器；没有自由编辑并非实现遗漏。
- 场景切换是单页交互而非 URL router 验收，不要求为演示台增加路由。
- 截图用于留证，没有独立图像基线精确比较；本 gate 不等同于 Task-board／Article 的图像验收。
- 不验证完整无障碍、所有键盘路径、全部资源／条件／伪元素交叉组合或任意宿主应用。

## 本机证据

`artifacts/playground/result.json`：`passed: true`，dev/production 均通过。截图：`dev.png`、`preview.png`、`redesign-desktop.png`、`redesign-mobile.png`；命令日志：`/tmp/gss-l-playground-scope-check.log`。产物为本机证据，不作为包发布内容。

本轮仅整理覆盖结论，未改生产代码、测试断言或浏览器默认引擎。
