import type { ParsedCondition } from '../domain/parsed-stylesheet.js';

/** Each entry is a generated structural line; any newline inside one belongs to its CSS tokens. */
export function renderWrappedCss(
  lines: readonly string[], conditions: readonly ParsedCondition[], layer?: string | null
): string {
  const wrappers = conditions.map(({ kind, query }) => `@${kind} ${query}`);
  if (layer) wrappers.unshift(`@layer ${layer}`);
  if (!wrappers.length) return lines.join('\n');
  const indent = '  '.repeat(wrappers.length);
  return [
    ...wrappers.map((wrapper, depth) => `${'  '.repeat(depth)}${wrapper} {`),
    ...lines.map(line => indent + line),
    ...wrappers.map((_, index) => '  '.repeat(wrappers.length - index - 1) + '}')
  ].join('\n');
}
