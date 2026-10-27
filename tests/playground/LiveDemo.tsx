import React, { lazy, Suspense, useState } from 'react';
import styles from './Live.gss';
import relations from './Relations.gss';
import external from './External.gss';
import resources from './Resources.gss';
import liveSource from './Live.gss?raw';
import relationSource from './Relations.gss?raw';
import externalSource from './External.gss?raw';
import resourceSource from './Resources.gss?raw';
import implicitSource from './ImplicitDemo.jsx?raw';
import { ImplicitDemo } from './ImplicitDemo.jsx';

const LazyCard = lazy(() => import('./Lazy.js'));
const scenes = [
  { id: 'states', label: '样式切换', title: '同一张卡片，不同的状态',
    description: '点击按钮，观察标题颜色。样式来自 .gss，状态仍由 React 管理。',
    expected: '基础标题是红色；选中后变蓝；换一组样式后变绿。',
    concept: '嵌套路径、属性条件、conditional alias 与 typed scope prop。', file: 'Live.gss', source: liveSource.split('\n').slice(0, 5).join('\n') },
  { id: 'interactions', label: '浏览器状态', title: '悬停、焦点和伪元素，照常工作',
    description: '把鼠标放上按钮，或用 Tab 键聚焦。也可以切换 disabled 状态。',
    expected: '悬停时背景变蓝；键盘焦点出现蓝色轮廓；禁用后按钮变淡。',
    concept: '原生 pseudo state、::placeholder，以及 ::before / ::after。', file: 'Live.gss', source: liveSource.split('\n').slice(5).join('\n') },
  { id: 'relations', label: '元素关系', title: '有些样式，要看元素之间的关系',
    description: '勾选复选框，看相邻标签和包含它的容器如何变化。',
    expected: '第一个复选框让相邻标签变蓝；第二个让观察容器的文字变绿。',
    concept: 'child、adjacent / general sibling 与原生 :has()。关系仍由浏览器判断。', file: 'Relations.gss', source: relationSource },
  { id: 'external', label: '第三方类名', title: '和外部 class 一起工作',
    description: '模拟一个编辑器：只切换外部的 focused 类名，不替换 GSS scope。',
    expected: '默认是蓝色文字；添加 focused 后变红；移除后恢复。',
    concept: '同一 owned node 上的外部 class 条件。不是向第三方节点注入 GSS class。', file: 'External.gss', source: externalSource },
  { id: 'resources', label: '资源与懒加载', title: 'CSS 之外的资源，也有交付路径',
    description: '看一个真实 SVG、一段变量继承，再按需加载一个 React 组件。',
    expected: 'SVG 正常显示，继承文字为蓝色。加载后出现紫底卡片，仍共用中央 CSS。',
    concept: '本地 Asset、@property、Module-local keyframes 与 production lazy census。动画固定暂停在起点，不展示播放进度。', file: 'Resources.gss', source: resourceSource },
  { id: 'implicit', label: 'JSX 引用', title: '在 JSX 中使用静态 scope 引用',
    description: '切换分支，观察直接引用、局部 alias 和解构引用的效果。',
    expected: '主标题从红色变为绿色；解构引用继续保留自己的红色样式。',
    concept: '这里是 JSX 的隐式 lowering。TSX 示例显式用 .self；alias 成员读取的已知限制可在 React 转换页查看。', file: 'ImplicitDemo.jsx', source: implicitSource }
] as const;
type SceneId = typeof scenes[number]['id'];
type TitleProps = { scope: typeof styles.card };
function Title({ scope }: TitleProps) {
  return <span data-testid="live-title" className={scope.title.self + ' sample-title'}>一份声明，三种状态。</span>;
}

