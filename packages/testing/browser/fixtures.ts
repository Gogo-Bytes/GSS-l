import type { GssCompilerConfig, ReplaceStylesheetInput, ScopeSchema } from '@gss-l/compiler';
import { assetFixtures } from './asset-fixtures.js';
import { conditionLayerFixtures } from './condition-layer-fixtures.js';
import { pseudoElementFixtures } from './pseudo-element-fixtures.js';

export type PseudoExpectations = Partial<Record<'::before' | '::after', Readonly<Record<string, string>>>>;

export type ReferenceFixture = {
  name: string;
  modules: readonly ReplaceStylesheetInput[];
  config?: Pick<GssCompilerConfig, 'conditions' | 'layers'>;
  setupCss?: string;
  assetUrls?: Readonly<Record<string, string>>;
  assetDimensions?: Readonly<Record<string, string>>;
  conditionProbes?: { media?: readonly string[]; supports?: readonly string[]; container?: string };

  nodes: readonly {
    id: string;
    moduleId: string;
    path: readonly string[];
    parent?: string;
    tag?: 'div' | 'span' | 'input' | 'fieldset' | 'button';
    expected: Readonly<Record<string, string>>;
    pseudoExpected?: PseudoExpectations;
  }[];
  phases?: readonly {
    name: string;
    viewportWidth?: number;
    containerWidth?: number;
    changes: readonly {
      node: string;
      checked?: boolean;
      disabled?: boolean;
      attributes?: Readonly<Record<string, string | null>>;
    }[];
    expected: Readonly<Record<string, Readonly<Record<string, string>>>>;
    pseudoExpected?: Readonly<Record<string, PseudoExpectations>>;
  }[];
};

export type CompiledReferenceFixture = ReferenceFixture & {
  reference: { css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>> };
  atomic: { css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>> };
};

