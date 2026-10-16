// Display labels only. Capability inputs and expectations remain in their fixtures.
const families: Record<string, string> = {
  'ownership, states, conditions, assets and animations': '基础、状态与资源',
  'contextual boundary': '上下文与作用域', 'structural relations': '结构关系',
  'property-effect resets': '属性重置', 'has specificity': ':has() 优先级',
  'type-only has lists': ':has() 类型选择器', 'Compiler registered conditional keyframes': '条件关键帧',
  'has list identity': '观察列表与标识', 'Compiler nested layers': '嵌套层叠层',
  'interleaved ownership and runtime edges': '路径与运行时关系', 'Compiler layer specificity': '层叠与优先级',
  'external targets': '外部目标', 'owned external conditions': '外部类名条件',
  'external observations and functional conditions': '外部观察与函数条件',
  'Compiler compatibility stages': '兼容转换', 'custom-property inheritance': '自定义属性继承',
  'keyword animation names': '动画名称', 'readable identity isolation': '标识隔离',
  'external tag and attribute targets': '外部标签与属性目标',
  'selector syntax': '选择器基础', 'pseudo states': '伪状态', 'pseudo-elements': '伪元素',
  'runtime relations': '运行时关系', 'functional selectors': '函数选择器',
  'external integration': '外部集成', 'Compiler configuration': '独立 Compiler 配置',
  'session and output': '会话与输出', declarations: '声明与层叠',
  'property-effect inventory': '属性效果分类', resources: '资源', 'safety boundaries': '安全边界'
};
export const familyLabel = (family: string) => families[family] ?? family;

