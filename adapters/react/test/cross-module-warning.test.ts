import { createGssCompilerSession } from '@gss-l/compiler';
import { expect, it } from 'vitest';
import { transformReactGssUsage } from '../src/index.js';

function fixture(expression: string) {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  for (const [id, source] of [
    ['/project/Card.gss', '.card { color: red; } .panel { padding: 1px; }'],
    ['/project/Other.gss', '.other { color: blue; }']
  ]) expect(session.replaceStylesheet({ id: id!, source: source! }).committed).toBe(true);
  const source = `import styles from './Card.gss';\nimport other from './Other.gss';\nimport duplicate from './same-card.gss';\nconst view = <div className={${expression}} />;`;
  const result = transformReactGssUsage({
    id: '/project/View.tsx', source,
    resolveScopeSchema: (id) => session.getScopeSchema(id === './Other.gss' ? '/project/Other.gss' : '/project/Card.gss')
  });
  return { result, source, session };
}

it('warns once for definite same-node module composition without changing explicit classes or source map', () => {
  const { result, source, session } = fixture("styles.card.self + ' ' + other.other.self + ' ' + styles.panel.self");
  expect(result.diagnostics).toEqual([{
    code: 'GSS2107', severity: 'warning', phase: 'transform', id: '/project/View.tsx',
    reason: 'cross-module-class-composition',
    message: 'Same-element className composition from multiple GSS modules is unsupported; there is no cross-module precedence guarantee.',
    suggestion: 'Use scopes from one GSS module on this element.',
    range: { start: source.indexOf('className='), end: source.indexOf(' />;') }
  }]);
  expect(result.code).toBe(source);
  expect(result.map.sourcesContent).toEqual([source]);
  const withoutIdentity = transformReactGssUsage({ id: '/project/View.tsx', source,
    resolveScopeSchema: (id) => ({ exports: session.getScopeSchema(id === './Other.gss' ? '/project/Other.gss' : '/project/Card.gss')!.exports }) });
  expect(withoutIdentity.diagnostics).toEqual([]);
  expect(result.map).toEqual(withoutIdentity.map);
  expect(session.finalize().manifest.modules).toHaveLength(2);
  expect(session.getScopeSchema('/project/Card.gss')!.exports.card!.selfClassName).not.toBe('');
  expect(session.getScopeSchema('/project/Other.gss')!.exports.other!.selfClassName).not.toBe('');
});

it.each([
  ['`external ${styles.card.self} ${other.other.self}`', '`external ${styles.card.self} ${other.other.self}`'],
  ["[styles.card, other.other, 'external'].join(' ')", "[styles.card.self, other.other.self, 'external'].join(' ')"]
])('warns for known simultaneous composition %s and preserves lowering', (expression, lowered) => {
  const { result, source } = fixture(expression!);
  expect(result.diagnostics.map(({ code, severity }) => [code, severity])).toEqual([['GSS2107', 'warning']]);
  expect(result.code).toBe(source.replace(expression!, lowered!));
  expect(result.map.sourcesContent).toEqual([source]);
});

it.each([
  "styles.card.self + ' ' + styles.panel.self",
  "styles.card.self + ' ' + duplicate.card.self",
  "styles.card.self + ' external'",
  'active ? styles.card.self : other.other.self',
  "(active ? styles.card.self : other.other.self) + ' external'",
  "(active && styles.card.self) + ' ' + other.other.self",
  'cx(styles.card.self, other.other.self)',
  'choose(styles.card, other.other)',
  "[styles.card.self, other.other.self, dynamic].join(' ')",
  "[styles.card.self, other.other.self, ...rest].join(' ')",
  "[styles.card.self, other.other.self, call()].join(' ')",
  "[styles.card.self, other.other.self].join(',')",
  "[styles.card.self, other.other.self].filter(Boolean).join(' ')",
  '<><div className={styles.card.self} /><div className={other.other.self} /></>'
])('does not infer definite cross-module co-occurrence for %s', (expression) => {
  expect(fixture(expression).result.diagnostics).toEqual([]);
});

it('does not guess identities for legacy minimal schema callers', () => {
  const source = "import a from './a.gss'; import b from './b.gss'; const view = <div className={[a.card, b.card].join(' ')} />;";
  const result = transformReactGssUsage({ id: '/View.tsx', source,
    resolveScopeSchema: () => ({ exports: { card: { targets: {} } } }) });
  expect(result.diagnostics).toEqual([]);
  expect(result.code).toContain("[a.card.self, b.card.self].join(' ')");
});

it('retains prior alias errors alongside the nonblocking warning', () => {
  const { source, session } = fixture("styles.card.self + ' ' + other.other.self + mutable + ambiguous");
  const result = transformReactGssUsage({ id: '/project/View.tsx',
    source: source.replace('const view', "let mutable = styles.card; const ambiguous = active ? styles.card : 'external'; const view"),
    resolveScopeSchema: (id) => session.getScopeSchema(id === './Other.gss' ? '/project/Other.gss' : '/project/Card.gss') });
  expect(result.diagnostics.map(({ code, severity }) => [code, severity])).toEqual([
    ['GSS2107', 'warning'], ['GSS2103', 'error'], ['GSS2104', 'error']
  ]);
});

it('does not suppress existing implicit string-coercion errors', () => {
  const { result } = fixture("styles.card + ' ' + other.other");
  expect(result.code).toContain("styles.card.self + ' ' + other.other.self");
  expect(result.diagnostics.map(({ code, severity }) => [code, severity])).toEqual([
    ['GSS2107', 'warning'], ['GSS2105', 'error'], ['GSS2105', 'error']
  ]);
});

it.each(['Component', 'UI.Component'])('does not infer DOM forwarding through opaque %s components', (tag) => {
  const { source, session } = fixture("styles.card.self + ' ' + other.other.self");
  const componentSource = source.replace('<div ', `<${tag} `);
  const result = transformReactGssUsage({ id: '/project/View.tsx', source: componentSource,
    resolveScopeSchema: (id) => session.getScopeSchema(id === './Other.gss' ? '/project/Other.gss' : '/project/Card.gss') });
  expect(result.diagnostics).toEqual([]);
  expect(result.code).toBe(componentSource);
});
