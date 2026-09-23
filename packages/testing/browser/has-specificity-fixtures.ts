import type { ScopeSchema } from '@gss-l/compiler';
import type { ReferenceFixture } from './fixtures.js';

type HasSpecificityFixture = ReferenceFixture & {
  reference: { css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>> };
};

const moduleId = 'HasSpecificity.gss';
const scopeSchemas: Readonly<Record<string, ScopeSchema>> = {
  [moduleId]: { moduleId, exports: {
    card: { selfClassName: 'card', targets: {} },
    error: { selfClassName: 'error', targets: {} },
    warning: { selfClassName: 'warning', targets: {} }
  } }
};
const red = { color: 'rgb(255, 0, 0)' };
const selectorList = '.card:has(.error, .warning:checked) { color: red; }';
const candidate = '.card[data-active="yes"] { color: blue; }';

// Literal native CSS independently encodes :has()'s maximum argument specificity.
const nodes: HasSpecificityFixture['nodes'] = [
  { id: 'card', moduleId, path: ['card'], expected: red },
  { id: 'error', parent: 'card', moduleId, path: ['error'], tag: 'span', expected: {} },
  { id: 'warning', parent: 'card', moduleId, path: ['warning'], tag: 'input', expected: {} }
];

export const hasSpecificityFixtures: readonly HasSpecificityFixture[] = [false, true].map((reverse) => {
  const sourceRules = reverse ? [candidate, selectorList] : [selectorList, candidate];
  return {
    name: `has-selector-list-specificity-${reverse ? 'reversed' : 'forward'}`,
    modules: [{ id: moduleId, source: sourceRules.join('\n') }],
    reference: { css: sourceRules.join('\n'), scopeSchemas },
    nodes,
    phases: [{
      name: 'lower-branch-matches-maximum-branch-does-not',
      changes: [{ node: 'card', attributes: { 'data-active': 'yes' } }],
      expected: { card: red }
    }]
  };
});

// The repeated .error observation must retain the maximum from the stronger list even when
// the lower-specificity list is registered first. Literal CSS is intentionally independent.
export const hasSpecificityDedupFixtures: readonly HasSpecificityFixture[] = [false, true].flatMap((reverseLists) =>
  [false, true].map((reverseRules) => {
    const weaker = reverseLists
      ? '.card:has(.warning, .error) { color: red; }'
      : '.card:has(.error, .warning) { color: red; }';
    const stronger = reverseLists
      ? '.card:has(.warning:checked, .error) { color: red; }'
      : '.card:has(.error, .warning:checked) { color: red; }';
    const redRules = reverseRules ? [stronger, weaker] : [weaker, stronger];
    const sourceRules = [...redRules, candidate];
    return {
      name: `has-selector-list-shared-branch-${reverseLists ? 'reversed-list' : 'forward-list'}-${reverseRules ? 'stronger-first' : 'weaker-first'}`,
      modules: [{ id: moduleId, source: sourceRules.join('\n') }],
      reference: { css: sourceRules.join('\n'), scopeSchemas },
      nodes,
      phases: [{
        name: 'shared-error-matches-checked-warning-does-not',
        changes: [{ node: 'card', attributes: { 'data-active': 'yes' } }],
        expected: { card: red }
      }]
    };
  })
);
