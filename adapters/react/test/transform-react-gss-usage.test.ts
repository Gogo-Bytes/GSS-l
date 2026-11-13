import { describe, expect, it } from 'vitest';
import type { ScopeSchema } from '@gss-l/compiler';
import { transformReactGssUsage } from '../src/index.js';

const cardScope: ScopeSchema = {
  moduleId: 'src/Card.gss',
  exports: {
    card: {
      selfClassName: 'card-class',
      targets: {
        icon: { selfClassName: 'icon-class', targets: {} },
        title: { selfClassName: 'title-class', targets: {} }
      }
    },
    panel: {
      selfClassName: 'panel-class',
      targets: { title: { selfClassName: 'panel-title-class', targets: {} } }
    }
  }
};

describe('transformReactGssUsage', () => {
  it('treats inline and named callback bodies alike while retaining direct scope props', () => {
    const source = `import styles from './Card.gss';
const named = e => { e.currentTarget.className = styles.card; };
const view = <Child scope={styles.card} onHover={named}
  onClick={e => { e.currentTarget.className = styles.card; }}
  render={() => <Child scope={styles.card} className={styles.card} />} />;`;
    const result = transformReactGssUsage({
      id: '/project/Card.tsx', source, resolveScopeSchema: () => cardScope
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.code).toBe(source.replaceAll('currentTarget.className = styles.card;',
      'currentTarget.className = styles.card.$class;').replace('className={styles.card}', 'className={styles.card.$class}'));
  });

  it('resolves type aliases at the parameter and typeof values at the annotation', () => {
    const source = `import styles from './Card.gss';
type Props = { scope: typeof styles.card };
function Outer(props: Props) {
  type Props = { scope: string };
  const Nested = (p: Props) => <span className={p.scope} />;
  return <div className={props.scope} />;
}
function Local() {
  const styles = { card: 'plain' };
  type Own = { scope: typeof styles.card };
  const Inline = ({scope}: {scope: typeof styles.card}) => <b className={scope} />;
  const Named = ({scope}: Own) => <b className={scope} />;
}
const Generic = <Props extends { scope: string },>(props: Props) => <b className={props.scope} />;
const Real = ({ scope }: Props) => <i className={scope} />;`;
    const result = transformReactGssUsage({
      id: '/project/card.tsx', source, resolveScopeSchema: () => cardScope
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.code).toBe(source.replace('<div className={props.scope}', '<div className={props.scope.$class}')
      .replace('<i className={scope}', '<i className={scope.$class}'));
  });

  it('uses only declared schema keys, including explicitly declared prototype names', () => {
    const source = `import styles from './Card.gss';
styles.constructor.child;
styles.card.constructor.child;
styles.toString();
styles.card.hasOwnProperty("self");`;
    const transform = (schema: ScopeSchema) => transformReactGssUsage({
      id: '/project/App.tsx', source, resolveScopeSchema: () => schema
    });
    expect(transform(cardScope).code).toBe(source);
    const child = { selfClassName: 'leaf', targets: {} };
    const special = { selfClassName: 'parent', targets: { child } };
    const declared = transform({ moduleId: 'Card.gss', exports: {
      constructor: special, card: { selfClassName: 'card', targets: { constructor: special } }
    } });
    expect(declared.code).toContain('styles.constructor.child.$class;');
    expect(declared.code).toContain('styles.card.constructor.child.$class;');
    expect(declared.diagnostics).toEqual([]);
  });

  it('lowers an alias for an authored self child', () => {
    const result = transformReactGssUsage({
      id: '/project/App.tsx',
      source: `import styles from './Card.gss'; const cls = styles.card.self;
export const App = () => <div className={cls}/>;`,
      resolveScopeSchema: () => ({ moduleId: 'Card.gss', exports: {
        card: { selfClassName: 'parent', targets: { self: { selfClassName: 'child', targets: {} } } }
      } })
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain('const cls = styles.card.self.$class');
  });

  it('reads both an immutable alias and its self child without author suffixes', () => {
    const result = transformReactGssUsage({
      id: '/project/Card.tsx',
      source: `import styles from './Card.gss';
const card = styles.card;
const view = <div className={card}><span className={card.self} /></div>;`,
      resolveScopeSchema: () => ({ exports: { card: { targets: { self: { targets: {} } } } } })
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain('const card = styles.card;');
    expect(result.code).toContain('<div className={card.$class}><span className={card.self.$class} /></div>');
  });

  it.each([
    'styles.card.$class',
    'active ? styles.card.$class : styles.panel.$class',
    'active ? styles.card.$class : "plain"'
  ])('keeps an explicit class string alias as a string: %s', (initializer) => {
    const source = `import styles from './Card.gss';
const cls = ${initializer};
export const App = () => <div className={cls}/>;`;
    const result = transformReactGssUsage({
      id: '/project/App.tsx', source, resolveScopeSchema: () => cardScope
    });
    expect(result.diagnostics).toEqual([]);
    expect(result.code).toBe(source);
  });

  it('lowers a direct GSS scope reference in JSX className to its class string', () => {
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source: `import styles from './Card.gss';\nexport const Card = () => <div className={styles.card} />;`,
      resolveScopeSchema(importId) {
        return importId === './Card.gss' ? cardScope : undefined;
      }
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toBe(
      `import styles from './Card.gss';\n` +
      `export const Card = () => <div className={styles.card.$class} />;`
    );
    expect(result.map).toBeDefined();
  });

  it('passes a lowered className string to a separately transformed child without scope analysis', () => {
    const parent = transformReactGssUsage({
      id: '/project/src/Parent.tsx',
      source: `import styles from './Card.gss';
import { Card } from './Card';
export const Parent = () => <Card className={styles.card} />;`,
      resolveScopeSchema: () => cardScope
    });
    const childSource = `export function Card(props: { className?: string }) {
  return <div className={props.className} />;
}`;
    const child = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source: childSource,
      resolveScopeSchema() {
        throw new Error('A string-only child must not resolve GSS scopes.');
      }
    });

    expect(parent.diagnostics).toEqual([]);
    expect(parent.code).toContain('<Card className={styles.card.$class} />');
    expect(child.diagnostics).toEqual([]);
    expect(child.code).toBe(childSource);
  });

  it('lowers direct GSS paths outside JSX className expressions to strings', () => {
    const source = `import styles from './Card.gss';
window.document.title = styles.card;
useClassName(styles.card.icon);`;
    const result = transformReactGssUsage({
      id: '/project/src/usage.ts',
      source,
      resolveScopeSchema: () => cardScope
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toBe(`import styles from './Card.gss';
window.document.title = styles.card.$class;
useClassName(styles.card.icon.$class);`);
  });

  it('lowers a nested static target path', () => {
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source: `import styles from './Card.gss';\nexport const Icon = () => <i className={styles.card.icon} />;`,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain('className={styles.card.icon.$class}');
    expect(result.diagnostics).toEqual([]);
  });

  it('lowers every static GSS reference nested in a className expression', () => {
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source: `import styles from './Card.gss';\n` +
        `export const Card = ({ active, external }) => ` +
        `<div className={cx(styles.card, active && styles.card.icon, external)} />;`,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain(
      'className={cx(styles.card.$class, active && styles.card.icon.$class, external)}'
    );
    expect(result.diagnostics).toEqual([]);
  });

  it('lowers static GSS references in conditional className branches', () => {
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source: `import styles from './Card.gss';\n` +
        `export const Card = ({ active, fallback }) => ` +
        `<div className={active ? styles.card : fallback} />;`,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain('className={active ? styles.card.$class : fallback}');
    expect(result.diagnostics).toEqual([]);
  });

  it('lowers a direct immutable local scope alias in className', () => {
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source: `import styles from './Card.gss';\n` +
        `export const Card = () => { const card = styles.card; ` +
        `return <div className={card} />; };`,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain('className={card}');
    expect(result.code).toContain('const card = styles.card.$class;');
    expect(result.diagnostics).toEqual([]);
  });

  it('lowers an immutable conditional alias when every branch is a GSS scope', () => {
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source: `import styles from './Card.gss';\n` +
        `export const Card = ({ active }) => { ` +
        `const branch = active ? styles.card : styles.panel; ` +
        `return <div className={branch} />; };`,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain('const branch = active ? styles.card.$class : styles.panel.$class;');
    expect(result.code).toContain('className={branch}');
    expect(result.diagnostics).toEqual([]);
  });

  it('lowers a target read from an immutable conditional scope alias', () => {
    const source = `import styles from './Card.gss';
const branch = active ? styles.card : styles.panel;
const view = <span className={branch.title} />;`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.code).toContain('className={branch.title.$class}');
  });

  it('keeps a conditional alias selection at initialization across repeated child reads', () => {
    const source = `import styles from './Card.gss';
let calls = 0;
const select = () => ++calls === 1;
const branch = select() ? styles.card : styles.panel;
const first = branch.title + ' extra';
const second = branch.title;`;
    const result = transformReactGssUsage({
      id: '/project/App.js', source, resolveScopeSchema: () => cardScope
    });
    expect(result.diagnostics).toEqual([]);
    const read = new Function('styles', result.code.slice(result.code.indexOf('\n')) +
      '\nreturn [calls, first, second];');
    expect(read({ card: { title: { $class: 'red' } }, panel: { title: { $class: 'blue' } } }))
      .toEqual([1, 'red extra', 'red']);
  });

  it('lowers a renamed property-destructured scope alias', () => {
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source: `import styles from './Card.gss';\n` +
        `export const Card = () => { const { icon: glyph } = styles.card; ` +
        `return <i className={glyph} />; };`,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain('className={glyph.$class}');
    expect(result.diagnostics).toEqual([]);
  });

  it('rejects a conditional alias that mixes a GSS scope and a string', () => {
    const source = `import styles from './Card.gss';\n` +
      `export const Card = ({ active, fallback }) => { ` +
      `const branch = active ? styles.card : fallback; ` +
      `return <div className={branch} />; };`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain('const branch = active ? styles.card.$class : fallback;');
    expect(result.diagnostics).toMatchObject([{
      code: 'GSS2104',
      phase: 'transform',
      reason: 'ambiguous-scope-alias',
      range: { start: source.lastIndexOf('branch'), end: source.lastIndexOf('branch') + 6 }
    }]);
  });

  it('rejects a mutable local alias derived from a GSS scope', () => {
    const source = `import styles from './Card.gss';\n` +
      `export const Card = () => { let card = styles.card; ` +
      `return <div className={card} />; };`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain('let card = styles.card.$class;');
    expect(result.diagnostics).toMatchObject([{
      code: 'GSS2103',
      phase: 'transform',
      reason: 'mutable-scope-alias',
      range: { start: source.lastIndexOf('card'), end: source.lastIndexOf('card') + 4 }
    }]);
  });

  it('lowers a destructured prop explicitly typed as a GSS scope', () => {
    const result = transformReactGssUsage({
      id: '/project/src/CardBody.tsx',
      source: `import type styles from './Card.gss';\n` +
        `type Props = { scope: typeof styles.card; className?: string };\n` +
        `export const CardBody = ({ scope, className }: Props) => ` +
        `<div className={cx(scope, className)} />;`,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain('className={cx(scope.$class, className)}');
    expect(result.diagnostics).toEqual([]);
  });

  it('lowers a destructured scope prop with an inline type annotation', () => {
    const result = transformReactGssUsage({
      id: '/project/src/CardBody.tsx',
      source: `import type styles from './Card.gss';\n` +
        `export const CardBody = ({ scope, title }: { ` +
        `scope: typeof styles.card; title: string }) => ` +
        `<div className={scope}>{title}</div>;`,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain('className={scope.$class}');
    expect(result.diagnostics).toEqual([]);
  });

  it('supports a typed scope passed from a parent component to a child', () => {
    const parentSource = `import styles from './Card.gss';\n` +
      `import { CardBody } from './CardBody';\n` +
      `export const Card = () => <CardBody scope={styles.card} />;`;
    const childSource = `import type styles from './Card.gss';\n` +
      `type Props = { scope: typeof styles.card };\n` +
      `export const CardBody = ({ scope }: Props) => <div className={scope} />;`;

    const parent = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source: parentSource,
      resolveScopeSchema() { return cardScope; }
    });
    const child = transformReactGssUsage({
      id: '/project/src/CardBody.tsx',
      source: childSource,
      resolveScopeSchema() { return cardScope; }
    });

    expect(parent.code).toBe(parentSource);
    expect(parent.diagnostics).toEqual([]);
    expect(child.code).toContain('className={scope.$class}');
    expect(child.diagnostics).toEqual([]);
  });

  it('lowers a scope property read from a typed props object', () => {
    const result = transformReactGssUsage({
      id: '/project/src/CardBody.tsx',
      source: `import type styles from './Card.gss';\n` +
        `type Props = { scope: typeof styles.card; title: string };\n` +
        `export const CardBody = (props: Props) => ` +
        `<div className={props.scope}>{props.title}</div>;`,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain('className={props.scope.$class}');
    expect(result.code).toContain('{props.title}');
    expect(result.diagnostics).toEqual([]);
  });

  it('locates each use of a reassigned typed prop in the original JSX input', () => {
    const expression = 'props.\r\n        scope';
    const source = [
      "import type styles from './Card.gss';",
      'type Props = { scope: typeof styles.card };',
      'export function Card(props: Props, next: Props) {',
      '  props = next;',
      `  return <><div title="😀" className={${expression}}/><i className={props.scope}/></>;`,
      '}'
    ].join('\r\n');
    const { diagnostics } = transformReactGssUsage({
      id: '/project/src/Card.tsx', source, resolveScopeSchema: () => cardScope
    });
    expect(diagnostics).toMatchObject([expression, 'props.scope'].map(text => ({
      code: 'GSS2103', severity: 'error', id: '/project/src/Card.tsx',
      range: { start: source.indexOf(text), end: source.indexOf(text) + text.length }
    })));
  });

  it('does not rewrite a local binding that shadows a GSS import', () => {
    const source = `import styles from './Card.gss';\n` +
      `export const Inner = (styles) => <div className={styles.card} />;`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toBe(source);
    expect(result.diagnostics).toEqual([]);
  });

  it('leaves a dynamic GSS scope path undefined at runtime when unresolved', () => {
    const source = `import styles from './Card.gss';\n` +
      `export const Card = ({ variant }) => <div className={styles[variant]} />;`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toBe(source);
    expect(result.diagnostics).toEqual([]);
  });

  it('diagnoses implicit string coercion of a GSS scope outside className', () => {
    const source = `import styles from './Card.gss';\n` +
      `export const className = \`prefix \${styles.card}\`;`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain('`prefix ${styles.card.$class}`');
    expect(result.diagnostics).toEqual([]);
  });

  it('keeps mixed aliases rejected after direct path lowering', () => {
    const source = `import styles from './Card.gss';
export const Card = ({ active, fallback }) => { const branch = active ? styles.card : fallback; return <div className={branch} />; };`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain('const branch = active ? styles.card.$class : fallback;');
    expect(result.diagnostics).toMatchObject([{
      code: 'GSS2104',
      phase: 'transform',
      reason: 'ambiguous-scope-alias'
    }]);
  });

  it('diagnoses implicit string coercion of a local GSS scope alias', () => {
    const source = `import styles from './Card.gss';\n` +
      `const card = styles.card; export const className = 'prefix ' + card;`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.diagnostics).toMatchObject([{
      code: 'GSS2105',
      reason: 'scope-string-coercion'
    }]);
  });

  it('allows generated class field in a non-className string context', () => {
    const source = `import styles from './Card.gss';\n` +
      `export const className = \`prefix \${styles.card.$class}\`;`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toBe(source);
    expect(result.diagnostics).toEqual([]);
  });

  it('keeps an generated class field reference unchanged', () => {
    const source = `import styles from './Card.gss';\nexport const Card = () => <div className={styles.card.$class} />;`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toBe(source);
    expect(result.diagnostics).toEqual([]);
  });

  it('leaves an unknown static GSS scope path undefined at runtime', () => {
    const source = `import styles from './Card.gss';\nexport const Card = () => <div className={styles.missing} />;`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toBe(source);
    expect(result.diagnostics).toEqual([]);
  });

  it('leaves non-GSS className expressions unchanged', () => {
    const source = `export const Card = ({ className }) => <div className={className} />;`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return undefined; }
    });

    expect(result.code).toBe(source);
    expect(result.diagnostics).toEqual([]);
  });
});
