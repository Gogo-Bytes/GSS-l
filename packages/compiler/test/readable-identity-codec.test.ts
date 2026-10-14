import { expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';
import {
  createReadableAtomicName, createReadableScopeMarker, createReadableSourceMarker,
  decodeReadableAtomicName, decodeReadableScopeSourceMarker,
  type PureDeclarationIdentity
} from '../src/domain/readable-name.js';

it.each([
  {
    layer: 'framework.base', condition: 'media:(min-width: 40rem)', state: 'hover',
    pseudoElement: 'before', property: 'background-image', value: 'url(é.svg)', assetValue: true,
    important: true
  },
  {
    layer: 'unlayered', condition: 'base', state: 'self', property: 'color', value: 'red',
    important: false,
    ownership: { moduleId: '../shared/Card.gss', path: ['card', 'icon'], specificity: 2 }
  },
  {
    layer: 'unlayered', condition: 'base', state: 'self', property: 'color', value: 'red',
    important: false,
    ownership: { moduleId: 'tree.gss', path: ['a/b', 'c\\d'], specificity: 0 }
  },
  {
    layer: 'unlayered', condition: 'base', state: 'self', property: 'content', value: '"cafe\u0301"',
    important: false,
    ownership: { moduleId: 'cafe\u0301.gss', path: ['cafe\u0301'], specificity: 0 }
  }
] satisfies PureDeclarationIdentity[])('round-trips bounded atomic identity %j', (identity) => {
  const name = createReadableAtomicName(identity);
  expect(decodeReadableAtomicName(name)).toEqual(identity);
});

it('keeps every canonical identity field collision-free', () => {
  const base: PureDeclarationIdentity = {
    layer: 'base', condition: 'media:x', state: 'hover', pseudoElement: 'before',
    property: 'color', value: 'red', important: false,
    ownership: { moduleId: 'module.gss', path: ['card', 'icon'], specificity: 2 }
  };
  const variants: PureDeclarationIdentity[] = [
    { ...base, layer: 'base-x' }, { ...base, condition: 'media_y' },
    { ...base, state: 'hover-x' }, { ...base, pseudoElement: 'after' },
    { ...base, property: 'background-color' }, { ...base, value: 'red-x' },
    { ...base, important: true },
    { ...base, ownership: { ...base.ownership!, moduleId: 'module-x.gss' } },
    { ...base, ownership: { ...base.ownership!, path: ['card-x', 'icon'] } },
    { ...base, ownership: { ...base.ownership!, specificity: 3 } }
  ];
  const names = new Set(variants.map((identity) => createReadableAtomicName(identity)));
  expect(names.size).toBe(variants.length);
  for (const identity of variants) expect(decodeReadableAtomicName(createReadableAtomicName(identity))).toEqual(identity);
});

it('rejects alternate spellings and field permutations of one canonical atomic name', () => {
  const canonical = createReadableAtomicName({ layer: 'base', condition: 'base', state: 'self',
    property: 'color', value: 'é', important: false });
  expect(decodeReadableAtomicName(canonical.replace('_e9_', '_E9_'))).toBeUndefined();
  expect(decodeReadableAtomicName(canonical.replace('property_color', 'property__63_olor'))).toBeUndefined();
  expect(decodeReadableAtomicName(canonical.replace('--state_self--property_color',
    '--property_color--state_self'))).toBeUndefined();
});

it.each([
  ['card'], ['a', 'b'], ['a.b'], ['a/b', 'c\\d'], ['café'], ['cafe\u0301']
].map((path) => ({ path })))('round-trips the shared owned scope/source marker path $path', ({ path }) => {
  const moduleId = '../shared/Card.gss';
  const scope = createReadableScopeMarker(moduleId, path);
  expect(scope).toBe(createReadableSourceMarker(moduleId, path));
  expect(decodeReadableScopeSourceMarker(scope)).toEqual({ moduleId, path });
});

it('keeps a bounded cross-product of path boundaries and Unicode scalars injective', () => {
  const segments = ['a', 'b', '.', '/', '\\', 'a.b', 'a/b', 'a\\b', 'é', 'e\u0301'];
  const paths: string[][] = [];
  for (const first of segments) {
    paths.push([first]);
    for (const second of segments) {
      paths.push([first, second]);
      for (const third of segments) paths.push([first, second, third]);
    }
  }
  const names = paths.map((path) => createReadableScopeMarker('tree.gss', path));
  expect(new Set(names).size).toBe(paths.length);
  for (const [index, name] of names.entries()) {
    expect(decodeReadableScopeSourceMarker(name)).toEqual({ moduleId: 'tree.gss', path: paths[index] });
  }
});

it('round-trips wrapped runtime-source markers and rejects noncanonical aliases', () => {
  const marker = createReadableSourceMarker('cafe\u0301.gss', ['a/b', 'c.d'], 'media:(min-width: 40rem)', 'framework.base');
  expect(decodeReadableScopeSourceMarker(marker)).toEqual({
    moduleId: 'cafe\u0301.gss', path: ['a/b', 'c.d'],
    layer: 'framework.base', condition: 'media:(min-width: 40rem)'
  });
  for (const invalid of [
    marker.replace('module_cafe', 'module__63_afe'),
    marker.replace('layer_framework', 'layer__66_ramework'),
    marker.replace('--layer_', '--layer_unlayered--layer_'),
    marker.replace('--layer_', '--condition_base--layer_'),
    marker.replace(/--path_.+$/, '--path_a_2f_'),
    'gss-s--module_tree_2e_gss--path_a_2e_b--path_a_2e_b'
  ]) expect(decodeReadableScopeSourceMarker(invalid)).toBeUndefined();
});

it('decodes distinct markers emitted from one public Module without relying on a registry', () => {
  const compiler = createGssCompilerSession({ projectRoot: '/project' });
  const replacement = compiler.replaceStylesheet({ id: '/project/tree.gss', source: `
    .a .b .c :global(.external) { color: red; }
    .a\\.b + .x { background-color: blue; }
  ` });
  expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
  const schema = replacement.module!.scopeSchema.exports;
  const nested = schema.a!.targets.b!.selfClassName.split(' ').find((part) => part.startsWith('gss-s--'))!;
  const escaped = schema['a.b']!.selfClassName.split(' ').find((part) => part.startsWith('gss-s--'))!;
  expect(decodeReadableScopeSourceMarker(nested)).toEqual({ moduleId: 'tree.gss', path: ['a', 'b'] });
  expect(decodeReadableScopeSourceMarker(escaped)).toEqual({ moduleId: 'tree.gss', path: ['a.b'] });
});

it.each([
  'gss-s--layer_unlayered--path_card',
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_red--importance_normal--module_x',
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_red--importance_normal--specificity_2',
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_red--importance_normal--value_red'
])('rejects malformed atomic identity name: %s', (name) => {
  expect(decodeReadableAtomicName(name)).toBeUndefined();
});
