import React, { lazy, Suspense, useState } from 'react';
import styles from './Live.gss';
import relations from './Relations.gss';
import external from './External.gss';
import resources from './Resources.gss';
import liveSource from './Live.gss?raw';
import { ImplicitDemo } from './ImplicitDemo.jsx';

const LazyCard = lazy(() => import('./Lazy.js'));
type TitleProps = { scope: typeof styles.card };
function Title({ scope }: TitleProps) {
  return <span data-testid="live-title" className={scope.title.self}>Static path → typed scope prop → explicit .self string</span>;
}

export function LiveDemo() {
  const [active, setActive] = useState(false);
  const [alternate, setAlternate] = useState(false);
  const [focused, setFocused] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const branch = alternate ? styles.alternate : styles.card;
  return <section aria-label="React Vite live examples">
    <h2>React + Vite · 真实消费</h2>
    <p>这些节点经过公开的 <code>gss({`{ adapter: react() }`})</code>。修改本地 <code>Live.gss</code> 可检查更新与错误恢复。TSX 的 React className 类型要求字符串，因此这里和拼接 class 时显式使用 <code>.self</code>。</p>
    <ImplicitDemo />
    <div className="toolbar">
      <button onClick={() => setActive(!active)} data-testid="toggle-active">Toggle attribute</button>
      <button onClick={() => setAlternate(!alternate)} data-testid="toggle-alias">Toggle conditional alias</button>
      <button onClick={() => setDisabled(!disabled)}>Toggle disabled</button>
    </div>
    <div className={branch.self} data-active={active ? 'yes' : 'no'}><Title scope={branch} /></div>
    <button className={styles.action.self} disabled={disabled}>Hover / focus-visible / active / disabled</button>
    <input className={styles.field.self} placeholder="原生 ::placeholder" aria-label="Placeholder example" />
    <p className={styles.decoration.self}>Pseudo-elements</p>
    <div className={relations.parent.self}><span className={relations.parent.child.self}>Direct child context</span></div>
    <div><input id="relation-check" type="checkbox" className={relations.check.self} /><label htmlFor="relation-check" data-testid="relation-label" className={relations.check.label.self}>Checked adjacent sibling</label></div>
    <div className={relations.observer.self}><input type="checkbox" aria-label="Observed checkbox" /> Native :has(:checked)</div>
    <div><span className={relations.source.self}>Source · </span><span className={relations.source.target.self}>General sibling</span></div>
    <button data-testid="toggle-external" onClick={() => setFocused(!focused)}>Toggle third-party class</button>
    <p data-testid="external-node" className={external.editor.self + (focused ? ' focused' : '')}>Owned node + external class condition</p>
    <div className={resources.provider.self}><span className={resources.provider.inherited.self}>Native custom-property inheritance</span></div>
    <p className={resources.motion.self}>Paused Module-local keyframes (inspect via browser tools)</p>
    <div data-testid="asset" className={resources.asset.self} aria-label="Local SVG Asset" />
    <button data-testid="load-lazy" onClick={() => setLoaded(true)} disabled={loaded}>Load lazy component</button>
    <Suspense fallback={<p>Loading…</p>}>{loaded ? <LazyCard /> : null}</Suspense>
    <details><summary>Live.gss 源码 / 操作提示</summary><pre>{liveSource}</pre>
      <p>在本地修改 color 后保存；再制造重复 property 检查 Vite overlay 与旧样式保留，修复后恢复。Dev 可能按原生依赖传播 reload，不承诺 React state 永久保持。</p></details>
  </section>;
}
