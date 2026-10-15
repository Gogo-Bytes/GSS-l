import React, { lazy, Suspense, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { LiveDemo } from './LiveDemo.js';
import './screen.css';
const FixtureExplorer = lazy(() => import('./FixtureExplorer.js'));
const CompilerExplorer = lazy(() => import('./CompilerExplorer.js'));
const AdapterExplorer = lazy(() => import('./AdapterExplorer.js'));

const destinations = [
  { id: 'live', icon: '◉', title: '交互体验', description: '从一个小变化开始', tag: '开始' },
  { id: 'fixtures', icon: '▤', title: '浏览器对照', description: '原生 CSS 与编译结果', tag: '' },
  { id: 'compiler', icon: '{ }', title: '编译与诊断', description: '语法输出与安全边界', tag: '' },
  { id: 'adapter', icon: '↗', title: 'React 转换', description: '引用如何变成 class', tag: '' }
];
function App() {
  const [tab, setTab] = useState('live');
  const [pending, setPending] = useState(false);
  return <div className="app-shell">
    <aside className="sidebar">
      <a className="brand" href="/" aria-label="GSS-l playground 首页"><span className="brand-mark">g.</span><span>GSS-l<small>PLAYGROUND</small></span></a>
      <nav aria-label="工作台导航"><p className="nav-caption">体验与验证</p>{destinations.map((item) =>
        <button className="nav-item" key={item.id} data-testid={`nav-${item.id}`} disabled={pending} aria-pressed={tab === item.id} onClick={() => { setTab(item.id); window.scrollTo({ top: 0, behavior: 'instant' }); }}>
          <span className="nav-icon" aria-hidden="true">{item.icon}</span><span className="nav-copy">{item.title}<small>{item.description}</small></span>{item.tag ? <span className="nav-count">{item.tag}</span> : null}
        </button>)}</nav>
      <div className="sidebar-note"><span className="status-dot" />本地开发工作台<p>先看效果，再按需展开源码和验证细节。</p>{pending ? <p role="status">正在读取对照数据…</p> : null}</div>
    </aside>
    <div className="workspace">
      <div className="workspace-bar"><span>Playground <span className="breadcrumb-slash">/</span> {destinations.find((item) => item.id === tab)?.title}</span><span className="version-label">MVP · 能力预览</span></div>
      <main className="workspace-content"><Suspense fallback={<div className="loading-panel" role="status">正在准备案例…</div>}>
        {tab === 'live' ? <LiveDemo /> : tab === 'fixtures' ? <FixtureExplorer onPendingChange={setPending} /> : tab === 'compiler' ? <CompilerExplorer /> : <AdapterExplorer />}
      </Suspense></main>
      <footer className="workspace-footer"><span>GSS-l · 写 CSS，构建时编译。</span><details><summary>运行方式与验证范围</summary><div className="footer-details">
        <p><code>corepack pnpm playground</code> 启动体验；<code>playground:build</code> 构建；<code>playground:check</code> 运行验证。</p>
        <p>交互体验走公开 React/Vite 集成。浏览器对照是独立参考 CSS 与 Compiler 的比较；编译与诊断不代表浏览器渲染。完整原生损坏检测仍由 <code>browser:check</code> 单独执行。</p>
        <p>这里不宣称任意 CSS 组合、跨文件类型图、通用 SSR 或完整像素一致性。Vite 未开放的条件注册入口不会因 Compiler 案例而变成可用能力。</p>
      </div></details></footer>
    </div>
  </div>;
}

createRoot(document.getElementById('root')!).render(<App />);
