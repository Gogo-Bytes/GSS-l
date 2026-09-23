import { describe, expect, it } from 'vitest';
import {
  PROPERTY_EFFECT_REGISTRY_VERSION,
  classifyPropertyEffect,
  comparePropertyRenderOrder,
  effectsOfProperty,
  isRegisteredPropertyEffect
} from '../src/domain/property-effects.js';

describe('PropertyEffectRegistry', () => {
  it('has an explicit dataset version', () => {
    expect(PROPERTY_EFFECT_REGISTRY_VERSION).toBe(1);
  });

  it.each([
    ['margin', 'margin-left'],
    ['padding', 'padding-left'],
    ['inset', 'right'],
    ['border', 'border-top-color'],
    ['border-top', 'border-top-style'],
    ['border-color', 'border-left-color'],
    ['background', 'background-image'],
    ['font', 'font-family'],
    ['animation', 'animation-name'],
    ['transition', 'transition-duration'],
    ['flex', 'flex-basis'],
    ['grid', 'grid-template-columns'],
    ['grid-area', 'grid-column-end'],
    ['grid-gap', 'grid-row-gap'],
    ['grid-gap', 'grid-row-gap']
  ])('%s exposes the effect of %s', (property, effect) => {
    expect(effectsOfProperty(property)).toContain(effect);
  });

  it('includes every represented font-variant reset effect in font shorthand', () => {
    expect(effectsOfProperty('font')).toEqual(expect.arrayContaining([
      'font-variant-caps',
      'font-variant-ligatures',
      'font-variant-numeric',
      'font-variant-east-asian',
      'font-variant-alternates',
      'font-variant-position'
    ]));
  });

  it('orders a containing shorthand before its longhand override', () => {
    expect(comparePropertyRenderOrder('border', 'border-top-color')).toBeLessThan(0);
    expect(comparePropertyRenderOrder('border-top-color', 'border')).toBeGreaterThan(0);
  });

  it('classifies custom properties, longhands, shorthands, and unknowns', () => {
    expect(classifyPropertyEffect('--brand')).toMatchObject({ kind: 'custom-property' });
    expect(classifyPropertyEffect('color')).toMatchObject({ kind: 'longhand' });
    expect(classifyPropertyEffect('border')).toMatchObject({ kind: 'shorthand' });
    expect(classifyPropertyEffect('grid')).toMatchObject({ kind: 'shorthand' });
    expect(classifyPropertyEffect('all')).toMatchObject({ kind: 'unknown' });
  });

  it('distinguishes registered effects from an unsafe unknown shorthand', () => {
    expect(isRegisteredPropertyEffect('color')).toBe(true);
    expect(isRegisteredPropertyEffect('border')).toBe(true);
    expect(isRegisteredPropertyEffect('--brand')).toBe(true);
    expect(isRegisteredPropertyEffect('all')).toBe(false);
  });

  it('treats unknown properties as independent singleton effects', () => {
    expect(effectsOfProperty('--brand')).toEqual(['--brand']);
  });
});
