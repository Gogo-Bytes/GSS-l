import React, { useState } from 'react';
import styles from './Live.gss';

// Keep this in JSX: stock React TSX types do not accept scope objects.
export function ImplicitDemo() {
  const [alternate, setAlternate] = useState(false);
  const branch = alternate ? styles.alternate : styles.card;
  const title = alternate ? styles.alternate.title : styles.card.title;
  const { title: glyph } = styles.card;
  return <>
    <div className="preview-canvas"><div className="implicit-grid">
      <div className="implicit-tile"><div className={branch}><span className="sample-kicker">CONDITIONAL ALIAS</span><h3><span data-testid="implicit-title" className={title}>样式跟着分支走。</span></h3><code>className={'{title}'}</code></div></div>
      <div className="implicit-tile"><div className={styles.card}><span className="sample-kicker">PROPERTY ALIAS</span><h3><span className={glyph}>这份引用不变。</span></h3><code>className={'{glyph}'}</code></div></div>
    </div></div>
    <div className="demo-controls"><button className={styles.action} data-testid="implicit-toggle" aria-pressed={alternate} onClick={() => setAlternate(!alternate)}>{alternate ? '返回基础分支' : '切换到另一分支'}</button></div>
  </>;
}
