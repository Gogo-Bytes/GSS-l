export const scope = [
  { feature: '已知作者约束', exercised: '初稿 hover 与 pressed 背景曾被 GSS1205 拒绝；现已通过模块内原子等级支持该初稿。此页面仍保留经批准的 hover 边框、pressed 背景设计。', limitation: '原始输入已作为 atom-ranks/article-original.gss 固定并单独验收。仅限同模块当前节点、无层/条件包装的 background-color 与简单 hover/focus/等值属性；不支持任意状态或同节点跨模块优先级。' },
  { feature: '阅读与讨论', exercised: '原创中英混排文章、原生继承、嵌套有序/无序列表、引语前后伪元素；字号/色调、展开、回复、空白保护与取消焦点。', limitation: '仅本地 React 状态；无后端、持久化、富文本或既有评论编辑。刷新重置。' },
  { feature: '独立样式对照', exercised: '业务样式来自 Article.gss，通过公开 React/Vite 集成与显式 .self 引用；原生版本使用手写语义 CSS。', limitation: '共享 React 标记、内容与状态，不是独立业务实现；检查器另有明确交互预期。shell.css 只设置页面环境，不承载业务样式。' },
  { feature: '编译记录', exercised: '检查器保存真实 manifest/report、atomic/preserved 数量及 fallback 原因。', limitation: '仅当前模块和已有语法；不宣称任意 CSS 支持或体积收益。与工作台一致，隔离消费者使用通配 GSS 类型并关闭 noUncheckedIndexedAccess，不宣称逐文件类型安全。' },
  { feature: '渲染证据', exercised: 'Chromium / Firefox / WebKit 各自比较 GSS 与原生：1440/390/320px，计算样式、继承、文本/元素几何、适用伪元素和精确 RGBA；样式/几何/纯绘制负向控制与恢复。', limitation: '不比较不同引擎之间的结果；宿主字体、有限场景。伪元素无标准 DOM 矩形 API：其计算值与包含它们的区域像素受检，文本 Range 与列表缩进另检几何。没有掩膜、模糊或容差。' },
  { feature: '自动化环境', exercised: '每次配对交互前置于前台并对齐起始滚动，先记录并精确比较交互后的焦点/滚动/矩形，再对齐快照；键盘遍历与空格激活另验。', limitation: 'macOS WebKit 默认 Tab 跳过按钮，使用原生 Option+Tab；不宣称各引擎 Tab 顺序相同。早期后台页自动滚动差异与浮点坐标诊断保留在证据中，未放宽几何或像素比较。' },
  { feature: '开发与构建', exercised: '独立启动、构建、开发与生产渲染验证；运行 corepack pnpm article:check，证据在 artifacts/article-rendering。', limitation: '不重复任务看板的 HMR / lazy 专项；不代表完整 MVP 或完整无障碍验收。' }
] as const;
