import { createGssCompilerSession } from '@gss-l/compiler';
import { transformReactGssUsage } from '@gss-l/react';

const prefix = "import styles from './Card.gss';\n";
const cases = [
  { id: 'direct', title: 'Direct static path', source: '<div className={styles.card.title} />;', contains: 'className={styles.card.title.self}' },
  { id: 'composition', title: 'Nested className expression, external class untouched', source: "<div className={cx(styles.card, 'external')} />;", contains: "cx(styles.card.self, 'external')" },
  { id: 'direct-alias', title: 'Immutable direct alias', source: 'const card = styles.card; const view = <div className={card} />;', contains: 'const card = styles.card.self' },
  { id: 'conditional-alias', title: 'All-scope conditional alias', source: 'const branch = active ? styles.card : styles.panel; const view = <div className={branch} />;', contains: 'const branch = active ? styles.card.self : styles.panel.self' },
  { id: 'destructured-alias', title: 'Property alias destructured from a known scope', source: 'const { title: glyph } = styles.card; const view = <span className={glyph} />;', contains: 'className={glyph.self}' },
  { id: 'local-typed-prop', title: 'Local type alias + destructured typed prop', source: 'type Props = { scope: typeof styles.card }; const Card = ({ scope }: Props) => <div className={scope} />;', contains: 'className={scope.self}' },
  { id: 'inline-typed-prop', title: 'Inline typed prop', source: 'const Card = ({ scope }: { scope: typeof styles.card }) => <div className={scope} />;', contains: 'className={scope.self}' },
  { id: 'props-member', title: 'Direct typed props.scope read', source: 'type Props = { scope: typeof styles.card }; const Card = (props: Props) => <div className={props.scope} />;', contains: 'className={props.scope.self}' },
  { id: 'explicit-self', title: 'Explicit string escape (no double lowering)', source: "const name = styles.card.self; const view = <div className={styles.card.self + ' external'} />;", contains: "styles.card.self + ' external'" },
  { id: 'cross-module-warning', title: 'Same-element cross-module composition warning', source: "import other from './Other.gss'; const view = <div className={styles.card.self + ' ' + other.badge.self} />;", diagnostic: 'GSS2107' },
  { id: 'unknown-path', title: 'Unknown static path diagnostic', source: '<div className={styles.missing} />;', diagnostic: 'GSS2102' },
  { id: 'mutable-alias', title: 'Mutable alias diagnostic', source: 'let card = styles.card; const view = <div className={card} />;', diagnostic: 'GSS2103' },
  { id: 'mixed-alias', title: 'Scope/string branch diagnostic', source: "const branch = active ? styles.card : 'external'; const view = <div className={branch} />;", diagnostic: 'GSS2104' },
  { id: 'string-coercion', title: 'Static path string lowering', source: "const name = styles.card + ' external';", contains: 'styles.card.self + \' external\'' },
  { id: 'alias-member', title: 'Conditional alias target path',
    source: 'const branch = active ? styles.card : styles.panel; const view = <span className={branch.title} />;',
    contains: 'className={active ? styles.card.title.self : styles.panel.title.self}' }
];

export function transformPlaygroundCases() {
  const session = createGssCompilerSession({ projectRoot: '/playground' });
  const result = session.replaceStylesheet({ id: '/playground/Card.gss', source: '.card .title { color: red; } .panel .title { color: blue; }' });
  const other = session.replaceStylesheet({ id: '/playground/Other.gss', source: '.badge { color: blue; }' });
  if (!result.committed || !other.committed) throw new Error('Invalid Adapter fixture schema');
  return cases.map((entry) => {
    const source = prefix + entry.source;
    const transformed = transformReactGssUsage({ id: '/playground/Case.tsx', source, resolveScopeSchema: (id) => id === './Other.gss' ? other.module!.scopeSchema : result.module!.scopeSchema });
    const passed = 'diagnostic' in entry
      ? transformed.diagnostics.some((diagnostic) => diagnostic.code === entry.diagnostic)
      : transformed.diagnostics.length === 0 && transformed.code.includes(entry.contains!);
    if (!passed) throw new Error(`Adapter fixture ${entry.id} failed: ${JSON.stringify(transformed)}`);
    return { ...entry, source, level: 'react-transform-only' as const, passed, ...transformed };
  });
}
