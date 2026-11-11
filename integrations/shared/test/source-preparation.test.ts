import { describe, expect, it, vi } from 'vitest';
import { createGssCompilerSession, type GssSourceAdapter } from '@gss-l/compiler';
import { react } from '@gss-l/react';
import { createStylesheetPreparation, prepareSource, StylesheetPreparationError } from '../src/source-preparation.js';

const config = { projectRoot: '/project' };
const id = '/project/Card.gss';
const source = "import styles from './Card.gss'; export const Card = () => <div className={styles.card} />;";

describe('stylesheet input snapshots', () => {
  it('shares concurrent canonical inputs and reads again only in the next compilation', async () => {
    let css = '.card { color: red; }';
    const read = vi.fn(async () => ({ source: css }));
    const prepare = createStylesheetPreparation(config, read);
    const [a, b] = await Promise.all([prepare(id), prepare(id)]);
    expect(a).toBe(b);
    expect(read).toHaveBeenCalledTimes(1);
    css = '.card { color: blue; }';
    expect((await prepare(id)).input.source).toContain('red');
    expect((await createStylesheetPreparation(config, read)(id)).input.source).toContain('blue');
  });

  it('retains original compiler diagnostics and does not retry a failed input in the same compilation', async () => {
    let css = '.card { color: red;';
    const read = vi.fn(async () => ({ source: css }));
    const expected = createGssCompilerSession(config).replaceStylesheet({ id, source: css });
    expect(expected.committed).toBe(false);
    const prepare = createStylesheetPreparation(config, read);
    await expect(prepare(id)).rejects.toMatchObject({ diagnostics: expected.diagnostics, input: { id, source: css } });
    css = '.card { color: red; }';
    await expect(prepare(id)).rejects.toMatchObject({ input: { id, source: '.card { color: red;' } });
    expect(read).toHaveBeenCalledTimes(1);
    expect((await createStylesheetPreparation(config, read)(id)).module.scopeSchema.exports.card).toBeDefined();
  });

  it('preserves IO failures without turning them into CSS diagnostics', async () => {
    const error = new Error('read denied');
    const prepare = createStylesheetPreparation(config, async () => { throw error; });
    await expect(prepare(id)).rejects.toBe(error);
  });

  it('owns asset reference snapshots without retaining mutable host references', async () => {
    const assetReferences = [{ url: './image.png', identity: 'image-1' }];
    const prepare = createStylesheetPreparation(config, async () => ({
      source: '.card { background-image: url("./image.png"); }', assetReferences
    }));
    const prepared = await prepare(id);
    assetReferences[0]!.identity = 'image-2';
    expect(prepared.input.assetReferences).toEqual([{ url: './image.png', identity: 'image-1' }]);
    expect(Object.isFrozen(prepared.input)).toBe(true);
    expect(Object.isFrozen(prepared.input.assetReferences?.[0])).toBe(true);
  });

  it('keeps preserved fallback and its warning instead of treating it as a preparation error', async () => {
    const prepared = await createStylesheetPreparation(config, async () => ({
      source: '.card { future-property: value; }'
    }))(id);
    expect(prepared.module.compilationMode).toBe('preserved');
    expect(prepared.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'GSS1104' })]));
  });
});

describe('source preparation', () => {
  it('uses raw specifiers to supply schemas and lets the React adapter lower the original JSX', async () => {
    const prepare = createStylesheetPreparation(config, async () => ({ source: '.card { color: red; }' }));
    const resolve = vi.fn(async () => id);
    const watch = vi.fn();
    const output = await prepareSource(react(), { id: '/project/Card.tsx', source }, { resolve, watch, prepare });
    expect(resolve).toHaveBeenCalledWith('./Card.gss', '/project/Card.tsx');
    expect(watch).toHaveBeenCalledWith(id);
    expect(output?.dependencies).toEqual([id]);
    expect(output?.transformed?.code).toContain('className={styles.card.$class}');
    expect(output?.transformed?.map?.sourcesContent).toEqual([source]);
    expect(output?.transformed?.diagnostics).toEqual([]);
  });

  it('deduplicates aliases by canonical ID while keeping both specifier lookups', async () => {
    const read = vi.fn(async () => ({ source: '.card { color: red; }' }));
    const prepare = createStylesheetPreparation(config, read);
    const input = "import a from './Card.gss'; import b from '@/Card.gss'; export const Card = () => <><div className={a.card}/><div className={b.card}/></>;";
    const output = await prepareSource(react(), { id: '/project/Card.tsx', source: input }, {
      resolve: async () => id, watch: () => {}, prepare
    });
    expect(read).toHaveBeenCalledTimes(1);
    expect(output?.dependencies).toEqual([id]);
    expect(output?.transformed?.code).toContain('className={a.card.$class}');
    expect(output?.transformed?.code).toContain('className={b.card.$class}');
  });

  it('registers a failed dependency before preparation and never calls transform with an old schema', async () => {
    const adapter = react();
    const transform = vi.spyOn(adapter, 'transform');
    const watched: string[] = [];
    const prepare = createStylesheetPreparation(config, async () => {
      expect(watched).toEqual([id]);
      return { source: '.card { color: red;' };
    });
    await expect(prepareSource(adapter, { id: '/project/Card.tsx', source }, {
      resolve: async () => id, watch: (id) => { watched.push(id); }, prepare
    })).rejects.toBeInstanceOf(StylesheetPreparationError);
    expect(transform).not.toHaveBeenCalled();
  });

  it('distinguishes unsupported inputs from a supported source that removed its imports', async () => {
    const adapter = react();
    const transform = vi.spyOn(adapter, 'transform');
    const host = { resolve: vi.fn(async () => id), watch: vi.fn(), prepare: createStylesheetPreparation(config,
      async () => ({ source: '.card { color: red; }' })) };
    expect(await prepareSource(adapter, { id: '/project/Card.vue', source: '' }, host)).toBeUndefined();
    expect(await prepareSource(adapter, { id: '/project/Card.tsx', source: 'export const x = 1;' }, host))
      .toEqual({ dependencies: [], stylesheetDiagnostics: [], transformed: null });
    expect(host.resolve).not.toHaveBeenCalled();
    expect(transform).not.toHaveBeenCalled();
  });

  it('propagates host resolution errors without transforming', async () => {
    const error = new Error('Cannot resolve external GSS');
    const adapter = react();
    const transform = vi.spyOn(adapter, 'transform');
    await expect(prepareSource(adapter, { id: '/project/Card.tsx', source }, {
      resolve: async () => { throw error; }, watch: vi.fn(), prepare: createStylesheetPreparation(config,
        async () => ({ source: '.card { color: red; }' }))
    })).rejects.toBe(error);
    expect(transform).not.toHaveBeenCalled();
  });

  it('preserves adapter diagnostics, including their original source ranges', async () => {
    const diagnostic = { code: 'test', severity: 'error', phase: 'transform', message: 'test', id: '/project/Card.tsx',
      range: { start: 1, end: 5 } } as const;
    const adapter: GssSourceAdapter = { supports: () => true, discoverImports: () => ['./Card.gss'],
      transform: ({ source }) => ({ code: source, diagnostics: [diagnostic] }) };
    const output = await prepareSource(adapter, { id: diagnostic.id, source }, {
      resolve: async () => id, watch: () => {}, prepare: createStylesheetPreparation(config,
        async () => ({ source: '.card { color: red; }' }))
    });
    expect(output?.transformed?.diagnostics[0]).toBe(diagnostic);
  });
});
