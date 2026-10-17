import React, { useState } from 'react';
import payload from 'virtual:playground-adapter';
import type { transformPlaygroundCases } from './adapter-cases.js';
import { adapterTitles } from './presentation.js';
const cases = payload as ReturnType<typeof transformPlaygroundCases>;

function OutputCode({ code }: { code: string }) {
  return <pre>{code.split('.self').map((part, index) => <React.Fragment key={index}>{index ? <mark>.self</mark> : null}{part}</React.Fragment>)}</pre>;
}
export default function AdapterExplorer() {
  const [id, setId] = useState('direct');
  const entry = cases.find((item) => item.id === id)!;
  return <section>
    <div className="page-heading"><span className="eyebrow">REACT 转换 / SOURCE TRANSFORM</span><h1>scope 引用，如何变成 class<span className="heading-dot">.</span></h1>
      <p>左边是输入，右边是转换结果。高亮的 .self 是静态 scope 到 class 字符串的显式读取。</p></div>
    <div className="catalog-toolbar"><label className="wide-choice">选择写法<select data-testid="adapter-select" value={id} onChange={(event) => setId(event.target.value)}>{cases.map((item) => <option key={item.id} value={item.id}>{adapterTitles[item.id] ?? item.title}</option>)}</select></label><span className="filter-hint">{cases.length} 个转换与边界案例</span></div>
    <div className="result-panel"><div className="result-heading"><div><span className="panel-kicker">源码转换 · 不执行渲染</span><h2>{adapterTitles[entry.id] ?? entry.title}</h2></div>
      <span className="result-status" data-testid="adapter-status" data-state={entry.boundary ? 'boundary' : entry.passed ? 'passed' : 'failed'}>{entry.boundary ? '△ 已知限制' : entry.diagnostics.length ? '✓ 已产生预期诊断' : '✓ 转换符合预期'}</span></div>
      {entry.boundary ? <div className="boundary-note">这个写法目前保持原样，也不会给出诊断。请显式使用 <code>branch.title.self</code>，不要把它当作已支持的隐式转换。</div> : null}
      <div className="code-comparison"><div><div className="code-heading"><h3>输入</h3><span>Case.tsx</span></div><pre>{entry.source}</pre></div><div><div className="code-heading"><h3>转换后</h3><span>React adapter</span></div><OutputCode code={entry.code} /></div></div>
      <p className="panel-footnote">基于已知 ScopeSchema 的静态转换。这里不证明 stock React TSX 类型检查、跨文件 provenance 或浏览器渲染。</p>
      <p className="scope-note" data-testid="adapter-mixing-note">同一 DOM 元素组合多个 GSS Module 的 class / scope 不在语义保证内，也没有跨 Module 优先级保证；请使用同一 Module：已支持的输入按 Module 内属性效果统一排序，已证明的 ownership / 结构约束优先，普通源码顺序最后裁决；这不会扩大状态冲突的准入范围。静态检测到的组合只发出 warning（警告），不是 error，不阻止编译，也不删除 class。检测仅覆盖部分静态写法：动态字符串、alias、typed prop 和任意组合函数可能逃过检测；不追踪自定义 React 组件如何转发 className；没有警告不代表安全。</p>
    </div>
    <div data-testid="adapter-diagnostics">{entry.diagnostics.length ? <div className="diagnostic-panel"><h3>转换诊断</h3>{entry.diagnostics.map((diagnostic, index) => <div className="diagnostic" key={index}><code>{diagnostic.severity} · {diagnostic.code}</code><p>{diagnostic.message}</p></div>)}</div> : null}</div>
    <details className="inspector" key={id}><summary><span>查看完整诊断与 source map</span><span className="summary-meta">开发者细节</span></summary><div className="inspector-content"><pre>{JSON.stringify({ diagnostics: entry.diagnostics, map: entry.map, boundary: entry.boundary }, null, 2)}</pre></div></details>
  </section>;
}
