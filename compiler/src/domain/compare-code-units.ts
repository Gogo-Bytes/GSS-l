/** Deterministic total order for distinct identities, including Unicode normalization variants. */
export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
