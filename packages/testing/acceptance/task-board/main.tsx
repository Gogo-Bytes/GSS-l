import React from 'react';
import { createRoot } from 'react-dom/client';
import { Board } from './Board.js';
import { scope } from './scope.js';
import './shell.css';
import './reference.css';

const native = new URLSearchParams(window.location.search).get('reference') === 'native';
createRoot(document.getElementById('root')!).render(<div className="shell">
  <div className="masthead"><div className="wordmark"><span aria-hidden="true">f.</span>Fieldwork</div><div className="mode">{native ? 'Native CSS reference' : 'GSS business case'} · <a href={native ? '/' : '/?reference=native'}>{native ? 'Open GSS version' : 'Open native reference'}</a></div></div>
  <Board native={native} />
  <footer className="scope"><p>Bounded acceptance case · Local state only · Not full MVP acceptance</p><p>Business GSS uses supported whole-module preservation, not atomization. Ordinary decoration triggers fallback; see scope below.</p><details><summary>What this case does — and does not — check</summary><ul>{scope.map((item) => <li key={item.feature}><strong>{item.feature}.</strong> {item.exercised}<br />Limit: {item.limitation}</li>)}</ul><p>Run <code>corepack pnpm task-board:check</code> for recorded evidence. The native reference shares React markup, but uses manually authored CSS; no compiler-generated expectations. Results live in ignored <code>artifacts/acceptance/task-board/result.json</code>.</p></details></footer>
</div>);
