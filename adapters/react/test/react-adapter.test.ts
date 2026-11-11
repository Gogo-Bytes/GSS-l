import { expect, it } from 'vitest';
import { createGssCompilerSession, type GssSourceAdapter } from '@gss-l/compiler';
import { react } from '../src/index.js';

it('discovers GSS imports and lowers through the framework-independent Adapter', () => {
  const adapter: GssSourceAdapter = react();
  const input = {
    id: '/project/Card.tsx',
    source: `import styles from './Card.gss';
import './reset.css';
const misleading = "import nope from './fake.gss'";
export const Card = () => <div className={styles.card} />;`
  };
  expect(adapter.supports(input.id)).toBe(true);
  expect(adapter.supports('/project/Card.gss')).toBe(false);
  expect(adapter.discoverImports(input)).toEqual(['./Card.gss']);
  const result = adapter.transform({
    ...input,
    resolveScopeSchema: () => ({
      moduleId: 'Card.gss',
      exports: { card: { selfClassName: 'red', targets: {} } }
    })
  });
  expect(result.code).toContain('className={styles.card.$class}');
  expect(result.diagnostics).toEqual([]);
  expect(result.map?.sourcesContent).toEqual([input.source]);
});

it('fails closed when a discovered GSS import has no ScopeSchema', () => {
  const result = react().transform({
    id: '/project/Card.tsx',
    source: `import styles from './Card.gss'; export const Card = () => <div className={styles.card} />;`,
    resolveScopeSchema: () => undefined
  });
  expect(result.diagnostics).toEqual([expect.objectContaining({
    severity: 'error', reason: 'missing-scope-schema'
  })]);
});

it('reads parent, self child and root names as strings through the generated module', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const { module, diagnostics } = session.replaceStylesheet({
    id: '/project/Card.gss',
    source: '.card { color: red } .card .self { color: blue } .card .item { width: 1px } ' +
      '.self { height: 2px } .\\$class { opacity: 0.5 } .card .\\$other { display: block }'
  });
  expect(diagnostics).toEqual([]);
  expect(module!.declarationCode).toContain('readonly "self": GssScope<{}>');
  const paths = ['card', 'card.self', 'card.item', 'self', '$class', 'card.$other'];
  const result = react().transform({
    id: '/project/Card.js',
    source: `import styles from './Card.gss';\nconst classes = [${paths.map(path => `styles.${path}`).join(', ')}];`,
    resolveScopeSchema: () => module!.scopeSchema
  });
  expect(result.diagnostics).toEqual([]);
  const styles = new Function(module!.moduleCode.replace('export default', 'return'))();
  const read = new Function('styles', result.code.slice(result.code.indexOf('\n')) + '\nreturn classes;');
  const values = read(styles);
  const roots = module!.scopeSchema.exports;
  const card = roots.card!;
  expect(values).toEqual([card.selfClassName, card.targets.self!.selfClassName, card.targets.item!.selfClassName,
    roots.self!.selfClassName, roots.$class!.selfClassName, card.targets.$other!.selfClassName]);
  expect(new Set(values).size).toBe(paths.length);
});
