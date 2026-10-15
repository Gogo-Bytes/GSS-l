import React, { useEffect, useRef, useState } from 'react';
import styles from './Article.gss';

const comments = [
  { id: 'lin', author: '林间 · 读者', text: '我喜欢把阅读当成散步，而不是进度条。A small pause makes room for a better question. 在小屏幕上也应该能从容读完这一段。' },
  { id: 'zhou', author: '小舟 · 读者', text: '列表中的第二步很实用：先写下观察，再问为什么。下次准备带着这份清单去河边，记录雨后树叶与光线的变化。' }
];

export function Article({ native }: { native: boolean }) {
  const [large, setLarge] = useState(false);
  const [warm, setWarm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replies, setReplies] = useState<{ target: string; text: string }[]>([]);
  const [notice, setNotice] = useState('回复仅保留在当前页面，刷新后重置。');
  const heading = useRef<HTMLHeadingElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  useEffect(() => { if (expanded) heading.current?.focus(); }, [expanded]);
  useEffect(() => {
    if (!editing && opener.current) { opener.current.focus(); opener.current = null; }
  }, [editing]);
  function closeEditor() { setEditing(null); setDraft(''); }
  return <main data-probe="article" data-size={large ? 'large' : 'normal'} data-tone={warm ? 'warm' : 'calm'} className={native ? 'reading-page' : styles.page.self}>
    <header data-probe="header" className={native ? 'article-header' : styles.header.self}>
      <p data-probe="kicker" className={native ? 'article-kicker' : styles.kicker.self}>慢读笔记 / FIELD NOTES · 07</p>
      <h1 data-probe="title" className={native ? 'article-title' : styles.title.self}>把一段路，读成一篇文章</h1>
      <p data-probe="meta" className={native ? 'article-meta' : styles.meta.self}>文 / 陈禾 · 2025 年 6 月 12 日 · 约 4 分钟</p>
    </header>
    <nav aria-label="阅读设置" data-probe="toolbar" className={native ? 'reading-tools' : styles.toolbar.self}>
      <button data-probe="size" aria-pressed={large} className={native ? 'reading-button' : styles.button.self} onClick={() => setLarge(!large)}>字号：{large ? '大' : '标准'}</button>
      <button data-probe="tone" aria-pressed={warm} className={native ? 'reading-button' : styles.button.self} onClick={() => setWarm(!warm)}>色调：{warm ? '暖墨' : '青墨'}</button>
    </nav>
    <article aria-label="文章正文" data-probe="body" className={native ? 'article-body' : styles.body.self}>
      <p data-probe="intro" className={native ? 'article-paragraph' : styles.paragraph.self}>清晨走过熟悉的街角，<span data-probe="nested">我们常常只看见目的地，<em data-probe="emphasis">却错过了路上的细节</em>。<strong data-probe="strong">慢一点，不是停下来。</strong></span> It is a way of noticing: the light on a wall, a quiet conversation, and the space between two thoughts.</p>
      <h2 data-probe="section-title" className={native ? 'article-section-title' : styles.sectionTitle.self}>01 / 从观察开始</h2>
      <p data-probe="long-copy" className={native ? 'article-paragraph' : styles.paragraph.self}>这不是效率指南，而是一份可以带走的小练习。读中文时，我们沿着语意停顿；reading in English, we follow a different rhythm. 两种节奏交织在一起，也不必挤出屏幕。试着读出这个长词：<span data-probe="long-word">ObservationWithoutAHurryCreatesRoomForUnexpectedConnectionsAndSmallEverydayDiscoveries</span>，再回到眼前的一片叶子。</p>
      <ol data-probe="ordered" className={native ? 'reading-steps' : styles.ordered.self}>
        <li data-probe="step-one" data-pseudo="marker" className={native ? 'reading-item' : styles.item.self}>选一条熟悉的路。<span data-probe="list-nested">Leave the headphones in your pocket，给环境一点说话的时间。</span></li>
        <li data-probe="step-two" data-pseudo="marker" className={native ? 'reading-item' : styles.item.self}>记下三个具体的观察，而不是急着给它们命名。
          <ul data-probe="unordered" className={native ? 'reading-details' : styles.unordered.self}>
            <li data-probe="bullet-one" data-pseudo="marker" className={native ? 'reading-item' : styles.item.self}>光线：一束光落在哪里，又如何移动？</li>
            <li data-probe="bullet-two" data-pseudo="marker" className={native ? 'reading-item' : styles.item.self}>声音：近处的脚步与远处的 conversation，哪一个让你想起了一个人？</li>
          </ul>
        </li>
        <li data-probe="step-three" data-pseudo="marker" className={native ? 'reading-item' : styles.item.self}>回家后写一句话。不要追求完整，先保留真实的感受。</li>
      </ol>
      <blockquote data-probe="quote" data-pseudo="quote" className={native ? 'reading-quote' : styles.quote.self}><span data-probe="quote-nested">Attention is a form of care. 认真看见，就是一种温柔的回应。</span></blockquote>
      <h2 data-probe="closing-title" className={native ? 'article-section-title' : styles.sectionTitle.self}>02 / 把空白留给下一次</h2>
      <p data-probe="closing" className={native ? 'article-paragraph' : styles.paragraph.self}>文章不必替生活下结论。可以在页边留一个问号，也可以到<a data-probe="discussion-link" href="#discussion" className={native ? 'reading-link' : styles.link.self}>下方的讨论区</a>交换一次小小的发现。明天再走同一条路，你会读到不同的句子。</p>
      <aside data-probe="note" className={native ? 'reading-note' : styles.note.self}>页边提示：<span data-probe="note-nested">这里保留较小字号与独立墨色，切换阅读设置不会覆盖这条局部说明。</span></aside>
    </article>
    <section id="discussion" aria-label="读者讨论" data-probe="comments" className={native ? 'reader-comments' : styles.comments.self}>
      <button ref={toggle} data-probe="expand" aria-expanded={expanded} aria-controls="comment-thread" className={native ? 'reading-button' : styles.button.self} onClick={() => {
        setExpanded(!expanded);
        if (expanded) { opener.current = null; closeEditor(); toggle.current?.focus(); }
      }}>{expanded ? '收起讨论' : '展开讨论'} · 2 条评论{replies.length ? ` / ${replies.length} 条新回复` : ''}</button>
      {expanded ? <div id="comment-thread" data-probe="thread">
        <h2 ref={heading} tabIndex={-1} data-probe="comments-heading" className={native ? 'comments-heading' : styles.commentsHeading.self}>把你的发现留在这里</h2>
        {comments.map((comment) => <article key={comment.id} aria-label={comment.author} data-probe={`comment-${comment.id}`} className={native ? 'reader-comment' : styles.comment.self}>
          <h3 data-probe={`author-${comment.id}`} className={native ? 'comment-author' : styles.author.self}>{comment.author}</h3>
          <p data-probe={`copy-${comment.id}`} className={native ? 'article-paragraph' : styles.paragraph.self}>{comment.text}</p>
          {comment.id === 'lin' ? <div data-probe="nested-reply" className={native ? 'comment-reply' : styles.reply.self}><p data-probe="reply-author" className={native ? 'comment-author' : styles.author.self}>陈禾 · 作者回复</p><p data-probe="reply-copy" className={native ? 'article-paragraph' : styles.paragraph.self}>谢谢你。<em data-probe="reply-emphasis">Keep a little room for wonder.</em> 留一点空白，下次再见。</p></div> : null}
          {replies.filter((reply) => reply.target === comment.id).map((reply, index) => <p key={index} data-probe={`submitted-${comment.id}-${index}`} className={native ? 'comment-reply' : styles.reply.self}>我：{reply.text}</p>)}
          <div data-probe={`actions-${comment.id}`} className={native ? 'comment-actions' : styles.actions.self}><button data-probe={`reply-${comment.id}`} disabled={editing !== null} className={native ? 'reading-button' : styles.button.self} onClick={(event) => { opener.current = event.currentTarget; setEditing(comment.id); setDraft(''); }}>回复{comment.id === 'lin' ? '林间' : '小舟'}</button></div>
          {editing === comment.id ? <form data-probe="editor" aria-label="写回复" className={native ? 'reply-form' : styles.form.self} onSubmit={(event) => {
            event.preventDefault();
            if (!draft.trim()) return;
            setReplies((current) => [...current, { target: comment.id, text: draft.trim() }]);
            setNotice('回复已添加，仅当前页面可见。'); closeEditor();
          }}>
            <label data-probe="label" className={native ? 'reply-label' : styles.label.self}>回复给{comment.author}<textarea autoFocus rows={3} maxLength={600} data-probe="draft" placeholder="写下具体的发现，也给彼此一点善意…" className={native ? 'reply-field' : styles.field.self} value={draft} onChange={(event) => setDraft(event.target.value)} /></label>
            <div data-probe="editor-actions" className={native ? 'comment-actions' : styles.actions.self}><button data-probe="send" disabled={!draft.trim()} className={native ? 'reading-button' : styles.button.self}>发布回复</button><button type="button" data-probe="cancel" className={native ? 'reading-button' : styles.button.self} onClick={() => { closeEditor(); setNotice('已取消，未发布回复。'); }}>取消</button></div>
          </form> : null}
        </article>)}
      </div> : null}
      <p role="status" data-probe="notice" className={native ? 'reading-notice' : styles.notice.self}>{notice}</p>
    </section>
  </main>;
}
