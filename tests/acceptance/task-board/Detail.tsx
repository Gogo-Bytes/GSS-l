import React, { useEffect, useRef } from 'react';
import styles from './Detail.gss';
import type { Task } from './data.js';
import { labels } from './data.js';

export default function Detail({ task, native, onClose }: { task: Task; native: boolean; onClose: () => void }) {
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus(); }, [task.id]);
  return <aside ref={panel} tabIndex={-1} aria-label="Task details" data-probe="detail" className={native ? 'native-detail' : styles.panel}>
    <div data-probe="detail-heading" className={native ? 'native-detail-heading' : styles.heading}>
      <h2 data-probe="detail-title" className={native ? 'native-detail-title' : styles.title}>{task.title}</h2>
      <button data-probe="detail-close" className={native ? 'native-detail-close' : styles.close} onClick={onClose}>Close details</button>
    </div>
    <p data-probe="detail-meta" className={native ? 'native-detail-meta' : styles.meta}>{task.id} · {task.owner} · {labels[task.status]} · {task.tag}</p>
    <p data-probe="detail-copy" className={native ? 'native-detail-copy' : styles.copy}>{task.notes}</p>
  </aside>;
}