export function fixtureTitle(fixture: { name: string; family: string }) {
  const exact: Record<string, string> = {
    'asset-module-isolation-one': '本地资源的模块隔离 · 示例一',
    'asset-module-isolation-two': '本地资源的模块隔离 · 示例二',
    'asset-media-disabled-pseudo': '资源与媒体条件、disabled、伪元素',
    'keyframes-percentage-association': '百分比关键帧与动画关联',
    'unicode-string-identity-isolation': 'Unicode 字符串的标识隔离',
    'pseudo-module-isolation': '伪元素样式的模块隔离',
    'pseudo-descendant-prefix-disabled': '后代路径前缀与 disabled 伪元素',
    'ownership-module-isolation': '同名样式的模块隔离',
    'native-empty-attribute-module-isolation': '空属性值的匹配与恢复',
    'descendant-ordered-subsequence': '嵌套路径的样式累积',
    'native-current-states': '当前节点的原生状态',
    'native-ancestor-and-attribute-states': '祖先状态与等值属性',
    'repeated-source-embedding': '同一源码的重复挂载',
    'shorthand-longhand': '简写与长写的优先级',
    'child-boundary-same-source-state-reversed': '同一源码中的子元素状态 · 逆序',
    'structural-sibling-state-priority': '兄弟关系中的状态优先级',
    'structural-sibling-attribute-priority': '兄弟关系中的属性优先级',
    'structural-sibling-importance-priority': '兄弟关系中的 important 优先级',
    'structural-sibling-specificity-priority': '兄弟关系中的选择器优先级',
    'structural-mixed-suffix-implication': '混合结构关系的后缀约束',
    'structural-observed-observed-specificity': '两个观察条件的选择器优先级',
    'structural-observed-structural-specificity': '观察与结构条件的选择器优先级',
    'structural-observed-observed-important': '两个观察条件的 important',
    'structural-observed-structural-important': '观察与结构条件的 important',
    'font-shorthand-resets-font-variant': 'font 简写重置 font-variant',
    'font-variant-after-font-shorthand': 'font 简写之后的 font-variant',
    'important-font-variant-survives-font-shorthand': 'important font-variant 不被简写覆盖',
    'disjoint-registered-width-keyframes': '互斥宽度条件中的关键帧',
    'external-descendant-anchored-dynamic-class': '带锚点的外部后代 · 动态类名',
    'external-descendant-owned-ancestor-specificity': '外部后代与 owned 祖先的优先级',
    'external-descendant-registered-media-layer': '外部后代与已注册媒体条件、层叠层',
    'external-descendant-compound-class': '外部后代的复合类名',
    'owned-node-external-class-condition': 'owned 节点上的外部类名条件',
    'same-node-refinement-base-first': '同一节点的外部条件 · 基础声明在前',
    'same-node-refinement-condition-first': '同一节点的外部条件 · 条件声明在前',
    'observed-external-descendant-class': '观察外部后代的类名',
    'functional-external-owned-conditions': '函数选择器中的外部 owned 条件',
    'host-target-indivisible-flex-sequence': '兼容转换中的完整 flex 声明序列',
    'host-target-layered-media-sequence': '带层叠与媒体条件的兼容序列',
    'host-target-preserved-media-isolation': '整模块保留后的媒体条件隔离',
    'host-target-asset-property-resource': '兼容转换中的 Asset 与 @property',
    'registered-property-inheritance-and-module-isolation': '@property 的继承与模块隔离',
    'keyword-like-keyframe-explicit-longhand': '关键字式动画名称的显式长写',
    'scope-source-path-separator-isolation': 'scope 源路径分隔符的标识隔离',
    'external-tag-attribute-owned-anchor': '外部标签、属性与 owned 锚点',
    'external-attribute-css-escape-value': '外部属性值中的 CSS 转义'
  };
  const name = fixture.name;
  if (exact[name]) return exact[name];
  const order = /(?:reverse|reversed)(?:$|-)/.test(name) ? '逆序' : '正序';
  if (/^(registered-(media|supports|container)|native-layers|nested-layers|cross-layer-specificity)-/.test(name)) {
    const category = name.startsWith('registered-') ? `已注册 ${name.split('-')[1]} 条件`
      : name.startsWith('native-') ? '原生层叠层' : name.startsWith('nested-') ? '嵌套层叠层' : '跨层选择器优先级';
    return `${category} · 源码${/(?:reverse|reversed)-source/.test(name) ? '逆序' : '正序'} / 配置${/(?:reverse|reversed)-config/.test(name) ? '逆序' : '正序'}`;
  }
  if (name.startsWith('layer-registered-media-')) return `层叠层中的已注册 media 条件 · ${order}`;
  if (name.startsWith('keyframes-module-isolation-')) return `同名关键帧的模块隔离 · ${order}`;
  if (name.startsWith('pseudo-authored-priority-')) return `伪元素声明优先级 · ${order} / ${name.endsWith('important') ? 'important' : '普通声明'}`;
  if (name.startsWith('descendant-cascade-')) return `后代样式的层叠 · ${order}`;
  if (name.startsWith('observed-boundary-')) return `${name.includes('-checked-') ? ':has(:checked)' : ':has() 类名观察'} 边界 · ${name.includes('-without-') ? '无附加条件' : '带无关条件'}`;
  if (name.startsWith('child-boundary-')) return `子元素关系边界 · ${name.includes('-without-') ? '无附加条件' : name.includes('-with-') ? '带无关条件' : `${order} / ${name.endsWith('importance') ? 'important' : '选择器优先级'}`}`;
  if (name.startsWith('structural-sibling-')) return `兄弟关系${name.includes('-state-') ? '与状态' : name.includes('-attribute-') ? '与属性' : '基础匹配'} · ${order}`;
  if (name.startsWith('structural-unrelated-shared-effect-')) return `无关结构共享属性效果 · ${name.endsWith('single-Module') ? '单一 Module' : order}`;
  if (name.startsWith('structural-equal-specificity-intersection-')) return `等优先级结构条件的交集 · ${order}`;
  if (name.startsWith('has-selector-list-shared-branch-')) return `:has() 列表共享分支 · ${name.includes('-reversed-list-') ? '规则逆序' : '规则正序'} / ${name.includes('-weaker-') ? '弱项在前' : '强项在前'}`;
  if (name.startsWith('has-selector-list-specificity-')) return `:has() 列表的选择器优先级 · ${order}`;
  if (name.startsWith('has-type-only-list-')) return `:has() 的纯类型列表 · ${order}`;
  if (name.startsWith('interleaved-owned-descendant-')) {
    const shape = name.includes('-general-root-') ? '一般兄弟起点' : name.includes('-general-prefix-') ? '一般兄弟前缀'
      : name.includes('-child-root-') ? '子元素起点' : name.includes('-child-prefix-') ? '子元素前缀'
      : name.includes('-deep-') ? '深层后代' : name.includes('-prefix-') ? '路径前缀' : '后代路径';
    return `ownership 与 runtime 交错 · ${shape} / ${order}`;
  }
  return `${familyLabel(fixture.family)} · ${name}`;
}
const compilerNames: Record<string, string> = {
  'ownership-nesting': '嵌套语法与 ownership 路径', 'selector-list': '选择器列表的独立分支',
  'nested-selector-list': '拒绝尚不支持的列表嵌套组合', 'equality-attributes': 'data / ARIA 等值条件',
  'observed-relations': ':has() 的观察目标', 'external-targets': '带锚点的外部类名目标',
  'external-tag': '外部标签目标', 'external-attribute': '外部等值属性目标',
  'same-node-global': 'owned 节点上的外部条件', 'conditions-layers': '注册条件与嵌套层叠层',
  'session-lifecycle': '替换、回滚、共享与清理', 'identity-paths': 'Unicode 与转义路径的隔离',
  'unregistered-warning': '未注册条件的警告', 'importance-effects': '简写、长写与 important',
  'custom-property-resource': '自定义属性与全局注册', 'font-face': '字体资源的编译结构',
  keyframes: 'Module-local 动画名称与引用', 'conditional-keyframes': '互斥宽度条件下的关键帧',
  compatibility: '目标驱动的兼容声明序列', 'property-fallback': '整 Module 保留回退',
  'strict-property': '严格模式拒绝未知属性效果', 'duplicate-property': '重复属性：拒绝并保留旧快照',
  'local-compound': '拒绝未支持的本地复合类名', 'external-existence': '拒绝延期的外部属性存在目标',
  'logical-physical-overlap': '拒绝运行时方向相关的属性冲突',
  'multiple-runtime-witnesses': '拒绝多个交错 runtime witness', 'keyword-shorthand': '拒绝有歧义的动画简写'
};
export function compilerTitle(entry: { id: string; title: string }) {
  if (entry.id.startsWith('effect-')) return `属性效果分类 · ${entry.id.slice(7)}`;
  if (entry.id.startsWith('state-')) return `当前节点 · :${entry.id.slice(6)}`;
  if (entry.id.startsWith('ancestor-')) return `祖先节点 · :${entry.id.slice(9)}`;
  if (entry.id.startsWith('pseudo-')) return `伪元素 · ::${entry.id.slice(7)}`;
  if (entry.id.startsWith('functional-')) return `函数条件 · :${entry.id.slice(11)}()`;
  if (entry.id.startsWith('relation-')) return ['子元素关系 · >', '相邻兄弟 · +', '后续兄弟 · ~'][Number(entry.id.slice(9))] ?? entry.title;
  return compilerNames[entry.id] ?? entry.title;
}
export const adapterTitles: Record<string, string> = {
  direct: '直接引用静态路径', composition: '保留外部 class 组合', 'direct-alias': '局部不可变 alias',
  'conditional-alias': '全 scope 的条件分支', 'destructured-alias': '从已知 scope 解构属性',
  'local-typed-prop': '本地类型别名与 typed prop', 'inline-typed-prop': '内联 typed prop',
  'props-member': '直接读取 props.scope', 'explicit-self': '显式 .self 不会重复转换',
  'cross-module-warning': '同一元素跨 Module 组合：警告而非错误',
  'unknown-path': '未知路径的诊断', 'mutable-alias': '可变 alias 的诊断',
  'mixed-alias': 'scope / 字符串混合分支的诊断', 'string-coercion': '隐式字符串强制转换的诊断',
  'alias-member-boundary': '已知限制：alias 成员不会自动转换'
};