// Literal longhand expectations are a second guard against an empty/common-mode pass.
export const fixtures: readonly ReferenceFixture[] = [
  ...assetFixtures,
  ...pseudoElementFixtures,
  ...conditionLayerFixtures,
  {
    name: 'ownership-module-isolation',
    modules: [
      { id: 'A.gss', source: '.card { color: red; background-color: white; display: block; width: 80px; height: 20px; }' },
      { id: 'B.gss', source: '.card { color: blue; background-color: black; display: block; width: 40px; height: 30px; }' }
    ],
    nodes: [
      { id: 'a', moduleId: 'A.gss', path: ['card'], expected: {
        color: 'rgb(255, 0, 0)', 'background-color': 'rgb(255, 255, 255)', display: 'block', width: '80px', height: '20px'
      } },
      { id: 'b', moduleId: 'B.gss', path: ['card'], expected: {
        color: 'rgb(0, 0, 255)', 'background-color': 'rgb(0, 0, 0)', display: 'block', width: '40px', height: '30px'
      } }
    ]
  },
  {
    name: 'descendant-ordered-subsequence',
    modules: [{ id: 'Tree.gss', source: [
      '.icon { display: block; color: green; }',
      '.son .icon { padding: 2px; }',
      '.father .icon { color: red; margin: 3px; }',
      '.father /* authored .not-a-scope */ .son .icon { color: blue; padding-left: 7px; }'
    ].join('\n') }],
    nodes: [
      { id: 'father', moduleId: 'Tree.gss', path: ['father'], expected: {} },
      { id: 'son', parent: 'father', moduleId: 'Tree.gss', path: ['father', 'son'], expected: {} },
      { id: 'icon', parent: 'son', moduleId: 'Tree.gss', path: ['father', 'son', 'icon'], expected: {
        display: 'block', color: 'rgb(0, 0, 255)',
        'padding-top': '2px', 'padding-right': '2px', 'padding-bottom': '2px', 'padding-left': '7px',
        'margin-top': '3px', 'margin-right': '3px', 'margin-bottom': '3px', 'margin-left': '3px'
      } },
      { id: 'direct-icon', parent: 'father', moduleId: 'Tree.gss', path: ['father', 'icon'], expected: {
        display: 'block', color: 'rgb(255, 0, 0)',
        'margin-top': '3px', 'margin-right': '3px', 'margin-bottom': '3px', 'margin-left': '3px'
      } },
      { id: 'standalone-icon', moduleId: 'Tree.gss', path: ['icon'], expected: {
        display: 'block', color: 'rgb(0, 128, 0)'
      } }
    ]
  },
  {
    name: 'native-current-states',
    modules: [{ id: 'Control.gss', source: [
      '.control { color: black; margin-left: 1px; }',
      '.control:checked { color: red; }',
      '.control:disabled { color: blue; }',
      '.control:checked:disabled { color: green; }'
    ].join('\n') }],
    nodes: [{ id: 'control', tag: 'input', moduleId: 'Control.gss', path: ['control'], expected: {
      color: 'rgb(0, 0, 0)', 'margin-left': '1px'
    } }],
    phases: [
      { name: 'checked', changes: [{ node: 'control', checked: true }], expected: {
        control: { color: 'rgb(255, 0, 0)', 'margin-left': '1px' }
      } },
      { name: 'checked-and-disabled', changes: [{ node: 'control', disabled: true }], expected: {
        control: { color: 'rgb(0, 128, 0)', 'margin-left': '1px' }
      } },
      { name: 'disabled-only', changes: [{ node: 'control', checked: false }], expected: {
        control: { color: 'rgb(0, 0, 255)', 'margin-left': '1px' }
      } },
      { name: 'restored', changes: [{ node: 'control', disabled: false }], expected: {
        control: { color: 'rgb(0, 0, 0)', 'margin-left': '1px' }
      } }
    ]
  },
  {
    name: 'native-ancestor-and-attribute-states',
    modules: [{ id: 'StateTree.gss', source: [
      '.group .panel .leaf { color: black; margin-left: 1px; padding-left: 2px; background-color: white; width: 20px; }',
      '.group:disabled .panel .leaf { padding-left: 7px; }',
      '.panel[data-mode=ready] .leaf { margin-left: 9px; }',
      '.group[aria-expanded="true"] .panel .leaf { color: red; }',
      '.group .panel .leaf[data-active="yes"] { background-color: yellow; }',
      ".group .panel .leaf[aria-label='active .leaf'] { width: 30px; }"
    ].join('\n') }],
    nodes: [
      { id: 'group', tag: 'fieldset', moduleId: 'StateTree.gss', path: ['group'], expected: {} },
      { id: 'panel', parent: 'group', moduleId: 'StateTree.gss', path: ['group', 'panel'], expected: {} },
      { id: 'leaf', parent: 'panel', moduleId: 'StateTree.gss', path: ['group', 'panel', 'leaf'], expected: {
        color: 'rgb(0, 0, 0)', 'margin-left': '1px', 'padding-left': '2px', 'background-color': 'rgb(255, 255, 255)', width: '20px'
      } }
    ],
    phases: [
      { name: 'conditions-entered', changes: [
        { node: 'group', disabled: true, attributes: { 'aria-expanded': 'true' } },
        { node: 'panel', attributes: { 'data-mode': 'ready' } },
        { node: 'leaf', attributes: { 'data-active': 'yes', 'aria-label': 'active .leaf' } }
      ], expected: {
        leaf: { color: 'rgb(255, 0, 0)', 'margin-left': '9px', 'padding-left': '7px', 'background-color': 'rgb(255, 255, 0)', width: '30px' }
      } },
      { name: 'nonmatching-attributes', changes: [
        { node: 'group', disabled: false, attributes: { 'aria-expanded': 'false' } },
        { node: 'panel', attributes: { 'data-mode': 'waiting' } },
        { node: 'leaf', attributes: { 'data-active': 'no', 'aria-label': 'inactive .leaf' } }
      ], expected: {
        leaf: { color: 'rgb(0, 0, 0)', 'margin-left': '1px', 'padding-left': '2px', 'background-color': 'rgb(255, 255, 255)', width: '20px' }
      } },
      { name: 'restored', changes: [
        { node: 'group', attributes: { 'aria-expanded': null } },
        { node: 'panel', attributes: { 'data-mode': null } },
        { node: 'leaf', attributes: { 'data-active': null, 'aria-label': null } }
      ], expected: {
        leaf: { color: 'rgb(0, 0, 0)', 'margin-left': '1px', 'padding-left': '2px', 'background-color': 'rgb(255, 255, 255)', width: '20px' }
      } }
    ]
  },
  ...[false, true].map((reverse): ReferenceFixture => {
    const conditional = [
      '.a:disabled .c { color: red; margin: 1px 2px 3px 4px !important; padding-left: 9px; }',
      '.a:disabled .b .c { color: blue; margin-left: 9px; padding: 5px 6px 7px 8px; }'
    ];
    const base = { color: 'rgb(0, 0, 0)', width: '20px',
      'margin-top': '0px', 'margin-right': '0px', 'margin-bottom': '0px', 'margin-left': '0px',
      'padding-top': '0px', 'padding-right': '0px', 'padding-bottom': '0px', 'padding-left': '0px' };
    const active = { color: 'rgb(0, 0, 255)', width: '20px',
      'margin-top': '1px', 'margin-right': '2px', 'margin-bottom': '3px', 'margin-left': '4px',
      'padding-top': '5px', 'padding-right': '6px', 'padding-bottom': '7px', 'padding-left': '8px' };
    return {
      name: `descendant-cascade-${reverse ? 'reversed' : 'forward'}`,
      modules: [{ id: 'Cascade.gss', source: [
        '.c { color: black; margin: 0; padding: 0; }',
        '.outer .a .b .c { width: 20px; }',
        '.c[data-weak=ready] { width: 30px; }',
        ...(reverse ? conditional.reverse() : conditional),
        '.outer .a .b .c[data-mode=ready] { color: purple; }'
      ].join('\n') }],
      nodes: [
        { id: 'outer', moduleId: 'Cascade.gss', path: ['outer'], expected: {} },
        { id: 'a', parent: 'outer', tag: 'fieldset', moduleId: 'Cascade.gss', path: ['outer', 'a'], expected: {} },
        { id: 'b', parent: 'a', moduleId: 'Cascade.gss', path: ['outer', 'a', 'b'], expected: {} },
        { id: 'c', parent: 'b', moduleId: 'Cascade.gss', path: ['outer', 'a', 'b', 'c'], expected: base }
      ],
      phases: [
        { name: 'ancestor-active', changes: [{ node: 'a', disabled: true }], expected: { c: active } },
        { name: 'simultaneous-current-and-ancestor', changes: [{ node: 'c', attributes: { 'data-mode': 'ready', 'data-weak': 'ready' } }],
          expected: { c: { ...active, color: 'rgb(128, 0, 128)' } } },
        { name: 'current-only', changes: [{ node: 'a', disabled: false }],
          expected: { c: { ...base, color: 'rgb(128, 0, 128)' } } },
        { name: 'restored', changes: [{ node: 'c', attributes: { 'data-mode': null, 'data-weak': null } }], expected: { c: base } }
      ]
    };
  }),
  {
    name: 'repeated-source-embedding',
    modules: [{ id: 'Repeated.gss', source: [
      '.c { color: black; }',
      '.a:disabled .b .c { color: blue; }',
      '.a .b .a .c {}',
      '.a .b .a .b .c {}'
    ].join('\n') }],
    nodes: [
      { id: 'outer-a', tag: 'fieldset', moduleId: 'Repeated.gss', path: ['a'], expected: {} },
      { id: 'outer-b', parent: 'outer-a', moduleId: 'Repeated.gss', path: ['a', 'b'], expected: {} },
      { id: 'inner-a', parent: 'outer-b', tag: 'fieldset', moduleId: 'Repeated.gss', path: ['a', 'b', 'a'], expected: {} },
      { id: 'negative', parent: 'inner-a', moduleId: 'Repeated.gss', path: ['a', 'b', 'a', 'c'], expected: { color: 'rgb(0, 0, 0)' } },
      { id: 'inner-b', parent: 'inner-a', moduleId: 'Repeated.gss', path: ['a', 'b', 'a', 'b'], expected: {} },
      { id: 'positive', parent: 'inner-b', moduleId: 'Repeated.gss', path: ['a', 'b', 'a', 'b', 'c'], expected: { color: 'rgb(0, 0, 0)' } }
    ],
    phases: [
      { name: 'inner-source-only', changes: [{ node: 'inner-a', disabled: true }], expected: {
        negative: { color: 'rgb(0, 0, 0)' }, positive: { color: 'rgb(0, 0, 255)' }
      } },
      { name: 'both-sources', changes: [{ node: 'outer-a', disabled: true }], expected: {
        negative: { color: 'rgb(0, 0, 255)' }, positive: { color: 'rgb(0, 0, 255)' }
      } },
      { name: 'outer-source-only', changes: [{ node: 'inner-a', disabled: false }], expected: {
        negative: { color: 'rgb(0, 0, 255)' }, positive: { color: 'rgb(0, 0, 255)' }
      } },
      { name: 'restored', changes: [{ node: 'outer-a', disabled: false }], expected: {
        negative: { color: 'rgb(0, 0, 0)' }, positive: { color: 'rgb(0, 0, 0)' }
      } }
    ]
  },
  {
    name: 'shorthand-longhand',
    modules: [{ id: 'Box.gss', source: [
      '.forward { margin: 1px 2px 3px 4px; margin-left: 9px; }',
      '.reverse { margin-left: 9px; margin: 1px 2px 3px 4px; }',
      '.importantShort { padding: 1px 2px 3px 4px !important; padding-left: 9px; }',
      '.importantLong { padding-left: 9px !important; padding: 1px 2px 3px 4px; }',
      '.bothImportant { margin: 1px 2px 3px 4px !important; margin-left: 9px !important; }'
    ].join('\n') }],
    nodes: [
      { id: 'forward', moduleId: 'Box.gss', path: ['forward'], expected: {
        'margin-top': '1px', 'margin-right': '2px', 'margin-bottom': '3px', 'margin-left': '9px'
      } },
      { id: 'reverse', moduleId: 'Box.gss', path: ['reverse'], expected: {
        'margin-top': '1px', 'margin-right': '2px', 'margin-bottom': '3px', 'margin-left': '4px'
      } },
      { id: 'importantShort', moduleId: 'Box.gss', path: ['importantShort'], expected: {
        'padding-top': '1px', 'padding-right': '2px', 'padding-bottom': '3px', 'padding-left': '4px'
      } },
      { id: 'importantLong', moduleId: 'Box.gss', path: ['importantLong'], expected: {
        'padding-top': '1px', 'padding-right': '2px', 'padding-bottom': '3px', 'padding-left': '9px'
      } },
      { id: 'bothImportant', moduleId: 'Box.gss', path: ['bothImportant'], expected: {
        'margin-top': '1px', 'margin-right': '2px', 'margin-bottom': '3px', 'margin-left': '9px'
      } }
    ]
  }
];
