import React, { useEffect, useRef, useState } from 'react';
import payload from 'virtual:reference-fixtures';
import type { CompiledReferenceFixture } from '../browser/fixtures.js';
import { readDocument, type Reading } from '../browser/read-fixture.js';
import { familyLabel, fixtureTitle } from './presentation.js';
// The host compiles and typechecks this exact serialized payload.
const fixtures = payload as readonly (CompiledReferenceFixture & { family: string; referenceKind: string })[];
type Row = Reading & { side: string };

export default function FixtureExplorer({ onPendingChange }: { onPendingChange: (value: boolean) => void }) {
  const [name, setName] = useState('ownership-module-isolation');
  const [query, setQuery] = useState('');
  const [phase, setPhase] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState('');
  const [sweepError, setSweepError] = useState('');
  const [running, setRunning] = useState(false);
  const reference = useRef<HTMLDivElement>(null);
  const atomic = useRef<HTMLDivElement>(null);
  const fixture = fixtures.find((entry) => entry.name === name)!;
  const phases = ['baseline', ...(fixture.phases ?? []).map((entry) => entry.name)];
  const matches = fixtures.filter((entry) => `${entry.family} ${entry.name} ${familyLabel(entry.family)} ${fixtureTitle(entry)}`.toLowerCase().includes(query.toLowerCase()));
  // Keep the controlled select truthful even when a filter excludes its current value.
  const filtered = matches.some((entry) => entry.name === name) ? matches : [fixture, ...matches];
  useEffect(() => {
    let cancelled = false;
    const containers = [document.createElement('div'), document.createElement('div')];
    reference.current!.append(containers[0]!);
    atomic.current!.append(containers[1]!);
    setBusy(true); onPendingChange(true); setRows([]); setError('');
    Promise.all((['reference', 'atomic'] as const).map(async (side, index) => {
      const readings = await readDocument(fixture, side, undefined, { container: containers[index]!, phaseLimit: phase + 1 });
      return readings.map((row) => ({ ...row, side }));
    })).then((results) => { if (!cancelled) setRows(results.flat()); })
      .catch((reason: unknown) => { if (!cancelled) setError(String(reason)); })
      .finally(() => { if (!cancelled) { setBusy(false); onPendingChange(false); } });
    return () => { cancelled = true; containers.forEach((container) => container.remove()); };
  }, [fixture, phase, onPendingChange]);
  const failures = rows.filter((row) => row.value !== row.expected);
  const currentRows = rows.filter((row) => row.phase === phases[phase]);
  const status = busy ? 'running' : error || failures.length || !rows.length ? 'failed' : 'passed';
  async function runAll() {
    setRunning(true); onPendingChange(true); setSweepError('');
    const container = document.createElement('div');
    container.className = 'offscreen'; document.body.append(container);
    let comparisons = 0;
    try {
      for (const [index, entry] of fixtures.entries()) {
        setProgress(`正在检查 ${index + 1}/${fixtures.length} · ${fixtureTitle(entry)}`);
        const values = [];
        for (const side of ['reference', 'atomic'] as const) {
          const readings = await readDocument(entry, side, undefined, { container });
          if (readings.length === 0 || readings.some((row) => row.value !== row.expected)) {
            throw new Error(`${entry.name}/${side}: missing readings or literal mismatch`);
          }
          values.push(readings); container.replaceChildren();
        }
        if (JSON.stringify(values[0]) !== JSON.stringify(values[1])) throw new Error(`${entry.name}: native/atomic mismatch`);
        comparisons += values[0]!.length;
      }
      setProgress(`全部通过 · ${fixtures.length} 个案例 / ${comparisons} 项对比`);
    } catch (reason) { setSweepError(String(reason)); setProgress('检查未通过'); }
    finally { container.remove(); setRunning(false); onPendingChange(false); }
  }
  return <section aria-label="Native fixture explorer">
    <div className="page-heading"><span className="eyebrow">浏览器对照 / COMPILER + NATIVE CSS</span><h1>两种 CSS，同一份预期<span className="heading-dot">.</span></h1>
      <p>左边是独立参考 CSS，右边是编译结果。选择案例与操作步骤，检查两边的真实计算值。</p></div>
    <div className="catalog-toolbar"><label>搜索案例<input aria-label="搜索浏览器案例" placeholder="试试：属性、layer、模块隔离…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <label className="wide-choice">选择案例<select data-testid="fixture-select" value={name} disabled={busy || running} onChange={(event) => { setName(event.target.value); setPhase(0); }}>
        {filtered.map((entry) => <option key={entry.name} value={entry.name}>{String(fixtures.indexOf(entry) + 1).padStart(3, '0')} · {fixtureTitle(entry)}</option>)}</select></label>
      <label>操作步骤<select data-testid="phase-select" value={phase} disabled={busy || running} onChange={(event) => setPhase(Number(event.target.value))}>
        {phases.map((entry, index) => <option key={index} value={index}>{index === 0 ? '初始状态' : `步骤 ${index} · ${entry}`}</option>)}</select></label></div>
    <p className="filter-hint">{matches.length} / {fixtures.length} 个案例{!matches.some((entry) => entry.name === name) ? ' · 当前选择不在搜索结果中，已保留以便查看' : ''}</p>
    <div className="result-panel"><div className="result-heading"><div><span className="panel-kicker">{familyLabel(fixture.family)}</span><h2>{fixtureTitle(fixture)}</h2></div>
      <span className="result-status" role="status" data-testid="fixture-status" data-state={status}>{busy ? '正在读取…' : status === 'failed' ? '对照未通过' : `✓ ${rows.length} 项读数符合预期`}</span></div>
      {error ? <p className="error-message" role="alert">{error}</p> : null}
      <div className="comparison"><div className="frame-card"><div className="frame-label"><span>01</span>参考 · 原生 CSS</div><div className="frame-viewport" ref={reference} /></div><div className="frame-card"><div className="frame-label"><span>02</span>结果 · 编译后 CSS</div><div className="frame-viewport" ref={atomic} /></div></div>
      <p className="panel-footnote">这里是测试节点，不是组件设计稿。画布保留案例指定的视口尺寸，内容可滚动；判断依据是计算值，不是像素相似度。</p>
    </div>
    <details className="inspector"><summary><span>查看当前步骤的计算值</span><span className="summary-meta">{currentRows.length} 项读数</span></summary><div className="table-scroll"><table><thead><tr><th>来源</th><th>节点 / subject</th><th>属性</th><th>实际值</th><th>预期值</th></tr></thead><tbody>
      {currentRows.map((row, index) => <tr key={index} className={row.value === row.expected ? '' : 'failure'}><td>{row.side === 'reference' ? '原生' : '编译后'}</td><td>{row.moduleId} / {row.node} / {row.subject}</td><td>{row.property}</td><td>{row.value}</td><td>{row.expected}</td></tr>)}
    </tbody></table></div></details>
    <details className="inspector"><summary><span>查看源码与生成结果</span><span className="summary-meta">开发者细节</span></summary><div className="inspector-content"><p className="case-id">{fixture.name} · {fixture.referenceKind}</p>
      <details><summary>输入 .gss、配置与字面预期</summary><pre>{JSON.stringify({ modules: fixture.modules, config: fixture.config ?? {}, nodes: fixture.nodes, phases: fixture.phases }, null, 2)}</pre></details>
      <details><summary>独立参考 CSS</summary><pre>{fixture.reference.css}</pre></details>
      <details><summary>生成的原子 CSS 与 ScopeSchema</summary><pre>{fixture.atomic.css}</pre><pre>{JSON.stringify(fixture.atomic.scopeSchemas, null, 2)}</pre></details>
    </div></details>
    <div className="batch-check"><div><h3>想一次检查全部案例？</h3><p>运行 {fixtures.length} 个原生基线；故意损坏的 controls 请另行运行 browser:check。</p></div><button className="button" onClick={runAll} disabled={running || busy} data-testid="run-all">{running ? '正在检查…' : '检查全部基线'}</button>
      {progress ? <p role="status" data-testid="sweep-status" data-state={running ? 'running' : progress.startsWith('全部通过') ? 'passed' : 'failed'}>{progress}</p> : null}{sweepError ? <p className="error-message" role="alert">{sweepError}</p> : null}</div>
    <p className="scope-note">验证范围：Compiler + 浏览器。这里的注册条件不等于 React / Vite 宿主已开放对应配置。</p>
  </section>;
}