export function LiveDemo() {
  const [scene, setScene] = useState<SceneId>('states');
  const [active, setActive] = useState(false);
  const [alternate, setAlternate] = useState(false);
  const [focused, setFocused] = useState(false);
  const [disabled, setDisabled] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [resetVersion, setResetVersion] = useState(0);
  const branch = alternate ? styles.alternate : styles.card;
  const current = scenes.find((item) => item.id === scene)!;
  function reset() {
    setActive(false); setAlternate(false); setFocused(false); setDisabled(false); setLoaded(false);
    setResetVersion((version) => version + 1);
  }
  return <section aria-label="React Vite live examples" className="live-page">
    <div className="page-heading"><span className="eyebrow">交互体验 / REACT + VITE</span><h1>看得到的样式变化<span className="heading-dot">.</span></h1>
      <p>选一个场景，动手试一下。想知道为什么，再展开下面的源码。</p></div>
    <div className="scene-tabs" role="group" aria-label="选择体验场景">{scenes.map((item, index) =>
      <button key={item.id} data-testid={`scene-${item.id}`} aria-pressed={scene === item.id} onClick={() => { setScene(item.id); reset(); }}>
        <span className="scene-number">{String(index + 1).padStart(2, '0')}</span>{item.label}
      </button>)}</div>
    <div className="scene-panel" data-testid="scene-panel">
      <div className="panel-heading"><div><span className="panel-kicker">场景 {String(scenes.indexOf(current) + 1).padStart(2, '0')}</span><h2>{current.title}</h2><p>{current.description}</p></div>
        <button className="text-button" onClick={reset} data-testid="reset-demo">↺ 重置</button></div>
      <div className="scene-layout"><div className="demo-column" key={resetVersion}>
        {scene === 'states' ? <>
          <div className="preview-canvas"><div className={branch.self + ' sample-card'} data-active={active ? 'yes' : 'no'}>
            <div className="sample-card-top"><span className="sample-avatar">G</span><span className="sample-kicker">一张由 .gss 驱动的卡片</span></div>
            <Title scope={branch} /><p className="sample-description">结构不变，让声明和状态决定外观。</p>
            <span className="sample-state">{alternate ? '另一组样式' : active ? '已选中' : '基础状态'}</span>
          </div></div>
          <div className="demo-controls"><button className="button primary" disabled={alternate} title={alternate ? '另一组样式没有选中规则，返回基础样式后可用' : undefined} aria-pressed={active} onClick={() => setActive(!active)} data-testid="toggle-active">{active ? '取消选中态' : '切换选中态'}</button>
            <button className="button" aria-pressed={alternate} onClick={() => { setAlternate(!alternate); setActive(false); }} data-testid="toggle-alias">{alternate ? '返回基础样式' : '换一组样式'}</button>{alternate ? <span className="control-hint">这组样式不含选中规则</span> : null}</div>
        </> : null}
        {scene === 'interactions' ? <>
          <div className="preview-canvas"><div className="interaction-stack"><button data-testid="state-action" className={styles.action.self + ' state-action'} disabled={disabled}>试试悬停或按 Tab 聚焦</button>
            <input className={styles.field.self + ' demo-input'} placeholder="这段占位文字来自 ::placeholder" aria-label="Placeholder example" />
            <p className={styles.decoration.self + ' decoration-sample'}>这是正文</p></div></div>
          <div className="demo-controls"><button className="button" data-testid="toggle-disabled" aria-pressed={disabled} onClick={() => setDisabled(!disabled)}>{disabled ? '启用按钮' : '禁用按钮'}</button></div>
        </> : null}
        {scene === 'relations' ? <div className="preview-canvas"><div className="relation-grid">
          <div className="relation-example"><span className="sample-kicker">直接子元素</span><div className={relations.parent.self}><span className={relations.parent.child.self}>只有 child 命中这个背景</span></div></div>
          <div className="relation-example"><span className="sample-kicker">相邻兄弟 · +</span><div><input id="relation-check" type="checkbox" className={relations.check.self} /><label htmlFor="relation-check" data-testid="relation-label" className={relations.check.label.self}>勾选后，标签变蓝</label></div></div>
          <div className="relation-example"><span className="sample-kicker">容器观察 · :has()</span><div className={relations.observer.self} data-testid="observer-node"><label><input type="checkbox" data-testid="observer-check" aria-label="观察容器中的复选框" />勾选后，容器变绿</label></div></div>
          <div className="relation-example"><span className="sample-kicker">后续兄弟 · ~</span><div><span className={relations.source.self}>来源 → </span><span className={relations.source.target.self}>被匹配的目标</span></div></div>
        </div></div> : null}
        {scene === 'external' ? <>
          <div className="preview-canvas"><div data-testid="external-node" className={external.editor.self + ' editor-sample' + (focused ? ' focused' : '')}>
            <div className="editor-bar"><span aria-hidden="true">● ● ●</span><span>示例编辑器</span></div><div className="editor-content">外部类名可以参与样式，<br />无需接管它的生命周期。</div>
          </div></div>
          <div className="demo-controls"><button className="button primary" data-testid="toggle-external" aria-pressed={focused} onClick={() => setFocused(!focused)}>{focused ? '移除 focused 类名' : '添加 focused 类名'}</button></div>
        </> : null}
        {scene === 'resources' ? <>
          <div className="preview-canvas resource-canvas"><div className="resource-items"><div><span className="sample-kicker">本地 SVG</span><div data-testid="asset" className={resources.asset.self} aria-label="Local SVG Asset" /></div>
            <div className={resources.provider.self}><span className="sample-kicker">原生变量继承</span><span className={resources.provider.inherited.self}>我继承了蓝色</span></div>
            <div><span className="sample-kicker">暂停在起点的动画</span><div className={resources.motion.self + ' motion-block'} /><small>opacity: 0.25</small></div></div>
            <Suspense fallback={<p className="subtle">正在加载组件…</p>}>{loaded ? <LazyCard /> : <div className="lazy-placeholder">↓ 组件尚未挂载，点击下方按钮加载</div>}</Suspense>
          </div>
          <div className="demo-controls"><button className="button primary" data-testid="load-lazy" onClick={() => setLoaded(true)} disabled={loaded}>{loaded ? '组件已加载' : '加载 React 组件'}</button></div>
        </> : null}
        {scene === 'implicit' ? <ImplicitDemo key={resetVersion} /> : null}
      </div><aside className="expectation-panel"><span className="expectation-icon" aria-hidden="true">↳</span><h3>你应该看到</h3><p>{current.expected}</p><details className="concept-details" key={scene}><summary>了解对应的技术能力</summary><p className="subtle">{current.concept}</p></details><span className="scope-label">真实 React / Vite 消费</span></aside></div>
    </div>
    <details className="inspector" data-testid="live-source" key={scene}><summary><span>查看这个场景的源码</span><span className="summary-meta">{current.file}</span></summary><div className="inspector-content"><pre>{current.source}</pre>
      <p className="subtle">可在本地编辑对应文件。修改样式后保存，检查原生 Vite 更新；制造编译错误时应保留旧样式，修复后恢复。依赖变化可能触发 reload，不承诺 React state 永久保持。TSX 使用显式 .self，不扩大 React 的原生 className 类型。</p></div></details>
  </section>;
}
