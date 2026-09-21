import type { ReplaceStylesheetInput, ScopeSchema } from '@gss-l/compiler';

export type ReferenceFixture = {
  name: string;
  modules: readonly ReplaceStylesheetInput[];
  nodes: readonly {
    id: string;
    moduleId: string;
    path: readonly string[];
    parent?: string;
    expected: Readonly<Record<string, string>>;
  }[];
};

export type CompiledReferenceFixture = ReferenceFixture & {
  reference: { css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>> };
  atomic: { css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>> };
};

// Literal longhand expectations are a second guard against an empty/common-mode pass.
export const fixtures: readonly ReferenceFixture[] = [
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
