import React, { useState } from 'react';
import styles from './Live.gss';

// Plain JSX deliberately demonstrates the Adapter's implicit lowering without
// claiming that React's stock TypeScript className type accepts scope objects.
export function ImplicitDemo() {
  const [alternate, setAlternate] = useState(false);
  const branch = alternate ? styles.alternate : styles.card;
  const title = alternate ? styles.alternate.title : styles.card.title;
  const { title: glyph } = styles.card;
  return <div>
    <p>JSX implicit lowering：直接引用、不可变 conditional alias、从已知 scope 解构的 property alias。TSX 示例使用显式 .self，不修改 React 原生类型。alias 的后续成员读取不自动 lowering，需显式 .self。</p>
    <div className={branch}><span data-testid="implicit-title" className={title}>Implicit JSX class strings</span></div>
    <span className={glyph}>Destructured property alias</span>
    <button className={styles.action} data-testid="implicit-toggle" onClick={() => setAlternate(!alternate)}>Toggle implicit alias</button>
  </div>;
}
