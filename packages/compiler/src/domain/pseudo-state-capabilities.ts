export const supportedPseudoStates = [
  'hover',
  'focus',
  'focus-visible',
  'focus-within',
  'active',
  'disabled',
  'checked'
] as const;

export type SupportedPseudoState = typeof supportedPseudoStates[number];

const supportedPseudoStateSet = new Set<string>(supportedPseudoStates);

export function isSupportedPseudoState(value: string): value is SupportedPseudoState {
  return supportedPseudoStateSet.has(value);
}
