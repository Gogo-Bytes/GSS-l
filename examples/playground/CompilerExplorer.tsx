import React, { useState } from 'react';
import payload from 'virtual:playground-compiler';
import type { compilePlaygroundCases } from './compiler-cases.js';
import { compilerTitle, familyLabel } from './presentation.js';
const compilerCases = payload as ReturnType<typeof compilePlaygroundCases>;

export default function CompilerExplorer() {
  const [id, setId] = useState('ownership-nesting');
  const [query, setQuery] = useState('');
  const entry = compilerCases.find((item) => item.id === id)!;
  const matches = compilerCases.filter((item) => `${item.id} ${item.title} ${compilerTitle(item)} ${familyLabel(item.family)}`.toLowerCase().includes(query.toLowerCase()));
  const filtered = matches.some((item) => item.id === id) ? matches : [entry, ...matches];
  const families = [...new Set(compilerCases.map((item) => item.family))];
  const resultLabel = entry.expected === 'rejected' ? '已按预期拒绝' : entry.expected === 'preserved' ? '已按策略保留整模块' : '原子编译通过';
  return <section aria-label="Compiler-only inventory">
    <div className="page-heading"><span className="eyebrow">编译与诊断 / COMPILER ONLY</span><h1>看清输入，也看清边界<span className="heading-dot">.</span></h1>
      <p>查看一个写法如何编译，或为什么被拒绝。拒绝案例还会检查上一份有效快照是否完整保留。</p></div>
    <div className="catalog-toolbar"><label>搜索案例<input aria-label="搜索编译案例" value={query} placeholder="试试：嵌套、hover、重复属性…" onChange={(event) => setQuery(event.target.value)} /></label>
      <label className="wide-choice">选择案例<select data-testid="compiler-select" value={id} onChange={(event) => setId(event.target.value)}>{families.map((family) =>
        <optgroup label={familyLabel(family)} key={family}>{filtered.filter((item) => item.family === family).map((item) => <option key={item.id} value={item.id}>{compilerTitle(item)}</option>)}</optgroup>)}</select></label></div>
    <p className="filter-hint">{matches.length} / {compilerCases.length} 个案例{!matches.some((item) => item.id === id) ? ' · 已保留当前选择' : ''}</p>
    <div className="result-panel"><div className="result-heading"><div><span className="panel-kicker">{familyLabel(entry.family)}</span><h2>{compilerTitle(entry)}</h2></div>
      <span className="result-status" data-testid="compiler-status" data-state={entry.passed ? 'passed' : 'failed'} data-level={entry.level} data-expected={entry.expected} data-committed={String(entry.committed)} data-rollback={entry.rollback === null ? 'n/a' : String(entry.rollback)}>✓ {resultLabel}</span></div>
      <div className="result-metrics"><div><span>处理方式</span><strong>{entry.expected === 'rejected' ? '拒绝本次输入' : entry.expected === 'preserved' ? '整模块保留' : '原子化'}</strong></div><div><span>本次已提交</span><strong>{entry.committed ? '是' : '否'}</strong></div><div><span>旧快照检查</span><strong>{entry.rollback === null ? '无需回滚' : entry.rollback ? '完整保留' : '未保留'}</strong></div></div>
      <div className="source-panel"><div className="code-heading"><h3>输入 .gss</h3><span>{entry.id}</span></div><pre>{entry.source}</pre></div>
      <p className="panel-footnote">{entry.expected === 'rejected' ? '这是故意写错的负例。“按预期拒绝”表示安全检查生效，不表示这个写法受支持。' : '这里只证明编译结果，不证明浏览器 applicability、字体绘制或任意层叠组合。'}</p>
    </div>
    {entry.diagnostics.length ? <div className="diagnostic-panel"><h3>编译器给出的诊断</h3>{entry.diagnostics.map((diagnostic, index) => <div className="diagnostic" key={index}><code>{diagnostic.code}</code><p>{diagnostic.message}</p></div>)}</div> : null}
    {entry.config ? <p className="scope-note">此例使用独立 Compiler 配置。条件与 layer 的注册不会自动成为 Vite 的公开配置。</p> : null}
    <details className="inspector" key={`${id}-output`}><summary><span>{entry.committed ? '查看生成 CSS 与交付产物' : '查看保留的上一份快照'}</span><span className="summary-meta">CSS / schema / manifest</span></summary><div className="inspector-content"><pre>{entry.snapshot.css}</pre><details><summary>ScopeSchema、map、manifest 与 report</summary><pre>{JSON.stringify({ module: entry.module, snapshot: entry.snapshot, lifecycle: entry.lifecycle }, null, 2)}</pre></details></div></details>
    <details className="inspector" key={`${id}-config`}><summary><span>查看配置与完整诊断</span><span className="summary-meta">开发者细节</span></summary><div className="inspector-content"><pre>{JSON.stringify({ config: entry.config ?? {}, diagnostics: entry.diagnostics }, null, 2)}</pre></div></details>
    <details className="inspector"><summary><span>浏览能力分类</span><span className="summary-meta">{compilerCases.length} 个有限案例</span></summary><div className="capability-list">{families.map((family) => <div key={family}><span>{familyLabel(family)}</span><span>{compilerCases.filter((item) => item.family === family).length}</span></div>)}</div><p className="panel-footnote">这是有限能力清单，不是所有语法交叉组合都受支持的声明。</p></details>
  </section>;
}
