import { effectsOfProperty } from './property-effects.js';

const directionalFamilies = ['margin', 'padding', 'inset', 'scroll-margin', 'scroll-padding'] as const;
const physicalSides = ['top', 'right', 'bottom', 'left'];
const directionalEffects = new Map<string, { family: string; logical: boolean }>(directionalFamilies.flatMap((family) => [
  ...physicalSides.map((side) => [family === 'inset' ? side : `${family}-${side}`, { family, logical: false }] as const),
  ...['inline', 'block'].flatMap((axis) => ['start', 'end'].map((end) =>
    [`${family}-${axis}-${end}`, { family, logical: true }] as const))
]));

/** Potential competing writes for module ORDERING only. A logical side can map
 * to any physical side at runtime. This is not definite effect identity and must
 * not be used for pruning, shorthand resolution, or admission. Ordering edges
 * still require the planner's independent ownership/structural proof. */
export function propertiesMayOverlapForModuleOrder(left: string, right: string): boolean {
  return effectsOfProperty(left).some((leftEffect) => effectsOfProperty(right).some((rightEffect) => {
    if (leftEffect === rightEffect) return true;
    const a = directionalEffects.get(leftEffect), b = directionalEffects.get(rightEffect);
    return a !== undefined && b !== undefined && a.family === b.family && a.logical !== b.logical;
  }));
}
