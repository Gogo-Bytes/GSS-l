# MVP 路线

## 阶段 1：语言与 IR

- 冻结 `style`、`recipe`、`variant`、`slot`、pseudo 和 condition 的最小语义。
- 为禁止的 selector、未知 variant 和冲突声明提供结构化诊断。
- 建立 parser → IR 快照测试。

## 阶段 2：正确性编译器

- 实现 variant winner resolution。
- 实现 atomic identity、registry、短生产 class name 和 collision 检查。
- 实现 atomic/scoped cost planner。
- 输出 CSS、虚拟 JavaScript module、类型声明、manifest 和 report。

## 阶段 3：Vite Adapter

- 先支持单入口、开发 HMR 和生产 asset。
- 增加 recipe、slot、pseudo、media、lazy import fixture。
- 对 native reference 页面运行 computed-style diff。

## 阶段 4：真实 Pilot

选择 20～50 个代表性样式模块重写为 `.gss`，门禁为：

- 零 computed-style 差异；
- 零未解释 diagnostics；
- CSS + JavaScript gzip/Brotli 总量下降；
- 连续构建产物稳定；
- module 修改、dependency 修改和移除 import 后无 stale CSS。

## 后续阶段

只有 Compiler interface 和 Vite fixture 稳定后，才依次评估 Rsbuild、Webpack 和 Next Adapter；不同时开发多个不稳定 Adapter。
