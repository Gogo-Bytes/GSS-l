# 新 session 接续提示词

将以下内容复制给新 session。具体状态以 [STATUS.md](STATUS.md) 和当前 Git 为准。

```text
请接续 GSS-l 项目，工作目录是 /Users/gan/Desktop/🥷/css-plugin/GSS-l。

先完整阅读 AGENTS.md、README.md、docs/STATUS.md；检查 git status、当前分支和 origin/main 的关系。已有实现全部合入 main，后续默认直接在当前 main 工作，不自行创建分支或 worktree。发现其他会话正在修改或存在不相关改动时，先停下协调，不能覆盖、reset 或擅自 stash。

当前交付基线是 081601a：React/Vite MVP、中文 Playground、task-board/article 独立原生参考、模块内固定排序、逻辑/物理属性排序修复和保守 rank 复用。基线 verify 的 1416 项测试通过，但这不是新一轮浏览器验收，也不覆盖未来修改。

先用简短说明确认你理解：
1. 已交付能力和不可破坏的排序/所有权/跨模块边界；
2. Firefox Article 与性能优化均暂缓，不能自动重启；
3. 默认浏览器脚本仍可能跑三引擎，不能假设存在两引擎 skip flag；
4. 旧 worktree 已移除，证据、stash 与未提交工作的恢复位置见 STATUS.md。

当前没有批准的下一项实现任务。请先询问我这轮要推进的具体目标和验收范围；若我已经提供目标，则评估它是否需要新产品语义、语法、公共 API/配置或 fallback 决策，需要时先给具体选项和后果，不自行决定。不要把历史路线图当作执行队列。

目标确定后，完成最小可验证改动，运行相关检查。保留独立 oracle、精确图像和原始失败证据；不通过改业务样式、弱化断言、删 fixture 或反复重试来掩盖问题。没有已知缺陷且检查通过后直接提交并推送 main，报告提交、检查范围和推送结果。未经授权不发布包、不创建 release/tag。
```
