/** Ownership paths describe scope composition, not browser ancestry. */
export function matchesOwnedTarget(path: readonly string[], target: readonly string[]): boolean {
  return path.length <= target.length && path.at(-1) === target.at(-1) &&
    isSubsequence(path.slice(0, -1), target.slice(0, -1));
}

export function isSubsequence(path: readonly string[], target: readonly string[]): boolean {
  let next = 0;
  for (const name of target) if (name === path[next]) next++;
  return next === path.length;
}
