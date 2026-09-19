import { describe, expect, it } from 'vitest';
import {
  PROPERTY_EFFECT_REGISTRY_VERSION,
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
    ['grid-gap', 'grid-gap']
  ])('%s exposes the effect of %s', (property, effect) => {
    expect(effectsOfProperty(property)).toContain(effect);
  });

  it('orders a containing shorthand before its longhand override', () => {
    expect(comparePropertyRenderOrder('border', 'border-top-color')).toBeLessThan(0);
    expect(comparePropertyRenderOrder('border-top-color', 'border')).toBeGreaterThan(0);
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
