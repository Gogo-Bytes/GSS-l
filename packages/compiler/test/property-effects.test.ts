import { describe, expect, it } from 'vitest';
import {
  PROPERTY_EFFECT_REGISTRY_VERSION,
  classifyPropertyEffect,
  comparePropertyRenderOrder,
  effectsOfProperty,
  isRegisteredPropertyEffect
} from '../src/domain/property-effects.js';

const registeredShorthandEffects = {
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  inset: ['top', 'right', 'bottom', 'left'],
  'scroll-margin': ['scroll-margin-top', 'scroll-margin-right', 'scroll-margin-bottom', 'scroll-margin-left'],
  'scroll-padding': ['scroll-padding-top', 'scroll-padding-right', 'scroll-padding-bottom', 'scroll-padding-left'],
  'margin-inline': ['margin-inline-start', 'margin-inline-end'],
  'margin-block': ['margin-block-start', 'margin-block-end'],
  'padding-inline': ['padding-inline-start', 'padding-inline-end'],
  'padding-block': ['padding-block-start', 'padding-block-end'],
  'inset-inline': ['inset-inline-start', 'inset-inline-end'],
  'inset-block': ['inset-block-start', 'inset-block-end'],
  'scroll-margin-inline': ['scroll-margin-inline-start', 'scroll-margin-inline-end'],
  'scroll-margin-block': ['scroll-margin-block-start', 'scroll-margin-block-end'],
  'scroll-padding-inline': ['scroll-padding-inline-start', 'scroll-padding-inline-end'],
  'scroll-padding-block': ['scroll-padding-block-start', 'scroll-padding-block-end'],
  border: [
    'border-top-width', 'border-top-style', 'border-top-color',
    'border-right-width', 'border-right-style', 'border-right-color',
    'border-bottom-width', 'border-bottom-style', 'border-bottom-color',
    'border-left-width', 'border-left-style', 'border-left-color',
    'border-image-source', 'border-image-slice', 'border-image-width', 'border-image-outset', 'border-image-repeat'
  ],
  'border-top': ['border-top-width', 'border-top-style', 'border-top-color'],
  'border-right': ['border-right-width', 'border-right-style', 'border-right-color'],
  'border-bottom': ['border-bottom-width', 'border-bottom-style', 'border-bottom-color'],
  'border-left': ['border-left-width', 'border-left-style', 'border-left-color'],
  'border-width': ['border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width'],
  'border-style': ['border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style'],
  'border-color': ['border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color'],
  'border-radius': ['border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius'],
  'border-image': ['border-image-source', 'border-image-slice', 'border-image-width', 'border-image-outset', 'border-image-repeat'],
  background: ['background-image', 'background-position-x', 'background-position-y', 'background-size', 'background-repeat', 'background-origin', 'background-clip', 'background-attachment', 'background-color'],
  'background-position': ['background-position-x', 'background-position-y'],
  overflow: ['overflow-x', 'overflow-y'],
  'overscroll-behavior': ['overscroll-behavior-x', 'overscroll-behavior-y'],
  gap: ['row-gap', 'column-gap'],
  'grid-gap': ['grid-row-gap', 'grid-column-gap'],
  grid: ['grid-template-rows', 'grid-template-columns', 'grid-template-areas', 'grid-auto-rows', 'grid-auto-columns', 'grid-auto-flow'],
  'grid-template': ['grid-template-rows', 'grid-template-columns', 'grid-template-areas'],
  'grid-area': ['grid-row-start', 'grid-column-start', 'grid-row-end', 'grid-column-end'],
  'grid-row': ['grid-row-start', 'grid-row-end'],
  'grid-column': ['grid-column-start', 'grid-column-end'],
  'grid-auto-flow': ['grid-auto-flow'],
  'place-content': ['align-content', 'justify-content'],
  'place-items': ['align-items', 'justify-items'],
  'place-self': ['align-self', 'justify-self'],
  flex: ['flex-grow', 'flex-shrink', 'flex-basis'],
  'flex-flow': ['flex-direction', 'flex-wrap'],
  columns: ['column-width', 'column-count'],
  'column-rule': ['column-rule-width', 'column-rule-style', 'column-rule-color'],
  'list-style': ['list-style-position', 'list-style-image', 'list-style-type'],
  outline: ['outline-width', 'outline-style', 'outline-color'],
  'text-decoration': ['text-decoration-line', 'text-decoration-style', 'text-decoration-color', 'text-decoration-thickness'],
  font: ['font-style', 'font-variant-caps', 'font-variant-ligatures', 'font-variant-numeric', 'font-variant-east-asian', 'font-variant-alternates', 'font-variant-position', 'font-weight', 'font-stretch', 'font-size', 'line-height', 'font-family', 'font-size-adjust', 'font-kerning', 'font-feature-settings', 'font-variation-settings'],
  'font-variant': ['font-variant-ligatures', 'font-variant-caps', 'font-variant-numeric', 'font-variant-east-asian', 'font-variant-alternates', 'font-variant-position'],
  transition: ['transition-property', 'transition-duration', 'transition-timing-function', 'transition-delay', 'transition-behavior'],
  animation: ['animation-name', 'animation-duration', 'animation-timing-function', 'animation-delay', 'animation-iteration-count', 'animation-direction', 'animation-fill-mode', 'animation-play-state', 'animation-timeline', 'animation-range-start', 'animation-range-end'],
  mask: ['mask-image', 'mask-mode', 'mask-position', 'mask-size', 'mask-repeat', 'mask-origin', 'mask-clip', 'mask-composite']
} as const;

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

  it('keeps every registered shorthand relationship represented and duplicate-free', () => {
    for (const [shorthand, expectedEffects] of Object.entries(registeredShorthandEffects)) {
      const effects = effectsOfProperty(shorthand);
      expect(effects).toEqual(expectedEffects);
      expect(new Set(effects).size).toBe(effects.length);
      const expectedKind = expectedEffects.length > 1 ? 'shorthand' : 'longhand';
      expect(classifyPropertyEffect(shorthand)).toEqual({ kind: expectedKind, effects: expectedEffects });
      for (const effect of expectedEffects) {
        expect(isRegisteredPropertyEffect(effect)).toBe(true);
        expect(classifyPropertyEffect(effect)).toEqual({ kind: 'longhand', effects: [effect] });
      }
    }
  });

  it('keeps unknown properties outside the registered completeness invariant', () => {
    expect(classifyPropertyEffect('definitely-unknown-property')).toEqual({ kind: 'unknown', effects: [] });
    expect(isRegisteredPropertyEffect('definitely-unknown-property')).toBe(false);
    expect(effectsOfProperty('definitely-unknown-property')).toEqual(['definitely-unknown-property']);
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
