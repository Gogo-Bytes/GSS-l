import { expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';
import {
  createReadableAtomicName, createReadableContextMarker, createReadableHasSubjectMarker,
  createReadableKeyframesName, createReadableObservedMarker, createReadableScopeMarker,
  createReadableSourceMarker, createReadableTargetMarker, decodeReadableAtomicName,
  decodeReadableContextMarker, decodeReadableKeyframesName, decodeReadableObservedMarker,
  decodeReadableScopeSourceMarker, decodeReadableTargetMarker,
  type ContextualRelationIdentity, type ObservedRelationIdentity,
  type PureDeclarationIdentity
} from '../src/domain/readable-name.js';

it.each([
  {
    layer: 'unlayered', condition: 'base', state: 'self', property: 'margin-left', value: '1px',
    important: false, atomRank: 1, orderSlot: 4
  },
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
    { ...base, atomRank: 1, orderSlot: 1 }, { ...base, atomRank: 1, orderSlot: 2 },
    { ...base, atomRank: 2, orderSlot: 2 },
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

it('round-trips every encoded contextual target field, including both condition positions', () => {
  const identity: ContextualRelationIdentity = {
    moduleId: 'cafe\u0301.gss', layer: 'framework.base', condition: 'media:x',
    relations: ['child', 'adjacent'], authoredPath: ['card', 'a/b'],
    sourceState: 'hover', sourceAttribute: 'data-mode=ready',
    sourcePath: ['card', 'a/b'], targetPath: ['card', 'a/b', 'c\\d']
  };
  const name = createReadableTargetMarker(identity);
  expect(decodeReadableTargetMarker(name)).toEqual(identity);
  const variants: ContextualRelationIdentity[] = [
    { ...identity, moduleId: 'café.gss' }, { ...identity, layer: 'framework.utilities' },
    { ...identity, condition: 'media:y' }, { ...identity, relations: ['child', 'general-sibling'] },
    { ...identity, authoredPath: ['card', 'a', 'b'] }, { ...identity, sourceState: 'focus' },
    { ...identity, sourceAttribute: 'data-mode=idle' },
    { ...identity, sourcePath: ['card', 'a', 'b'] }, { ...identity, targetPath: ['card', 'a/b', 'd'] }
  ];
  expect(new Set([name, ...variants.map(createReadableTargetMarker)]).size).toBe(variants.length + 1);
  for (const variant of variants) expect(decodeReadableTargetMarker(createReadableTargetMarker(variant))).toEqual(variant);
  for (const invalid of [
    name.replace('--relation_', '--relation_unknown_2f_'),
    name.replace(/--source_[^-]*(?=--target_)/, '--source_a_2f_'),
    name.replace('--layer_', '--layer_unlayered--layer_'),
    name.replace('--state_hover', '--state_hover--state_focus'),
    name.replace('--target_card', '--target__63_ard'),
    name.replace('module_cafe', 'module__63_afe')
  ]) expect(decodeReadableTargetMarker(invalid)).toBeUndefined();
});

it.each([
  { observedClass: 'café' },
  { observedResidual: '.external.active' },
  { observedResidual: '[data-mode="a/b"]', observedState: 'checked' }
] satisfies Partial<ObservedRelationIdentity>[])('round-trips subject and observed marker roles %j', (variant) => {
  const identity: ObservedRelationIdentity = {
    moduleId: '../shared/Card.gss', layer: 'framework.base', condition: 'media:x',
    subjectPath: ['a/b', 'c\\d'], relation: 'child', ...variant
  };
  for (const [role, encode] of [
    ['subject', createReadableHasSubjectMarker], ['observed', createReadableObservedMarker]
  ] as const) expect(decodeReadableObservedMarker(encode(identity))).toEqual({ role, identity });
});

it('rejects malformed or alternate observed marker identities', () => {
  const canonical = createReadableHasSubjectMarker({ moduleId: 'tree.gss', subjectPath: ['card'],
    relation: 'descendant', observedClass: 'é' });
  for (const invalid of [
    canonical.replace('_e9_', '_E9_'),
    canonical.replace('--relation_descendant', '--relation_unknown'),
    canonical.replace('--subject_card', '--subject_a_2f_'),
    canonical.replace('--observed_', '--observed_foo--observed_'),
    canonical.replace('--module_', '--condition_base--module_')
  ]) expect(decodeReadableObservedMarker(invalid)).toBeUndefined();
});

it('round-trips a Module-local keyframe name and rejects aliases', () => {
  const name = createReadableKeyframesName('cafe\u0301.gss', 'ease-in');
  expect(decodeReadableKeyframesName(name)).toEqual({ moduleId: 'cafe\u0301.gss', authoredName: 'ease-in' });
  expect(decodeReadableKeyframesName(name.replace('name_ease', 'name__65_ase'))).toBeUndefined();
  expect(decodeReadableKeyframesName(name.replace('--module_', '--name_extra--module_'))).toBeUndefined();
});

it('round-trips emitted intermediate context markers with a derived source path', () => {
  const identity: ContextualRelationIdentity = {
    moduleId: 'tree.gss', layer: 'framework.base', condition: 'media:x',
    relations: ['adjacent', 'descendant'], sourceState: 'hover', sourceAttribute: 'data-mode=ready',
    sourcePath: ['input'], targetPath: ['input', 'label', 'icon']
  };
  const path = ['input', 'label'];
  const name = createReadableContextMarker(identity, 1, path);
  expect(decodeReadableContextMarker(name)).toEqual({ identity, position: 1, path });
  for (const invalid of [
    name.replace('--position_1', '--position_0'),
    name.replace('--position_1', '--position_2'),
    name.replace('--position_1', '--position_01'),
    name.replace('--relation_adjacent', '--relation_unknown'),
    name.replace('--path_', '--path_a_2f_')
  ]) expect(decodeReadableContextMarker(invalid)).toBeUndefined();
});

it('decodes contextual and observed markers from public session ScopeSchemas', () => {
  const compiler = createGssCompilerSession({ projectRoot: '/project' });
  const relation = compiler.replaceStylesheet({ id: '/project/tree.gss',
    source: '.input + .label .icon { color: red; }' });
  expect(relation).toMatchObject({ committed: true, diagnostics: [] });
  const label = relation.module!.scopeSchema.exports.input!.targets.label!.selfClassName;
  const target = relation.module!.scopeSchema.exports.input!.targets.label!.targets.icon!.selfClassName;
  expect(decodeReadableContextMarker(label)).toEqual({ identity: {
    moduleId: 'tree.gss', relations: ['adjacent', 'descendant'],
    sourcePath: ['input'], targetPath: ['input', 'label', 'icon']
  }, position: 1, path: ['input', 'label'] });
  expect(decodeReadableTargetMarker(target)).toEqual({ moduleId: 'tree.gss',
    relations: ['adjacent', 'descendant'], sourcePath: ['input'], targetPath: ['input', 'label', 'icon'] });

  const observed = compiler.replaceStylesheet({ id: '/project/observed.gss',
    source: '.card:has(.error) { color: red; }' });
  expect(observed).toMatchObject({ committed: true, diagnostics: [] });
  const subjectName = observed.module!.scopeSchema.exports.card!.selfClassName;
  const observedName = observed.module!.scopeSchema.exports.error!.selfClassName;
  const identity = { moduleId: 'observed.gss', subjectPath: ['card'],
    relation: 'descendant', observedClass: 'error' };
  expect(decodeReadableObservedMarker(subjectName)).toEqual({ role: 'subject', identity });
  expect(decodeReadableObservedMarker(observedName)).toEqual({ role: 'observed', identity });
});

it.each([
  'gss-s--layer_unlayered--path_card',
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_red--importance_normal--module_x',
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_red--importance_normal--specificity_2',
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_red--importance_normal--value_red'
])('rejects malformed atomic identity name: %s', (name) => {
  expect(decodeReadableAtomicName(name)).toBeUndefined();
});


it.each(['0', '-1', '1.5', '01', '9007199254740992'])('rejects invalid output slot %s in atomic names', (order) => {
  const canonical = createReadableAtomicName({ layer: 'base', condition: 'base', state: 'self',
    property: 'margin-left', value: '1px', important: false, atomRank: 1, orderSlot: 2 });
  expect(decodeReadableAtomicName(canonical.replace('--order_2', `--order_${order}`))).toBeUndefined();
});
