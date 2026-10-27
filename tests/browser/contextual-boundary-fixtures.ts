import type { ScopeSchema } from '@gss-l/compiler';
import type { ReferenceFixture } from './fixtures.js';

// Child and :has() syntax remain outside compileGssReference. These native goldens are
// hand-authored test fixtures, not another reference compiler or an atomic-output oracle.
type NativeBoundaryFixture = ReferenceFixture & {
  reference: { css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>> };
};
const scopeSchemas: Readonly<Record<string, ScopeSchema>> = {
  'Boundary.gss': { moduleId: 'Boundary.gss', exports: {
    x: { selfClassName: 'x', targets: {
      a: { selfClassName: 'a', targets: { b: { selfClassName: 'b', targets: {} } } }
    } }
  } }
};
const observedScopeSchemas: Readonly<Record<string, ScopeSchema>> = {
  'Boundary.gss': { moduleId: 'Boundary.gss', exports: {
    ...scopeSchemas['Boundary.gss']!.exports,
    c: { selfClassName: 'c', targets: {} }
  } }
};
const blue = { color: 'rgb(0, 0, 255)' };
const red = { color: 'rgb(255, 0, 0)' };
const black = { color: 'rgb(0, 0, 0)' };
const nodes = (expected: Readonly<Record<string, string>>): ReferenceFixture['nodes'] => [
  { id: 'x', moduleId: 'Boundary.gss', path: ['x'], expected: {} },
  { id: 'a', parent: 'x', tag: 'fieldset', moduleId: 'Boundary.gss', path: ['x', 'a'], expected: {} },
  { id: 'b', parent: 'a', moduleId: 'Boundary.gss', path: ['x', 'a', 'b'], expected }
];

export const contextualBoundaryFixtures: readonly NativeBoundaryFixture[] = [
  ...[false, true].flatMap((withUnrelatedCondition) => [false, true].map((checked): NativeBoundaryFixture => ({
    name: `observed-boundary-${checked ? 'checked' : 'class'}-${withUnrelatedCondition ? 'with' : 'without'}-unrelated-condition`,
    modules: [{ id: 'Boundary.gss', source: [
      '.x .a .b { color: red; }',
      checked ? '.x .a .b:has(:checked) { color: blue; }' : '.x .a .b:has(.c) { color: blue; }',
      '.c {}',
      withUnrelatedCondition ? '.other:checked { width: 1px; }' : ''
    ].join('\n') }],
    reference: {
      css: checked
        ? '.x .a .b { color: red; } .x .a .b:has(:checked) { color: blue; }'
        : '.x .a .b { color: red; } .x .a .b:has(.c) { color: blue; }',
      scopeSchemas: observedScopeSchemas
    },
    nodes: [...nodes(checked ? red : blue),
      { id: 'c', parent: 'b', tag: 'input', moduleId: 'Boundary.gss', path: ['c'], expected: {} }],
    phases: checked ? [
      { name: 'observed-match', changes: [{ node: 'c', checked: true }], expected: { b: blue } },
      { name: 'restored-no-match', changes: [{ node: 'c', checked: false }], expected: { b: red } }
    ] : []
  }))),
  ...[false, true].map((withUnrelatedCondition): NativeBoundaryFixture => ({
    name: `child-boundary-${withUnrelatedCondition ? 'with' : 'without'}-unrelated-condition`,
    modules: [{ id: 'Boundary.gss', source: '.x .a .b { color: red; } .x .a > .b { color: blue; }' +
      (withUnrelatedCondition ? ' .other:checked { width: 1px; }' : '') }],
    reference: { css: '.x .a .b { color: red; } .x .a > .b { color: blue; }', scopeSchemas },
    nodes: nodes(blue)
  })),
  ...[false, true].flatMap((reverse) => [false, true].map((importantChild): NativeBoundaryFixture => {
    const rules = [
      '.x .a:disabled .b { color: red; }',
      `.x .a > .b { color: blue${importantChild ? ' !important' : ''}; }`
    ];
    return {
      name: `child-boundary-${reverse ? 'reversed' : 'forward'}-${importantChild ? 'importance' : 'specificity'}`,
      modules: [{ id: 'Boundary.gss', source: (reverse ? [...rules].reverse() : rules).join('\n') }],
      reference: { css: importantChild
        ? '.x .a:disabled .b { color: red; } .x .a > .b { color: blue !important; }'
        : '.x .a:disabled .b { color: red; } .x .a > .b { color: blue; }', scopeSchemas },
      nodes: nodes(blue),
      phases: [
        { name: 'disabled-source', changes: [{ node: 'a', disabled: true }], expected: { b: importantChild ? blue : red } },
        { name: 'restored', changes: [{ node: 'a', disabled: false }], expected: { b: blue } }
      ]
    };
  })),
  {
    name: 'child-boundary-same-source-state-reversed',
    modules: [{ id: 'Boundary.gss', source: [
      '.b { color: black; }',
      '.x .a:disabled > .b { color: blue; }',
      '.x .a:disabled .b { color: red; }'
    ].join('\n') }],
    // ADR-0013 gives the child refinement precedence even when authored first.
    // The literal native golden places that winner last; no atomic planning is reused.
    reference: { css: '.b { color: black; } .x .a:disabled .b { color: red; } .x .a:disabled > .b { color: blue; }', scopeSchemas },
    nodes: nodes(black),
    phases: [
      { name: 'disabled-source', changes: [{ node: 'a', disabled: true }], expected: { b: blue } },
      { name: 'restored', changes: [{ node: 'a', disabled: false }], expected: { b: black } }
    ]
  }
];
