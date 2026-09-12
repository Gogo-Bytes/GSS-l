# 已验证经验

本项目参考 GSS 原型在 Vite、Rsbuild、Webpack fixture 和真实 Notta 项目中的验证结果，但不直接继承其兼容架构。

## 可复用能力

- 基于 PostCSS 与 selector AST 的结构化处理方式。
- atomic identity 对 selector、property、value、importance 和 condition 的完整建模。
- pseudo、attribute、`@media`、`@supports` 的安全判定与渲染经验。
- shorthand/longhand、重复属性和 declaration 顺序测试。
- class collision、token/CSS closure 和确定性产物校验。
- manifest、risk/benefit/size report 和 computed-style 对照方法。
- dev 单一 style owner、generation 防旧结果回写和 HMR 最终状态检查。

## 不继承的设计

- CSS Modules 编译后的反向语义恢复。
- 永久保留全部 semantic scoped class。
- 独立 loader 所需的固定 25 位 keyed class name。
- 依赖全局 atomic stylesheet 顺序恢复 base/modifier winner。
- 允许任意 selector 后再以大量 fallback 收尾的语言模型。

## 真实项目证据

Notta H5 试验中：

- declaration reuse ratio 为 `0.7812`；
- preserved CSS ratio 为 `0.5282`；
- class string 估算增加 111,078 B；
- CSS raw 减少 26.38%，但 CSS gzip 增加 12.12%、Brotli 增加 21.04%；
- 全部署产物 gzip 增加 1.90%、Brotli 增加 1.46%；
- base class 与 active class 在同一节点共存时，global atomic order 改变了最终文字颜色。

这些结果证明：复用率和 raw CSS 下降都不是充分收益条件；语言必须显式表达组合语义，并把 JavaScript token 成本纳入 planner。

## Adapter 经验

自定义语言不会消除 Adapter，但能缩小 Adapter interface：

- Vite/Rsbuild/Webpack/Next 仍分别拥有模块图、HMR、chunk 和 HTML/SSR 生命周期；
- Compiler 必须独立于具体构建工具；
- Next 需要专用 Adapter，不能把标准 Webpack 生命周期视为 Next 生命周期。
