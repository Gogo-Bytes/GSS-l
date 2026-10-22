export const supportedPseudoStates = [
  'hover',
  'focus',
  'focus-visible',
  'focus-within',
  'active',
  'disabled',
  'checked',
  'required',
  'optional',
  'valid',
  'invalid',
  'in-range',
  'out-of-range',
  'placeholder-shown',
  'read-only',
  'read-write',
  'indeterminate',
  'link',
  'visited',
  'target',
  'enabled',
  'default',
  'open',
  'modal',
  'fullscreen',
  'popover-open',
  'defined',
  'first-child',
  'last-child',
  'only-child',
  'first-of-type',
  'last-of-type',
  'only-of-type',
  'empty',
  'root'
] as const;

export type SupportedPseudoState = typeof supportedPseudoStates[number];

const supportedPseudoStateSet = new Set<string>(supportedPseudoStates);
const structuralPseudoStateSet = new Set<string>([
  'first-child', 'last-child', 'only-child', 'first-of-type', 'last-of-type',
  'only-of-type', 'empty', 'root'
]);

export function isSupportedPseudoState(value: string): value is SupportedPseudoState {
  return supportedPseudoStateSet.has(value);
}

export function isStructuralPseudoState(value: string): boolean {
  return structuralPseudoStateSet.has(value);
}
