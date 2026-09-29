import { expect, it } from 'vitest';
import { createReadableAtomicName } from '../src/domain/readable-name.js';

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

it.each([
  ['a_b', 'a-b'],
  ['a/b', 'a b'],
  ['a--b', 'a__b']
])('does not collide for distinct encoded value components: %s vs %s', (left, right) => {
  expect(atomic(left)).not.toBe(atomic(right));
});
