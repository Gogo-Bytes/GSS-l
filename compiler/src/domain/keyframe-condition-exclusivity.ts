import type { ParsedKeyframesRegistration } from './parsed-stylesheet.js';

type WidthBound = { direction: 'min' | 'max'; pixels: number };

// A deliberately small proof grammar, not a general Media Queries implication solver.
function registeredWidthBound(
  resource: ParsedKeyframesRegistration,
  registeredMedia: readonly string[]
): WidthBound | undefined {
  if (resource.layer !== 'unlayered' || resource.conditions.length !== 1) return undefined;
  const condition = resource.conditions[0]!;
  if (condition.kind !== 'media' || !registeredMedia.includes(condition.query)) return undefined;
  const match = /^\(\s*(min|max)-width\s*:\s*(0|[1-9][0-9]*)px\s*\)$/.exec(condition.query);
  if (!match) return undefined;
  const pixels = Number(match[2]);
  if (!Number.isSafeInteger(pixels) || pixels > 100000) return undefined;
  return { direction: match[1] as WidthBound['direction'], pixels };
}

/** Distinct same-name definitions may coexist only when their registered media cannot match together. */
export function disjointKeyframeWidthBounds(
  left: ParsedKeyframesRegistration,
  right: ParsedKeyframesRegistration,
  registeredMedia: readonly string[]
): boolean {
  const a = registeredWidthBound(left, registeredMedia);
  const b = registeredWidthBound(right, registeredMedia);
  if (!a || !b || a.direction === b.direction) return false;
  return a.direction === 'min' ? a.pixels > b.pixels : b.pixels > a.pixels;
}
