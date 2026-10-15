import React from 'react';
import styles from './Lazy.gss';
export default function LazyCard() {
  return <p data-testid="lazy-card" className={styles.badge.self + ' lazy-result'}><strong>按需加载完成 ✓</strong><small>这个组件复用了同一份中央 CSS。</small></p>;
}
