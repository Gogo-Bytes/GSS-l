import React, { useState } from 'react';
import payload from 'virtual:playground-adapter';
import type { transformPlaygroundCases } from './adapter-cases.js';
const cases = payload as ReturnType<typeof transformPlaygroundCases>;

export default function AdapterExplorer() {
  const [id, setId] = useState('direct');
  const entry = cases.find((item) => item.id === id)!;
  return <section><h2>React transform fixtures · {cases.length} cases</h2>
    <p>仅验证已知 ScopeSchema 的源码 transform，不等于 TypeScript JSX 类型检查、跨文件 provenance 或浏览器渲染。真实运行示例见 React + Vite。</p>
    <label>Adapter case <select aria-label="Adapter case" value={id} onChange={(event) => setId(event.target.value)}>{cases.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
    <p data-testid="adapter-status">{entry.boundary ? 'KNOWN BOUNDARY' : 'PASS'} · {entry.level}</p>
    {entry.boundary ? <p className="badge">{entry.boundary}</p> : null}
    <h3>Input</h3><pre>{entry.source}</pre><h3>Output</h3><pre>{entry.code}</pre>
    <h3>Diagnostics / source map</h3><pre>{JSON.stringify({ diagnostics: entry.diagnostics, map: entry.map }, null, 2)}</pre>
  </section>;
}
