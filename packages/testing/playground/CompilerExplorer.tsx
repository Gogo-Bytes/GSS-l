import React, { useState } from 'react';
import payload from 'virtual:playground-compiler';
import type { compilePlaygroundCases } from './compiler-cases.js';
const compilerCases = payload as ReturnType<typeof compilePlaygroundCases>;

export default function CompilerExplorer() {
  const [id, setId] = useState('ownership-nesting');
  const entry = compilerCases.find((item) => item.id === id)!;
  return <section aria-label="Compiler-only inventory"><h2>Compiler-only 能力与负例清单 · {compilerCases.length} cases</h2>
    <p>每个案例通过独立 Compiler session 运行；拒绝案例验证完整 last-known-good 快照未变。这里没有向 Vite 新增 condition/layer 注册配置。</p>
    <label>Case <select aria-label="Compiler case" value={id} onChange={(event) => setId(event.target.value)}>{compilerCases.map((item) =>
      <option key={item.id} value={item.id}>{item.family} · {item.title}</option>)}</select></label>
    <p data-testid="compiler-status">PASS · {entry.level} · expected {entry.expected} · committed {String(entry.committed)} · rollback {entry.rollback === null ? 'n/a' : String(entry.rollback)}</p>
    <p>{entry.title}</p><pre>{entry.source}</pre>
    <details open><summary>Compiler config / diagnostics</summary><pre>{JSON.stringify({ config: entry.config ?? {}, diagnostics: entry.diagnostics }, null, 2)}</pre></details>
    <details><summary>Generated CSS / schema / map / manifest / report</summary><pre>{JSON.stringify({ module: entry.module, snapshot: entry.snapshot, lifecycle: entry.lifecycle }, null, 2)}</pre></details>
    <h3>覆盖清单 · 不等于任意组合证明</h3><ul>{[...new Set(compilerCases.map((item) => item.family))].map((family) => <li key={family}>{family}: {compilerCases.filter((item) => item.family === family).length} cases</li>)}</ul>
  </section>;
}
