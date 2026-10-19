# 新 session 接续提示词

将以下内容复制给新 session。具体状态以 [STATUS.md](STATUS.md) 和当前 Git 为准。

```text
请接续 GSS-l 项目，工作目录是 /Users/gan/Desktop/🥷/css-plugin/GSS-l。

先完整阅读 AGENTS.md、README.md、docs/STATUS.md、docs/NEXT-STAGE.md；检查 git status、当前分支和 origin/main 的关系。已有实现全部合入 main，后续默认直接在当前 main 工作，不自行创建分支或 worktree。发现其他会话正在修改或存在不相关改动时，先停下协调，不能覆盖、reset 或擅自 stash。

有限 MVP 已按 owner 决定结项，结项代码/测试基线 847698c，包含 React/Vite MVP、中文 Playground、task-board/article、排序修复和保守 rank 复用。最近 verify 的 1417 项测试通过；Playground 和有界 SSG/hydration 已有新一轮 Chromium 验收，具体范围见对应报告，不等于完整 SSR 或全部浏览器通过。

先用简短说明确认你理解：
1. 已交付能力和不可破坏的排序/所有权/跨模块边界；
2. Firefox Article 与性能优化均暂缓，不能自动重启；
3. 默认浏览器脚本仍可能跑三引擎，不能假设存在两引擎 skip flag；
4. 旧 worktree 已移除，证据、stash 与未提交工作的恢复位置见 STATUS.md。

owner 已明确先基本核心能力、再脚手架、最后真实 SSR 框架实验；当前不能直接接脚手架。先读 docs/CORE-AUDIT.md：已复现隐式 scope 传 string className 在严格 TSX 下报 TS2322，Adapter lowering 通过不等于类型通过，需 owner 选择保留显式 .self 或设计新类型契约。核心阶段选定门禁通过后再选脚手架/版本，后续使用真实用户路径，不新建 SSR/SSG Playground。跨文件 scope 推导及跨模块覆盖优先级已跳过，普通 className 字符串为主要用法。确认具体目标和验收范围后再实施；若需要新语义、语法、公共 API/配置或 fallback，先给具体选项和后果，不自行决定。

目标确定后，完成最小可验证改动，运行相关检查。保留独立 oracle、精确图像和原始失败证据；不通过改业务样式、弱化断言、删 fixture 或反复重试来掩盖问题。没有已知缺陷且检查通过后直接提交并推送 main，报告提交、检查范围和推送结果。未经授权不发布包、不创建 release/tag。
```
