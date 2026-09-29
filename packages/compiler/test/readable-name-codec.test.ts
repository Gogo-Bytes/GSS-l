import { expect, it } from 'vitest';
import { decodeReadableNamePart, encodeReadableNamePart } from '../src/domain/readable-name.js';

it.each([
  '',
  'plain',
  'a_b',
  'a--b',
  'a/b',
  'é',
  'e\u0301',
  '𝌆',
  '\u0000',
  '_0_'
])('round-trips canonical name component %j', (value) => {
  const encoded = encodeReadableNamePart(value);
  expect(decodeReadableNamePart(encoded)).toBe(value.normalize('NFC'));
});

it('keeps the empty sentinel distinct from encoded underscore and NUL', () => {
  expect(encodeReadableNamePart('')).toBe('_');
  expect(encodeReadableNamePart('_')).toBe('_5f_');
  expect(encodeReadableNamePart('\u0000')).toBe('_0_');
  expect(new Set(['', '_', '\u0000'].map(encodeReadableNamePart)).size).toBe(3);
});

it.each(['', '_5f', '_x_', '_zz_', 'name_'])('rejects malformed encoded name components: %j', (encoded) => {
  expect(decodeReadableNamePart(encoded)).toBeUndefined();
});
