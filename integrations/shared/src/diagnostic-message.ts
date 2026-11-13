import type { ReplaceStylesheetInput, SourceAdapterDiagnostic } from '@gss-l/compiler';

/** Format only ranges belonging to the supplied immutable input snapshot. */
export function formatDiagnosticMessages(diagnostics: readonly SourceAdapterDiagnostic[], input?: Readonly<ReplaceStylesheetInput>): string {
  return diagnostics.map(d => {
    const base = `[${d.code}] ${d.id}: ${d.message}`;
    const range = d.range;
    if (!input || input.id !== d.id || !range) return base;
    const { source } = input;
    const boundary = (n: number) => Number.isInteger(n) && n >= 0 && n <= source.length &&
      !(n > 0 && /[\uD800-\uDBFF]/.test(source[n - 1]!) && /[\uDC00-\uDFFF]/.test(source[n] ?? ''));
    if (!boundary(range.start) || !boundary(range.end) || range.end < range.start) return base;
    const lineStart = range.start === 0 ? 0 : source.lastIndexOf('\n', range.start - 1) + 1;
    const lineEnd = source.indexOf('\n', range.start);
    const line = source.slice(lineStart, lineEnd < 0 ? source.length : lineEnd).replace(/\r$/, '');
    const lineNumber = source.slice(0, lineStart).split('\n').length;
    const column = range.start - lineStart;
    const sliceStart = Math.max(0, column - 60);
    const prefix = sliceStart ? '…' : '';
    const display = line.slice(sliceStart, sliceStart + 160);
    const padding = line.slice(sliceStart, column).replace(/[^\t]/g, ' ');
    const carets = '^'.repeat(Math.max(1, Math.min(range.end - range.start, display.length - padding.length)));
    return `${base}\n${d.id}:${lineNumber}:${column + 1}\n${lineNumber} | ${prefix}${display}${sliceStart + 160 < line.length ? '…' : ''}\n${' '.repeat(String(lineNumber).length)} | ${' '.repeat(prefix.length)}${padding}${carets}`;
  }).join('\n');
}
