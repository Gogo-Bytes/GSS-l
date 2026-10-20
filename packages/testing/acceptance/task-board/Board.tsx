import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import styles from './Board.gss';
import { initialTasks, labels, statuses } from './data.js';
import type { Status, Task } from './data.js';
const Detail = lazy(() => import('./Detail.js'));

export function Board({ native }: { native: boolean }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<string | null>(null);
  const detailOpener = useRef<HTMLButtonElement | null>(null);
  const [draft, setDraft] = useState<Task | null>(null);
  const editorOpener = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (draft || !editorOpener.current) return;
    (editorOpener.current.isConnected ? editorOpener.current : searchInput.current)?.focus();
    editorOpener.current = null;
  }, [draft]);
  const [notice, setNotice] = useState('Changes stay in this tab. Reload to start fresh.');
  const visible = tasks.filter((task) => (filter === 'all' || task.status === filter) && `${task.title} ${task.owner} ${task.id}`.toLowerCase().includes(query.toLowerCase()));
  const detail = tasks.find((task) => task.id === selected);
  function updateStatus(id: string, status: Status) {
    setTasks((current) => current.map((task) => task.id === id ? { ...task, status } : task));
    setDraft((current) => current?.id === id ? { ...current, status } : current);
    setNotice(`${id} moved to ${labels[status]}.`);
  }
  return <main data-probe="board" className={native ? 'native-board' : styles.board}>
    <header data-probe="heading" className={native ? 'native-heading' : styles.heading}>
      <div><p data-probe="eyebrow" className={native ? 'native-eyebrow' : styles.eyebrow.self}>Product studio / Week 24</p>
        <h1 data-probe="title" className={native ? 'native-title' : styles.title.self}>Small steps. Meaningful work.</h1>
        <p data-probe="subtitle" className={native ? 'native-subtitle' : styles.subtitle.self}>A calm place to move this week’s release forward.</p></div>
      <span data-probe="summary" className={native ? 'native-summary' : styles.summary.self}>{tasks.filter((task) => task.status === 'done').length} of {tasks.length} complete</span>
    </header>
    <section aria-label="Filter tasks" data-probe="toolbar" className={native ? 'native-toolbar' : styles.toolbar.self}>
      <label data-probe="search-label" className={native ? 'native-label' : styles.label.self}>Find a task
        <input ref={searchInput} data-probe="search" className={native ? 'native-field' : styles.field.self} placeholder="Search title, owner or ID" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label data-probe="filter-label" className={native ? 'native-label' : styles.label.self}>Status
        <select data-probe="filter" className={native ? 'native-field' : styles.field.self} value={filter} onChange={(event) => setFilter(event.target.value)}>
          <option value="all">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{labels[status]}</option>)}
        </select></label>
      <button data-probe="clear" className={native ? 'native-button' : styles.button.self} disabled={!query && filter === 'all'} onClick={() => { setQuery(''); setFilter('all'); }}>Clear filters</button>
    </section>
    <p role="status" data-probe="notice" className={native ? 'native-notice' : styles.notice.self}>{visible.length} tasks shown · {notice}</p>
    {draft ? <form aria-label="Edit task" data-probe="editor" className={native ? 'native-editor' : styles.editor.self} onSubmit={(event) => {
      event.preventDefault();
      if (!draft.title.trim() || !draft.owner.trim()) return;
      setTasks((current) => current.map((task) => task.id === draft.id ? { ...draft, title: draft.title.trim(), owner: draft.owner.trim() } : task));
      setNotice(`${draft.id} saved.`); setDraft(null);
    }}>
      <h2 data-probe="form-title" className={native ? 'native-form-title' : styles.formTitle.self}>Edit {draft.id}</h2>
      <div data-probe="form-grid" className={native ? 'native-form-grid' : styles.formGrid.self}>
        <label data-probe="title-label" className={native ? 'native-label' : styles.label.self}>Task title<input autoFocus required maxLength={120} data-probe="edit-title" className={native ? 'native-field' : styles.field.self} value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
        <label data-probe="owner-label" className={native ? 'native-label' : styles.label.self}>Owner<input required maxLength={60} data-probe="edit-owner" className={native ? 'native-field' : styles.field.self} value={draft.owner} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} /></label>
      </div>
      <label data-probe="notes-label" className={native ? 'native-label' : styles.label.self}>Notes<textarea rows={3} maxLength={600} data-probe="edit-notes" className={native ? 'native-field' : styles.field.self} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
      <div data-probe="form-actions" className={native ? 'native-actions' : styles.actions.self}>
        <button data-probe="save" className={native ? 'native-primary' : styles.primary.self} disabled={!draft.title.trim() || !draft.owner.trim()}>Save changes</button>
        <button type="button" data-probe="cancel" className={native ? 'native-button' : styles.button.self} onClick={() => { setDraft(null); setNotice('Edit cancelled. No changes saved.'); }}>Cancel</button>
      </div>
    </form> : null}
    <section aria-label="Tasks" data-probe="grid" className={native ? 'native-grid' : styles.grid.self}>
      {visible.map((task) => <article key={task.id} aria-label={task.id} data-probe={`card-${task.id}`} data-selected={selected === task.id ? 'yes' : 'no'} className={native ? 'native-card' : styles.card.self}>
        <div data-probe={`top-${task.id}`} className={native ? 'native-card-top' : styles.cardTop.self}><span data-probe={`id-${task.id}`} className={native ? 'native-id' : styles.id.self}>{task.id} / {task.tag}</span>
          <span data-probe={`badge-${task.id}`} data-status={task.status} className={native ? 'native-badge' : styles.badge.self}>{labels[task.status]}</span></div>
        <h2 data-probe={`title-${task.id}`} className={native ? 'native-card-title' : styles.cardTitle.self}>{task.title}</h2>
        <p data-probe={`notes-${task.id}`} className={native ? 'native-notes' : styles.notes.self}>{task.notes}</p>
        <p data-probe={`owner-${task.id}`} className={native ? 'native-owner' : styles.owner.self}>↳ {task.owner}</p>
        <label data-probe={`status-label-${task.id}`} className={native ? 'native-label' : styles.label.self}>Move task
          <select aria-label={`Move task ${task.id}`}  data-probe={`status-${task.id}`} className={native ? 'native-field' : styles.field.self} value={task.status} onChange={(event) => updateStatus(task.id, event.target.value as Status)}>{statuses.map((status) => <option key={status} value={status}>{labels[status]}</option>)}</select></label>
        <div data-probe={`actions-${task.id}`} className={native ? 'native-actions' : styles.actions.self}>
          <button data-probe={`open-${task.id}`} aria-expanded={selected === task.id} className={native ? 'native-primary' : styles.primary.self} onClick={(event) => { detailOpener.current = event.currentTarget; setSelected(task.id); }}>View details</button>
          <button data-probe={`edit-${task.id}`} className={native ? 'native-button' : styles.button.self} onClick={(event) => { editorOpener.current = event.currentTarget; setDraft({ ...task }); }}>Edit task</button>
        </div>
      </article>)}
    </section>
    {!visible.length ? <p data-probe="empty" className={native ? 'native-empty' : styles.empty.self}>No matching tasks. Try another name or clear your filters.</p> : null}
    <Suspense fallback={<p role="status">Opening task details…</p>}>{detail ? <Detail task={detail} native={native} onClose={() => { setSelected(null); detailOpener.current?.focus(); }} /> : null}</Suspense>
  </main>;
}
