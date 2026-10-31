import { compareCodeUnits } from './compare-code-units.js';
import { effectsOfProperty, PROPERTY_EFFECT_SHORTHANDS } from './property-effects.js';

const directions = new Map<string, { family: string; logical: boolean }>();
function directionalFamily(family: string, physical: readonly string[], logical: readonly string[]): void {
  for (const effect of physical) directions.set(effect, { family, logical: false });
  for (const effect of logical) directions.set(effect, { family, logical: true });
}
const sides = ['top', 'right', 'bottom', 'left'];
for (const family of ['margin', 'padding', 'inset', 'scroll-margin', 'scroll-padding']) {
  directionalFamily(family,
    sides.map((side) => family === 'inset' ? side : `${family}-${side}`),
    ['inline', 'block'].flatMap((axis) => ['start', 'end'].map((end) => `${family}-${axis}-${end}`)));
}
for (const prefix of ['', 'min-', 'max-']) {
  directionalFamily(`${prefix}size`, [`${prefix}width`, `${prefix}height`], [`${prefix}inline-size`, `${prefix}block-size`]);
}
for (const aspect of ['width', 'style', 'color']) {
  directionalFamily(`border-${aspect}`, sides.map((side) => `border-${side}-${aspect}`),
    ['inline', 'block'].flatMap((axis) => ['start', 'end'].map((end) => `border-${axis}-${end}-${aspect}`)));
}
directionalFamily('border-radius',
  ['top-left', 'top-right', 'bottom-right', 'bottom-left'].map((corner) => `border-${corner}-radius`),
  ['start-start', 'start-end', 'end-start', 'end-end'].map((corner) => `border-${corner}-radius`));
for (const family of ['overflow', 'overscroll-behavior']) {
  directionalFamily(family, ['x', 'y'].map((axis) => `${family}-${axis}`), ['inline', 'block'].map((axis) => `${family}-${axis}`));
}

/** Potential aliases affect order and reuse only, never definite-effect pruning or admission. */
export function propertiesMayOverlapForModuleOrder(left: string, right: string): boolean {
  return effectsOfProperty(left).some((leftEffect) => effectsOfProperty(right).some((rightEffect) => {
    if (leftEffect === rightEffect) return true;
    const a = directions.get(leftEffect), b = directions.get(rightEffect);
    return a !== undefined && b !== undefined && a.family === b.family && a.logical !== b.logical;
  }));
}

/** Within one semantic height, logical writes precede physical writes; unrelated effects cannot compete. */
export function propertyOrderPriority(property: string): number {
  return effectsOfProperty(property).some((effect) => directions.get(effect)?.logical) ? 0 : 1;
}

export function isPropertyOrderReuseBarrier(property: string): boolean {
  return effectsOfProperty(property).some((effect) => directions.has(effect));
}

/** Only an exact physical longhand may relax the directional reuse barrier.
 * Callers must also prove that the full competing family has this one property. */
export function isPhysicalSingleEffectLonghand(property: string): boolean {
  const effects = effectsOfProperty(property);
  return directions.get(property)?.logical === false && effects.length === 1 && effects[0] === property;
}

const renderDepths = new Map<string, number>();
function renderDepth(property: string): number {
  const cached = renderDepths.get(property);
  if (cached !== undefined) return cached;
  const effects = effectsOfProperty(property);
  const containers = PROPERTY_EFFECT_SHORTHANDS.filter((shorthand) => {
    const container = effectsOfProperty(shorthand);
    return propertyOrderPriority(shorthand) === propertyOrderPriority(property) &&
      container.length > effects.length && effects.every((effect) => container.includes(effect));
  });
  const depth = containers.reduce((maximum, shorthand) => Math.max(maximum, renderDepth(shorthand) + 1), 0);
  renderDepths.set(property, depth);
  return depth;
}

/** A total key avoids cycles from mixing pairwise containment with lexical fallbacks. */
export function comparePropertyRenderOrder(left: string, right: string): number {
  return propertyOrderPriority(left) - propertyOrderPriority(right) ||
    renderDepth(left) - renderDepth(right) || compareCodeUnits(left, right);
}
