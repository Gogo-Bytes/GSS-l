# GSS-l

GSS-l 是一个面向构建期的受约束样式语言实验项目。

它不把 `.gss` 当作换后缀的 CSS，而是通过 `style`、`recipe`、`variant`、`slot` 和 `condition`
显式表达样式组合，由编译器生成类型化模块与原子化 CSS。

## 目标

- 在生成 class token 前确定同一属性的最终 winner，避免依赖全局 stylesheet 偶然顺序。
- 通过 slot 替代可由业务控制的 descendant selector。
- 生产环境使用中央 atomic registry 和短 class name。
- 无法证明安全或不具备体积收益时，保守生成 scoped CSS。
- 以 CSS + JavaScript 的 gzip/Brotli 总量和 computed-style parity 判断收益。

## 当前状态

项目处于架构与最小语言设计阶段，尚未承诺公共语法或生产兼容性。

相关文档：

- [架构原则](docs/architecture.md)
- [已验证经验](docs/validated-lessons.md)
- [MVP 路线](docs/mvp-roadmap.md)
