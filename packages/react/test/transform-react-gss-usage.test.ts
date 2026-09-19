import { describe, expect, it } from 'vitest';
import type { ScopeSchema } from '@gss-l/compiler';
import { transformReactGssUsage } from '../src/index.js';

const cardScope: ScopeSchema = {
  moduleId: 'src/Card.gss',
  exports: {
    card: {
      selfClassName: 'card-class',
      targets: {
        icon: { selfClassName: 'icon-class', targets: {} }
      }
    }
  }
};

describe('transformReactGssUsage', () => {
  it('lowers a direct GSS scope reference in JSX className to self', () => {
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
      `export const Card = () => <div className={styles.card.self} />;`
    );
    expect(result.map).toBeDefined();
  });

  it('lowers a nested static target path', () => {
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source: `import styles from './Card.gss';\nexport const Icon = () => <i className={styles.card.icon} />;`,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toContain('className={styles.card.icon.self}');
    expect(result.diagnostics).toEqual([]);
  });

  it('keeps an explicit self reference unchanged', () => {
    const source = `import styles from './Card.gss';\nexport const Card = () => <div className={styles.card.self} />;`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toBe(source);
    expect(result.diagnostics).toEqual([]);
  });

  it('reports an unknown static GSS scope path', () => {
    const source = `import styles from './Card.gss';\nexport const Card = () => <div className={styles.missing} />;`;
    const result = transformReactGssUsage({
      id: '/project/src/Card.tsx',
      source,
      resolveScopeSchema() { return cardScope; }
    });

    expect(result.code).toBe(source);
    expect(result.diagnostics).toMatchObject([{
      code: 'GSS2102',
      phase: 'transform',
      reason: 'unknown-scope-path'
    }]);
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
