import React, { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LiveDemo } from './LiveDemo.js';
import './screen.css';
const FixtureExplorer = lazy(() => import('./FixtureExplorer.js'));
const CompilerExplorer = lazy(() => import('./CompilerExplorer.js'));
const AdapterExplorer = lazy(() => import('./AdapterExplorer.js'));

function App() {
  const [tab, setTab] = useState('live');
  const [pending, setPending] = useState(false);
  return <>
    <header><span className="eyebrow">GSS-l / frozen MVP</span><h1>Capability playground</h1>
      <p>可运行的能力清单，而不是任意 CSS 组合支持声明。新增能力时补对应案例；不扩大 Compiler 的公开 API。</p>
      <nav aria-label="Playground sections">{[['live', 'React + Vite'], ['fixtures', 'Native fixtures'], ['compiler', 'Compiler only'], ['adapter', 'React transform']].map(([id, title]) =>
        <button key={id} disabled={pending} aria-pressed={tab === id} onClick={() => setTab(id!)}>{title}</button>)}</nav>
    </header>
    <main><Suspense fallback={<p>Loading fixtures…</p>}>{tab === 'live' ? <LiveDemo /> : tab === 'fixtures' ? <FixtureExplorer onPendingChange={setPending} /> : tab === 'compiler' ? <CompilerExplorer /> : <AdapterExplorer />}</Suspense></main>
    <footer><code>corepack pnpm playground</code> · <code>corepack pnpm playground:build</code> · <code>corepack pnpm playground:check</code>
      <p>Native fixtures = 独立 reference/手写 native CSS + Compiler，不是 React/Vite 注册条件的证明。Compiler-only = 编译/回滚证明，不保证浏览器 applicability、font paint 或完整 cascade。跨文件类型图、通用 SSR、任意多 runtime witness 均不在这里暗示支持。</p></footer>
  </>;
}

createRoot(document.getElementById('root')!).render(<App />);
