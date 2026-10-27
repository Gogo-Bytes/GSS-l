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

// A fixture-owned native competitor is intentionally loaded after both stylesheets: losing
// the type specificity of a type-only list makes the competitor win even if emitted last.
export const hasTypeListFixtures: readonly HasSpecificityFixture[] = [false, true].map((reverse) => {
  const source = `.card:has(${reverse ? 'span, button' : 'button, span'}) { background-color: red; }`;
  return {
    name: `has-type-only-list-${reverse ? 'reversed' : 'forward'}`,
    modules: [{ id: moduleId, source }],
    reference: {
      css: `.native-card:has(${reverse ? 'span, button' : 'button, span'}) { background-color: red; }`,
      scopeSchemas: { [moduleId]: { moduleId, exports: {
        card: { selfClassName: 'native-card', targets: {} }
      } } }
    },
    afterCss: '.competitor { background-color: blue; }',
    nodes: [
      { id: 'card-button', moduleId, path: ['card'], extraClassName: 'competitor',
        expected: { 'background-color': 'rgb(255, 0, 0)' } },
      { id: 'button', parent: 'card-button', tag: 'button', moduleId, path: [], externalClassName: '', expected: {} },
      { id: 'card-span', moduleId, path: ['card'], extraClassName: 'competitor',
        expected: { 'background-color': 'rgb(255, 0, 0)' } },
      { id: 'span', parent: 'card-span', tag: 'span', moduleId, path: [], externalClassName: '', expected: {} },
      { id: 'card-empty', moduleId, path: ['card'], extraClassName: 'competitor',
        expected: { 'background-color': 'rgb(0, 0, 255)' } }
    ]
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
