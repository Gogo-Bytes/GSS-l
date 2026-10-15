import React, { useEffect, useRef, useState } from 'react';
import payload from 'virtual:reference-fixtures';
import type { CompiledReferenceFixture } from '../browser/fixtures.js';
import { readDocument, type Reading } from '../browser/read-fixture.js';
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
  const [running, setRunning] = useState(false);
  const reference = useRef<HTMLDivElement>(null);
  const atomic = useRef<HTMLDivElement>(null);
  const fixture = fixtures.find((entry) => entry.name === name)!;
  const phases = ['baseline', ...(fixture.phases ?? []).map((entry) => entry.name)];
  const matches = fixtures.filter((entry) => `${entry.family} ${entry.name}`.toLowerCase().includes(query.toLowerCase()));
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
  async function runAll() {
    setRunning(true); onPendingChange(true); setError('');
    const container = document.createElement('div');
    container.className = 'offscreen'; document.body.append(container);
    let comparisons = 0;
    try {
      for (const [index, entry] of fixtures.entries()) {
        setProgress(`${index + 1}/${fixtures.length}: ${entry.name}`);
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
      setProgress(`PASS · ${fixtures.length} fixtures / ${comparisons} comparisons (literal baselines; corruption controls run separately via browser:check)`);
    } catch (reason) { setError(String(reason)); setProgress('FAIL'); }
    finally { container.remove(); setRunning(false); onPendingChange(false); }
  }
  return <section aria-label="Native fixture explorer">
    <h2>独立 Native / Atomic 对照 · {fixtures.length} fixtures</h2>
    <p>复用已有 fixtures 的源码、字面预期、phase 与读取器。每个节点都由对应 ScopeSchema 映射；默认不运行故意损坏的 controls。</p>
    <div className="toolbar"><input aria-label="Filter fixtures" placeholder="按 name / family 过滤" value={query} onChange={(event) => setQuery(event.target.value)} />
      <button onClick={runAll} disabled={running || busy} data-testid="run-all">Run all fixture baselines</button></div>
    <p>{matches.length} matches · 当前选择在过滤时保留</p>
    <p role="status" data-testid="sweep-status">{progress}</p>
    <label>Fixture <select aria-label="Fixture" value={name} disabled={busy || running} onChange={(event) => { setName(event.target.value); setPhase(0); }}>
      {filtered.map((entry) => <option key={entry.name} value={entry.name}>{entry.name}</option>)}</select></label>
    <p><strong>{fixture.family}</strong> · {fixture.referenceKind} · <span className="badge">Compiler/native, not host-registration support</span></p>
    <label>Phase <select aria-label="Phase" value={phase} disabled={busy || running} onChange={(event) => setPhase(Number(event.target.value))}>
      {phases.map((entry, index) => <option key={index} value={index}>{entry}</option>)}</select></label>
    <p role="status" data-testid="fixture-status">{busy ? 'Running…' : error ? `FAIL · ${error}` : failures.length ? `FAIL · ${failures.length} literal mismatches` : `PASS · ${rows.length} readings across phases 0–${phase}`}</p>
    <div className="comparison"><div><h3>Independent native</h3><div ref={reference} /></div><div><h3>Atomic</h3><div ref={atomic} /></div></div>
    <details open><summary>当前 phase 的实际值 / 字面预期</summary><div className="table-scroll"><table><thead><tr><th>Side</th><th>Module / node / subject</th><th>Property</th><th>Actual</th><th>Expected</th></tr></thead><tbody>
      {currentRows.map((row, index) => <tr key={index} className={row.value === row.expected ? '' : 'failure'}><td>{row.side}</td><td>{row.moduleId} / {row.node} / {row.subject}</td><td>{row.property}</td><td>{row.value}</td><td>{row.expected}</td></tr>)}
    </tbody></table></div></details>
    <details><summary>Authored .gss / config / literal expectations</summary><pre>{JSON.stringify({ modules: fixture.modules, config: fixture.config ?? {}, nodes: fixture.nodes, phases: fixture.phases }, null, 2)}</pre></details>
    <details><summary>Independent native CSS</summary><pre>{fixture.reference.css}</pre></details>
    <details><summary>Generated atomic CSS / scope mapping</summary><pre>{fixture.atomic.css}</pre><pre>{JSON.stringify(fixture.atomic.scopeSchemas, null, 2)}</pre></details>
  </section>;
}
