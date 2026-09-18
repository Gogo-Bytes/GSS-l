export const supportedPseudoElements = [
  'before',
  'after',
  'placeholder',
  'marker',
  'file-selector-button',
  'backdrop',
  'first-line',
  'first-letter',
  'selection'
] as const;

export type SupportedPseudoElement = typeof supportedPseudoElements[number];

const supportedPseudoElementSet = new Set<string>(supportedPseudoElements);

export function isSupportedPseudoElement(value: string): value is SupportedPseudoElement {
  return supportedPseudoElementSet.has(value);
}
