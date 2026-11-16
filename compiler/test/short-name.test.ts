import { expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';
import { createCompilerSession } from '../src/application/compiler-session.js';
import { createDefaultNameAllocator, shortDigest } from '../src/application/name-allocator.js';
import { parseStylesheet } from '../src/infrastructure/postcss-stylesheet-parser.js';

it('uses SHA-256 first six bytes and legal nine-character production names', () => {
  expect(shortDigest('abc')).toBe('ungWv48B');
  for (const namingMode of ['development', 'production'] as const) {
    const session = createGssCompilerSession({ projectRoot: '/project', namingMode });
    expect(session.replaceStylesheet({ id: '/project/a.gss', source: '.a { color: red; }' }).committed).toBe(true);
    expect(session.getScopeSchema('/project/a.gss')!.exports.a!.selfClassName)
      .toBe(namingMode === 'production' ? 'gZaFa4tBh' : 'g-color-red-ZaFa4tBh');
  }
});

it('rejects intra-module, cross-module and replacement collisions without publishing partial state', () => {
  const session = createCompilerSession({ projectRoot: '/project' }, { parseStylesheet },
    () => createDefaultNameAllocator('production', () => 'AAAAAAAA'));
  const replace = (id: string, source: string) => session.replaceStylesheet({ id: `/project/${id}.gss`, source });
  expect(replace('a', '.a { color: red; }').committed).toBe(true);
  const previous = session.finalize();
  for (const [id, source] of [['b', '.b { color: blue; }'], ['a', '.a { color: blue; }'],
    ['b', '.b { color: red; display: block; }'], ['b', '.b :global(.gAAAAAAAA) { color: red; }']]) {
    expect(replace(id!, source!)).toMatchObject({ committed: false,
      diagnostics: [expect.objectContaining({ reason: 'generated-name-collision' })] });
    expect(session.finalize()).toEqual(previous);
  }
  expect(replace('b', '.b { color: red; }').committed).toBe(true);
  session.invalidate('/project/a.gss');
  expect(replace('a', '.a { color: blue; }').committed).toBe(false);
  session.invalidate('/project/b.gss');
  expect(replace('a', '.a { color: blue; }').committed).toBe(true);
});

it.each([false, true])('rejects known external class collisions in either insertion order (%s)', reverse => {
  const session = createGssCompilerSession({ projectRoot: '/project', namingMode: 'production' });
  const inputs = [
    { id: '/project/a.gss', source: '.a { color: red; }' },
    { id: '/project/b.gss', source: '.b :global(.gZaFa4tBh) { display: block; }' }
  ];
  if (reverse) inputs.reverse();
  expect(session.replaceStylesheet(inputs[0]!).committed).toBe(true);
  const previous = session.finalize();
  expect(session.replaceStylesheet(inputs[1]!)).toMatchObject({ committed: false,
    diagnostics: [expect.objectContaining({ reason: 'generated-name-collision' })] });
  expect(session.finalize()).toEqual(previous);
});

it('does not reserve names from rejected preparation and separates generated roles', () => {
  const session = createCompilerSession({ projectRoot: '/project' }, { parseStylesheet },
    () => createDefaultNameAllocator('production', () => 'AAAAAAAA'));
  expect(session.replaceStylesheet({ id: '/project/a.gss',
    source: '@keyframes spin { to { opacity: 0; } } .a { animation-name: spin; }' }).committed).toBe(false);
  expect(session.replaceStylesheet({ id: '/project/b.gss', source: '.b { color: blue; }' }).committed).toBe(true);
});

it('keeps dependent identities, rule order and names deterministic across modes, roots and module traversal', () => {
  const sources = [
    ['a.gss', '@keyframes spin { to { opacity: 0; } } .a { animation: spin 1s; color: red; } .b { color: blue; }'],
    ['b.gss', '.x:not(.y) { color: green; } .x:hover .z { display: block; }']
  ] as const;
  const compile = (root: string, mode: 'development' | 'production', reverse: boolean) => {
    const session = createGssCompilerSession({ projectRoot: root, namingMode: mode });
    for (const [id, source] of reverse ? [...sources].reverse() : sources)
      expect(session.replaceStylesheet({ id: `${root}/${id}`, source }).committed).toBe(true);
    return session.finalize();
  };
  const prod = compile('/project', 'production', false);
  expect(compile('/other', 'production', true)).toEqual(prod);
  const dev = compile('/project', 'development', false);
  expect(dev.manifest.rules.map(rule => rule.className.slice(-8)))
    .toEqual(prod.manifest.rules.map(rule => rule.className.slice(1)));
  expect(dev.manifest.rules.map(({ property, important, origins }) => ({ property, important, origins })))
    .toEqual(prod.manifest.rules.map(({ property, important, origins }) => ({ property, important, origins })));
  expect(prod.manifest.resources.every(({ name }) => /^g[\w-]{8}$/.test(name))).toBe(true);
});
