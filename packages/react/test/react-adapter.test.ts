import { expect, it } from 'vitest';
import type { GssSourceAdapter } from '@gss-l/compiler';
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
  expect(result.code).toContain('className={styles.card.self}');
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
