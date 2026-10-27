import type { GssSourceRange, SourceAdapterDiagnostic } from '@gss-l/compiler';
import type { Rollup } from 'vite';

type SourceSnapshot = { id: string; source: string };

/** Native host locations are one-based lines and zero-based UTF-16 columns. */
function location(diagnostic: SourceAdapterDiagnostic & { range?: GssSourceRange }, snapshot: SourceSnapshot): Pick<Rollup.RollupLog, 'loc' | 'frame'> {
  const range = diagnostic.range;
  if (diagnostic.id !== snapshot.id || !range) return {};
  const { source } = snapshot;
  const { start, end } = range;
  const boundary = (offset: number) => Number.isInteger(offset) && offset >= 0 && offset <= source.length &&
    !(offset > 0 && /[\uD800-\uDBFF]/.test(source[offset - 1]!) && /[\uDC00-\uDFFF]/.test(source[offset] ?? ''));
  if (!boundary(start) || !boundary(end) || end < start) return {};
  const lines = source.split('\n');
  const starts: number[] = [];
  let offset = 0;
  let first = 0;
  let last = 0;
  for (const line of lines) {
    if (offset <= start) first = starts.length;
    if (offset <= (end > start ? end - 1 : end)) last = starts.length;
    starts.push(offset);
    offset += line.length + 1;
  }
  const width = String(Math.min(lines.length, last + 3)).length;
  const frame: string[] = [];
  for (let index = Math.max(0, first - 2); index <= Math.min(lines.length - 1, last + 2); index += 1) {
    // Bound even large enclosing-rule diagnostics; retain both ends of the selection.
    if (index > first + 3 && index < last - 2) {
      frame.push('…');
      index = last - 3;
      continue;
    }
    const rawLine = lines[index]!;
    const line = index < lines.length - 1 ? rawLine.replace(/\r$/, '') : rawLine;
    const from = Math.max(0, start - starts[index]!);
    const to = Math.min(line.length, end - starts[index]!);
    const sliceStart = Math.max(0, Math.min(from, line.length) - 60);
    const prefix = sliceStart > 0 ? '…' : '';
    const display = line.slice(sliceStart, sliceStart + 160);
    frame.push(`${String(index + 1).padStart(width)} | ${prefix}${display}${sliceStart + 160 < line.length ? '…' : ''}`);
    if (index >= first && index <= last) {
      // One caret denotes an insertion point, including EOF; it does not widen range.
      const padding = rawLine.slice(sliceStart, from).replace(/[^\t]/g, ' ');
      frame.push(`${' '.repeat(width)} | ${' '.repeat(prefix.length)}${padding}${'^'.repeat(Math.max(1, Math.min(to - from, 160 - padding.length)))}`);
    }
  }
  return { loc: { file: snapshot.id, line: first + 1, column: start - starts[first]! }, frame: frame.join('\n') };
}

export function reportDiagnostics(
  context: Rollup.MinimalPluginContext,
  diagnostics: readonly (SourceAdapterDiagnostic & { range?: GssSourceRange })[],
  snapshot?: SourceSnapshot
): void {
  for (const diagnostic of diagnostics) {
    let presentation: Pick<Rollup.RollupLog, 'loc' | 'frame'> = {};
    try {
      if (snapshot) presentation = location(diagnostic, snapshot);
    } catch {
      // Presentation is best-effort; a formatter failure must not replace the diagnostic.
    }
    const log: Rollup.RollupLog = {
      ...diagnostic, message: `[${diagnostic.code}] ${diagnostic.message}`,
      // Already formatted against its owning CSS, not the active importing JSX/map.
      ...(presentation.loc ? { plugin: 'gss-l', pluginCode: diagnostic.code, ...presentation } : {})
    };
    if (diagnostic.severity === 'error') context.error(log);
    else if (diagnostic.severity === 'warning') context.warn(log);
    else context.info(log);
  }
}
