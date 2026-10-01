import { expect, it } from 'vitest';
import {
  createReadableAtomicName,
  decodeReadableAtomicName,
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
  }
] satisfies PureDeclarationIdentity[])('round-trips bounded atomic identity %j', (identity) => {
  const name = createReadableAtomicName(identity);
  expect(decodeReadableAtomicName(name)).toEqual(identity);
});

it.each([
  'gss-s--layer_unlayered--path_card',
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_red--importance_normal--module_x',
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_red--importance_normal--specificity_2',
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_red--importance_normal--value_red'
])('rejects malformed atomic identity name: %s', (name) => {
  expect(decodeReadableAtomicName(name)).toBeUndefined();
});
