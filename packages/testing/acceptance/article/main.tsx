import React from 'react';
import { createRoot } from 'react-dom/client';
import { Article } from './Article.js';
import { scope } from './scope.js';
import './shell.css';
import './reference.css';

const native = new URLSearchParams(window.location.search).get('reference') === 'native';
createRoot(document.getElementById('root')!).render(<>
  <div className="case-bar"><a href="http://127.0.0.1:4179/">GSS-l 阅读室</a><span>{native ? '原生 CSS 对照' : 'GSS 业务案例'} · <a href={native ? '/' : '/?reference=native'}>{native ? '查看 GSS' : '查看原生'}</a></span></div>
  <Article native={native} />
  <footer className="case-scope"><p>慢读笔记 · 有界渲染验收案例，不代表完整 MVP 验收。</p><details><summary>验证范围与限制</summary><ul>{scope.map((item) => <li key={item.feature}><strong>{item.feature}：</strong>{item.exercised}<br />限制：{item.limitation}</li>)}</ul></details></footer>
</>);
