export const PROPERTY_EFFECT_REGISTRY_VERSION = 1;

type PropertyFamily = readonly [shorthand: string, longhands: readonly string[]];

const physicalBoxFamilies: readonly PropertyFamily[] = [
  ['margin', ['margin-top', 'margin-right', 'margin-bottom', 'margin-left']],
  ['padding', ['padding-top', 'padding-right', 'padding-bottom', 'padding-left']],
  ['inset', ['top', 'right', 'bottom', 'left']],
  ['scroll-margin', [
    'scroll-margin-top', 'scroll-margin-right', 'scroll-margin-bottom', 'scroll-margin-left'
  ]],
  ['scroll-padding', [
    'scroll-padding-top', 'scroll-padding-right', 'scroll-padding-bottom', 'scroll-padding-left'
  ]]
];

const borderSides = ['top', 'right', 'bottom', 'left'] as const;
const borderAspects = ['width', 'style', 'color'] as const;
const borderLonghands = borderSides.flatMap((side) =>
  borderAspects.map((aspect) => `border-${side}-${aspect}`)
);
const borderImageLonghands = [
  'border-image-source',
  'border-image-slice',
  'border-image-width',
  'border-image-outset',
  'border-image-repeat'
] as const;

const families: readonly PropertyFamily[] = [
  ...physicalBoxFamilies,
  ['margin-inline', ['margin-inline-start', 'margin-inline-end']],
  ['margin-block', ['margin-block-start', 'margin-block-end']],
  ['padding-inline', ['padding-inline-start', 'padding-inline-end']],
  ['padding-block', ['padding-block-start', 'padding-block-end']],
  ['inset-inline', ['inset-inline-start', 'inset-inline-end']],
  ['inset-block', ['inset-block-start', 'inset-block-end']],
  ['scroll-margin-inline', ['scroll-margin-inline-start', 'scroll-margin-inline-end']],
  ['scroll-margin-block', ['scroll-margin-block-start', 'scroll-margin-block-end']],
  ['scroll-padding-inline', ['scroll-padding-inline-start', 'scroll-padding-inline-end']],
  ['scroll-padding-block', ['scroll-padding-block-start', 'scroll-padding-block-end']],
  ['border', [...borderLonghands, ...borderImageLonghands]],
  ...borderSides.map((side): PropertyFamily => [
    `border-${side}`,
    borderAspects.map((aspect) => `border-${side}-${aspect}`)
  ]),
  ...borderAspects.map((aspect): PropertyFamily => [
    `border-${aspect}`,
    borderSides.map((side) => `border-${side}-${aspect}`)
  ]),
  ['border-radius', [
    'border-top-left-radius',
    'border-top-right-radius',
    'border-bottom-right-radius',
    'border-bottom-left-radius'
  ]],
  ['border-image', borderImageLonghands],
  ['background', [
    'background-image',
    'background-position-x',
    'background-position-y',
    'background-size',
    'background-repeat',
    'background-origin',
    'background-clip',
    'background-attachment',
    'background-color'
  ]],
  ['background-position', ['background-position-x', 'background-position-y']],
  ['overflow', ['overflow-x', 'overflow-y']],
  ['overscroll-behavior', ['overscroll-behavior-x', 'overscroll-behavior-y']],
  ['gap', ['row-gap', 'column-gap']],
  ['place-content', ['align-content', 'justify-content']],
  ['place-items', ['align-items', 'justify-items']],
  ['place-self', ['align-self', 'justify-self']],
  ['flex', ['flex-grow', 'flex-shrink', 'flex-basis']],
  ['flex-flow', ['flex-direction', 'flex-wrap']],
  ['columns', ['column-width', 'column-count']],
  ['column-rule', ['column-rule-width', 'column-rule-style', 'column-rule-color']],
  ['list-style', ['list-style-position', 'list-style-image', 'list-style-type']],
  ['outline', ['outline-width', 'outline-style', 'outline-color']],
  ['text-decoration', [
    'text-decoration-line',
    'text-decoration-style',
    'text-decoration-color',
    'text-decoration-thickness'
  ]],
  ['font', [
    'font-style',
    'font-variant-caps',
    'font-weight',
    'font-stretch',
    'font-size',
    'line-height',
    'font-family',
    'font-size-adjust',
    'font-kerning',
    'font-feature-settings',
    'font-variation-settings'
  ]],
  ['font-variant', [
    'font-variant-ligatures',
    'font-variant-caps',
    'font-variant-numeric',
    'font-variant-east-asian',
    'font-variant-alternates',
    'font-variant-position'
  ]],
  ['transition', [
    'transition-property',
    'transition-duration',
    'transition-timing-function',
    'transition-delay',
    'transition-behavior'
  ]],
  ['animation', [
    'animation-name',
    'animation-duration',
    'animation-timing-function',
    'animation-delay',
    'animation-iteration-count',
    'animation-direction',
    'animation-fill-mode',
    'animation-play-state',
    'animation-timeline',
    'animation-range-start',
    'animation-range-end'
  ]],
  ['mask', [
    'mask-image',
    'mask-mode',
    'mask-position',
    'mask-size',
    'mask-repeat',
    'mask-origin',
    'mask-clip',
    'mask-composite'
  ]]
];

function createPropertyEffects(): Readonly<Record<string, readonly string[]>> {
  const registry: Record<string, readonly string[]> = {};
  for (const [shorthand, longhands] of families) {
    registry[shorthand] = longhands;
    for (const longhand of longhands) registry[longhand] ??= [longhand];
  }
  return Object.freeze(registry);
}

const propertyEffects = createPropertyEffects();

const independentProperties = new Set([
  'color',
  'content',
  'cursor',
  'display',
  'height',
  'min-height',
  'max-height',
  'width',
  'min-width',
  'max-width',
  'opacity',
  'position',
  'transform',
  'transform-origin',
  'visibility',
  'z-index'
]);

export function isRegisteredPropertyEffect(property: string): boolean {
  return property.startsWith('--') || property in propertyEffects || independentProperties.has(property);
}

export function effectsOfProperty(property: string): readonly string[] {
  return propertyEffects[property] ?? [property];
}

export function comparePropertyRenderOrder(left: string, right: string): number {
  if (left === right) return 0;
  const leftEffects = new Set(effectsOfProperty(left));
  const rightEffects = new Set(effectsOfProperty(right));
  const leftContainsRight = [...rightEffects].every((effect) => leftEffects.has(effect));
  const rightContainsLeft = [...leftEffects].every((effect) => rightEffects.has(effect));
  if (leftContainsRight && !rightContainsLeft) return -1;
  if (rightContainsLeft && !leftContainsRight) return 1;
  return left.localeCompare(right);
}
