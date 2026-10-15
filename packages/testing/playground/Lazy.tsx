import React from 'react';
import styles from './Lazy.gss';
export default function LazyCard() {
  return <p data-testid="lazy-card" className={styles.badge.self}>React.lazy · CSS 已在 production census 中</p>;
}
