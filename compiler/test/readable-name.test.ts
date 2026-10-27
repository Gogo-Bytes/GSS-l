import { expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';
import {
  createReadableAtomicName, createReadableContextMarker, createReadableHasSubjectMarker,
  createReadableObservedMarker, createReadableScopeMarker, createReadableSourceMarker, createReadableTargetMarker
} from '../src/domain/readable-name.js';

const atomic = (value: string) => createReadableAtomicName({
  layer: 'unlayered',
  condition: 'base',
  state: 'self',
  property: 'color',
  value,
  important: false
});

it('keeps empty and literal empty identity components distinct', () => {
  expect(atomic('')).not.toBe(atomic('empty'));
});

it('does not encode an empty identity component as the U+0000 escape', () => {
  expect(atomic('')).not.toBe(atomic('\u0000'));
});

it('keeps distinct Unicode scalar sequences distinct in semantic identities', () => {
  expect(atomic('é')).not.toBe(atomic('e\u0301'));
  expect(createReadableScopeMarker('café.gss', ['card']))
    .not.toBe(createReadableScopeMarker('cafe\u0301.gss', ['card']));
  expect(createReadableScopeMarker('card.gss', ['café']))
    .not.toBe(createReadableScopeMarker('card.gss', ['cafe\u0301']));
});

it('keeps contextual marker identity fields collision-free', () => {
  const context = {
    moduleId: 'module.gss', layer: 'framework.base', condition: 'media:x',
    relations: ['child', 'adjacent'] as const, sourceState: 'hover', sourceAttribute: 'data-mode=ready',
    sourcePath: ['card', 'icon'], targetPath: ['card', 'icon', 'badge']
  };
  const contextVariants = [
    { ...context, moduleId: 'module-x.gss' },
    { ...context, layer: 'framework.base-x' },
    { ...context, condition: 'media:y' },
    { ...context, relations: ['child', 'general-sibling'] as const },
    { ...context, sourceState: 'focus' },
    { ...context, sourceAttribute: 'data-mode=idle' },
    { ...context, sourcePath: ['card', 'button'] },
    { ...context, targetPath: ['card', 'icon', 'label'] }
  ];
  const contextNames = contextVariants.map((identity) => createReadableTargetMarker(identity));
  expect(new Set(contextNames).size).toBe(contextNames.length);
  expect(new Set(contextVariants.map((identity) => createReadableContextMarker(identity, 1, identity.targetPath))).size)
    .toBe(contextVariants.length);

  const observedVariants = [
    { moduleId: 'module.gss', layer: 'framework.base', condition: 'media:x', subjectPath: ['card'], relation: 'descendant' as const, observedClass: 'error' },
    { moduleId: 'module-x.gss', layer: 'framework.base', condition: 'media:x', subjectPath: ['card'], relation: 'descendant' as const, observedClass: 'error' },
    { moduleId: 'module.gss', layer: 'framework.base-x', condition: 'media:x', subjectPath: ['card'], relation: 'descendant' as const, observedClass: 'error' },
    { moduleId: 'module.gss', layer: 'framework.base', condition: 'media:y', subjectPath: ['card'], relation: 'descendant' as const, observedClass: 'error' },
    { moduleId: 'module.gss', layer: 'framework.base', condition: 'media:x', subjectPath: ['card', 'icon'], relation: 'descendant' as const, observedClass: 'error' },
    { moduleId: 'module.gss', layer: 'framework.base', condition: 'media:x', subjectPath: ['card'], relation: 'child' as const, observedClass: 'error' },
    { moduleId: 'module.gss', layer: 'framework.base', condition: 'media:x', subjectPath: ['card'], relation: 'descendant' as const, observedClass: 'error-x' }
  ];
  expect(new Set(observedVariants.map((identity) => createReadableObservedMarker(identity))).size)
    .toBe(observedVariants.length);

  const sourceVariants = [
    { moduleId: 'module.gss', path: ['card'], condition: 'media:x', layer: 'framework.base' },
    { moduleId: 'module-x.gss', path: ['card'], condition: 'media:x', layer: 'framework.base' },
    { moduleId: 'module.gss', path: ['card', 'icon'], condition: 'media:x', layer: 'framework.base' },
    { moduleId: 'module.gss', path: ['card'], condition: 'media:y', layer: 'framework.base' },
    { moduleId: 'module.gss', path: ['card'], condition: 'media:x', layer: 'framework.base-x' }
  ];
  const source = sourceVariants.map((identity) => createReadableSourceMarker(
    identity.moduleId, identity.path, identity.condition, identity.layer
  ));
  expect(new Set(source).size).toBe(source.length);

  const hasSubjects = observedVariants.map((identity) => createReadableHasSubjectMarker(identity));
  expect(new Set(hasSubjects).size).toBe(hasSubjects.length);
});

it('separates ownership path boundaries from escaped punctuation inside a class', () => {
  const left = ['a.b', 'c'];
  const right = ['a', 'b.c'];
  expect(createReadableScopeMarker('tree.gss', left)).not.toBe(createReadableScopeMarker('tree.gss', right));
  const slashLeft = ['a/b', 'c'];
  const slashRight = ['a', 'b/c'];
  expect(createReadableSourceMarker('tree.gss', slashLeft)).not.toBe(createReadableSourceMarker('tree.gss', slashRight));
  // Both APIs name the same owned node, but their path separators must not alias different paths.
  expect(createReadableScopeMarker('tree.gss', ['a', 'b']))
    .not.toBe(createReadableSourceMarker('tree.gss', ['a.b']));
  expect(createReadableScopeMarker('tree.gss', ['a/b']))
    .not.toBe(createReadableSourceMarker('tree.gss', ['a', 'b']));
  expect(createReadableScopeMarker('tree.gss', slashLeft))
    .toBe(createReadableSourceMarker('tree.gss', slashLeft));
  const base = { moduleId: 'tree.gss', relations: ['child'] as const,
    sourcePath: ['a'], targetPath: slashLeft };
  expect(createReadableTargetMarker(base)).not.toBe(createReadableTargetMarker({ ...base, targetPath: slashRight }));
});

it('does not alias a nested owned anchor and an escaped-class runtime source in one public Module', () => {
  const compiler = createGssCompilerSession({ projectRoot: '/project' });
  const replacement = compiler.replaceStylesheet({ id: '/project/tree.gss', source: `
    .a .b .c :global(.external) { color: red; }
    .a\\.b + .x { background-color: blue; }
  ` });
  expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
  const schema = replacement.module!.scopeSchema.exports;
  const nestedAnchor = schema.a!.targets.b!.selfClassName.split(' ').find((name) => name.startsWith('gss-s--'));
  const runtimeSource = schema['a.b']!.selfClassName.split(' ').find((name) => name.startsWith('gss-s--'));
  expect(nestedAnchor).toBeTruthy();
  expect(runtimeSource).toBeTruthy();
  expect(nestedAnchor).not.toBe(runtimeSource);
});

it.each([
  ['a_b', 'a-b'],
  ['a/b', 'a b'],
  ['a--b', 'a__b']
])('does not collide for distinct encoded value components: %s vs %s', (left, right) => {
  expect(atomic(left)).not.toBe(atomic(right));
});
