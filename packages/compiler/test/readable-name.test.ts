import { expect, it } from 'vitest';
import {
  createReadableAtomicName, createReadableContextMarker, createReadableHasSubjectMarker,
  createReadableObservedMarker, createReadableSourceMarker, createReadableTargetMarker
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

it('normalizes canonically equivalent identity components before naming', () => {
  expect(atomic('é')).toBe(atomic('e\u0301'));
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

it.each([
  ['a_b', 'a-b'],
  ['a/b', 'a b'],
  ['a--b', 'a__b']
])('does not collide for distinct encoded value components: %s vs %s', (left, right) => {
  expect(atomic(left)).not.toBe(atomic(right));
});
