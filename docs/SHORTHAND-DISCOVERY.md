# 浏览器能给 GSS 哪些 shorthand 事实？

结论：用浏览器离线审计属性写入集合，不在用户构建时启动浏览器。具体值能否改写为长手是另一个问题，不能从集合自动推出。此为调研建议，不改变 Compiler 契约。

## 不用写 CSS 解析器就能复现

在浏览器控制台执行（声明值，而非绑定到某个页面后的计算值）：

```js
function declaredLonghands(property, value) {
  const style = document.createElement('i').style;
  style.setProperty(property, value);
  return Array.from(style, name => [name, style.getPropertyValue(name)]);
}
```

本机 Chromium 145.0.7632.6 上，[CSSOM](https://drafts.csswg.org/cssom/#the-cssstyledeclaration-interface) 与 [CDP 的 `CSS.getLonghandProperties`](https://chromedevtools.github.io/devtools-protocol/tot/CSS/#method-getLonghandProperties) 对 `margin:1px 2px` 均给出四侧 1/2/1/2 px；对 `white-space:pre` 给出 `white-space-collapse:preserve`、`text-wrap-mode:nowrap`；对 `border:1px solid red` 返回 17 项，包括五个 `border-image-*` 的隐式重置。这些观测可以在不读取 GSS 登记表的情况下发现漏项，但它们只代表该浏览器版本。[CSS Text](https://drafts.csswg.org/css-text-4/#white-space-property) 还列有 `white-space-trim`，不能因 Chromium 没有返回就从 GSS 删除。

`margin:var(--space)` 在 CSSOM 中有四个名字，但各自的字符串为空，CDP 在该版本报解析错误；这不是无效 CSS，而是变量替换前不能分别求出四个值（见 [CSS Variables 的 pending-substitution](https://drafts.csswg.org/css-variables/#variables-in-shorthands)）。`all:unset` 在 CSSOM 中只有 `all`，CDP 不接受它作为 shorthandName，也不表示它只写一个属性。逻辑与物理方向是否重叠、声明组回退、浏览器目标支持、GSS scope membership 同样不是这两个 API 能回答的。

## 现有库与机器可读数据

- [Lightning CSS Rust PropertyId](https://docs.rs/lightningcss/latest/lightningcss/properties/enum.PropertyId.html) 提供 `is_shorthand`、`longhands`；[Property](https://docs.rs/lightningcss/latest/lightningcss/properties/enum.Property.html) 提供 `longhand`。当前仓库安装的 Node 1.33.0 公开 transform/visitor，而非上述通用 Rust 查询接口。实测 visitor 能分解 margin 的四侧，但 `white-space:pre` 只给 `pre`，`text-wrap:pretty` 是 `custom`，含变量的 margin 是 `unparsed`。可用于它认识的值，不能单独兜住 #65。
- [W3C Webref](https://github.com/w3c/webref) 从规范提取属性数据；[上游讨论 #1851](https://github.com/w3c/webref/issues/1851) 记录了子简写与 reset-only 遗漏问题。使用时应锁版本、展平子简写并独立验证隐式重置。[Blink 源表](https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/core/css/css_properties.json5) 与 [WebKit 源表](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/css/CSSProperties.json) 可作引擎实现对照，不直接等同于跨引擎规范。

## 可行性抽查与实施建议

沿用项目已有 mdn-data 2.27.1 的 484 个 standard 非前缀名称，每项在新 style 对象上设置 `initial`。Chromium 实测 83 项枚举到多个名称；其中 21 项有至少一个名称不在当前 `effectsOfProperty` 集合中。分母包括未登记属性，浏览器还可能暴露实现名，因此这是差异候选，不是 21 个 Bug，更不是 CSS 支持率。

建议先用上述独立观测对**已经登记为独立属性**的条目做离线审计。验收是临时还原 #65 旧分类后，无需在扫描器点名 white-space 也能检出。保留规范补充、版本和差异理由，不自动用单引擎列表覆盖 Compiler。在写入集合已知但值拆分不可靠时，保留简写并维持必要顺序；若连语义顺序都未知，不以原样 CSS 偷换 GSS ownership。该调研未验证其他引擎或 Rust 绑定。

## 复跑 #70 离线审计

从仓库根目录执行 `corepack pnpm --filter @gss-l/testing property-effects:audit`。前提是按 lockfile 安装 workspace 依赖，并已安装该版 Playwright 的 Chromium。命令先构建当前 Compiler，再对 MDN 目录的每个属性单独设置 `initial`，把枚举结果和登记分类逐项写入 `artifacts/property-effects-audit/report.json`。两个故障对照只修改比较时传入的登记：把 `white-space` 退回独立属性、从 `border` 删除五个 `border-image-*`。任一漏项未检出或当前登记丢失对应写入，命令失败。其他差异生成报告供复核，不自动失败或改表。工具只在私有测试工作区运行。

基线后已按 [CSS Text Decoration 的 text-emphasis 定义](https://www.w3.org/TR/css-text-decor-3/#text-emphasis-property) 登记 `text-emphasis-style` 和 `text-emphasis-color`。`text-emphasis-position` 独立，不被简写重置；登记写入不代表展开具体值。

[`container`](https://www.w3.org/TR/css-contain-3/#container-shorthand) 同时写入 `container-name` 和 `container-type`。例如 `container:card` 会把之前的 `container-type:inline-size` 重置为 `normal`，后代的 `@container card (min-width: …)` 不再按这个容器的宽度匹配。编译器保留简写，由浏览器解析变量值和匹配查询；这项登记不改变 `@container` 条件的配置规则。

[Motion Path 的 `offset`](https://www.w3.org/TR/motion-1/#offset-shorthand) 写入 position、path、distance、rotate 和 anchor；它不重置独立的 `translate`、`rotate`、`scale`、`transform-box` 或 `transform`。这些属性即使共同影响几何位置，也不能按同一写入互相删除。 [SVG 的 `marker`](https://www.w3.org/TR/SVG2/painting.html#MarkerProperty) 写入 start、mid 和 end；`url(#arrow)` 仍由浏览器引用文档内的标记，不拆简写值。

历史基线（mdn-data 2.27.1、Playwright 1.58.2、Chromium 145.0.7632.6）：484 项中 83 项枚举到多个名字，其中 21 项有浏览器列出而 Compiler 未登记的名字：

| 属性数 | 复核结果 |
| ---: | --- |
| 17 | 简写本身未登记，如 `container`；不能仅凭展开结果判断编译有误。 |
| 3 | `border-spacing`、`mask`、`mask-position` 的缺项全是引擎前缀名，不当成标准长手登记。 |
| 1 | `columns` 的 Level 1 登记与 [Multi-column Level 2 草案](https://drafts.csswg.org/css-multicol-2/#columns) 有差距：后者还写 `column-height`，并隐式重置 `column-wrap`。Chromium 与草案一致。实测 `.a { column-wrap:nowrap; columns:2 }` 和相反顺序都触发 `GSS1104`、保留原声明顺序，没有据此复现错误排序。 |

报告同时保留反向差异（登记有、浏览器未列出）和空观测；两者均需另查规范、引擎或具体输入。例如 `white-space-trim` 不因 Chromium 未列出而删除。名称相同也不是语义等价证明（如 `all`），此工具不判断值能否拆分、方向别名或多引擎支持。
