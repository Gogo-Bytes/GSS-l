import type { FinalizedGssSnapshot } from '@gss-l/compiler';

type Rule = FinalizedGssSnapshot['manifest']['rules'][number];
export type AtomRename = { from: string; to: string };

// A previously unranked atom has no competing declaration in its module for this
// layer, condition and importance. Restrict that proof to a single flat module.
const bareAtom = /^gss-a--layer_unlayered--condition_base--state_self--/;
const firstRank = '--rank_1--order_1';

function flatRules(snapshot: FinalizedGssSnapshot) {
  const { modules, resources, preservedRules, rules } = snapshot.manifest;
  if (modules.length !== 1 || resources.length || preservedRules.length || snapshot.report.preservedModules) return;
  if (!rules.every(rule => rule.kind === 'pure-atom' && bareAtom.test(rule.className) &&
    rule.selector === '.' + rule.className)) return;
  const byName = new Map(rules.map(rule => [rule.className, rule]));
  if (byName.size === rules.length) return byName;
}

function sameDeclaration(a: Rule, b: Rule) {
  return a.property === b.property && a.value === b.value && a.important === b.important &&
    JSON.stringify(a.origins) === JSON.stringify(b.origins);
}

// Accept one singleton <-> ranked rename on an otherwise additive/removal edit.
// Keep the compiler's names opaque except for its documented terminal rank/order fields.
export function findAtomRename(previous: FinalizedGssSnapshot, next: FinalizedGssSnapshot): AtomRename | undefined {
  if (previous.manifest.modules[0] !== next.manifest.modules[0]) return;
  const before = flatRules(previous);
  const after = flatRules(next);
  if (!before || !after) return;
  const added = [...after.values()].filter(rule => !before.has(rule.className));
  const removed = [...before.values()].filter(rule => !after.has(rule.className));
  if (Math.min(added.length, removed.length) !== 1) return;
  const common = [...before.values()].filter(rule => after.has(rule.className));
  const ordered = [...after.values()].filter(rule => before.has(rule.className));
  if (!common.every((rule, i) => rule.className === ordered[i]!.className && sameDeclaration(rule, ordered[i]!))) return;
  const expanding = removed.length === 1 && added.length > 1;
  const singleton = expanding ? removed[0]! : added[0]!;
  const ranked = expanding ? added : removed;
  const first = ranked[0]!;
  // Only add/remove later competitors of the same property. Never bridge two
  // independently ranked names, or a shared atom whose provenance is ambiguous.
  if (ranked.length < 2 || first.className !== singleton.className + firstRank ||
    singleton.origins.length !== 1 || !sameDeclaration(singleton, first) ||
    !ranked.every(rule => rule.property === first.property && rule.important === first.important)) return;
  return expanding ? { from: singleton.className, to: first.className } : { from: first.className, to: singleton.className };
}
