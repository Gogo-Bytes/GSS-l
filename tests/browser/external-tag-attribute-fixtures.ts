import type { CompiledReferenceFixture, ReferenceFixture } from './fixtures.js';

// Independent native CSS: the external button/span receive no GSS class or export.
export const externalTagAttributeFixtures: readonly (ReferenceFixture & {
  reference: CompiledReferenceFixture['reference'];
})[] = [{
  name: 'attribute-presence-current-ancestor-and-child',
  modules: [{ id: 'Presence.gss', source: `
    .button { color: black; background-color: white; }
    .button[disabled] { color: red; }
    .button[data-mode] { background-color: red; }
    .button[data-mode=""] { background-color: blue; }
    .group .leaf { padding-left: 1px; width: 10px; }
    .group[data-ready] .leaf { padding-left: 7px; }
    .group[data-ready] > .leaf { width: 30px; }
  ` }],
  reference: {
    css: `.native-button { color: black; background-color: white; }
      .native-button[disabled] { color: red; }
      .native-button[data-mode] { background-color: red; }
      .native-button[data-mode=""] { background-color: blue; }
      .native-group .native-leaf { padding-left: 1px; width: 10px; }
      .native-group[data-ready] .native-leaf { padding-left: 7px; }
      .native-group[data-ready] > .native-leaf { width: 30px; }`,
    scopeSchemas: { 'Presence.gss': { moduleId: 'Presence.gss', exports: {
      button: { selfClassName: 'native-button', targets: {} },
      group: { selfClassName: 'native-group', targets: {
        leaf: { selfClassName: 'native-leaf', targets: {} }
      } }
    } } }
  },
  nodes: [
    { id: 'button', moduleId: 'Presence.gss', path: ['button'], tag: 'button',
      expected: { color: 'rgb(0, 0, 0)', 'background-color': 'rgb(255, 255, 255)' } },
    { id: 'group', moduleId: 'Presence.gss', path: ['group'], expected: {} },
    { id: 'leaf', moduleId: 'Presence.gss', path: ['group', 'leaf'], parent: 'group',
      expected: { 'padding-left': '1px', width: '10px' } }
  ],
  phases: [
    { name: 'empty-present', changes: [
      { node: 'button', disabled: true, attributes: { 'data-mode': '' } },
      { node: 'group', attributes: { 'data-ready': '' } }
    ], expected: {
      button: { color: 'rgb(255, 0, 0)', 'background-color': 'rgb(0, 0, 255)' },
      leaf: { 'padding-left': '7px', width: '30px' }
    } },
    { name: 'nonempty-present', changes: [
      { node: 'button', disabled: true, attributes: { 'data-mode': 'ready' } },
      { node: 'group', attributes: { 'data-ready': 'false' } }
    ], expected: {
      button: { color: 'rgb(255, 0, 0)', 'background-color': 'rgb(255, 0, 0)' },
      leaf: { 'padding-left': '7px', width: '30px' }
    } },
    { name: 'removed', changes: [
      { node: 'button', disabled: false, attributes: { 'data-mode': null } },
      { node: 'group', attributes: { 'data-ready': null } }
    ], expected: {
      button: { color: 'rgb(0, 0, 0)', 'background-color': 'rgb(255, 255, 255)' },
      leaf: { 'padding-left': '1px', width: '10px' }
    } }
  ]
}, {
  name: 'external-tag-attribute-owned-anchor',
  modules: [{ id: 'ExternalShape.gss', source: `
    .outer .editor :global(button) { color: red; }
    .outer .editor :global([data-mode="ready"]) { background-color: green; }
  ` }],
  setupCss: '.competitor.competitor button { color: blue; }',
  reference: {
    css: `.native-outer .native-editor button { color: red; }
      .native-outer .native-editor [data-mode="ready"] { background-color: green; }`,
    scopeSchemas: { 'ExternalShape.gss': { moduleId: 'ExternalShape.gss', exports: {
      outer: { selfClassName: 'native-outer', targets: {
        editor: { selfClassName: 'native-editor', targets: {} }
      } }
    } } }
  },
  nodes: [
    { id: 'shape-competitor', moduleId: 'ExternalShape.gss', path: [],
      externalClassName: 'competitor', expected: {} },
    { id: 'shape-outer', moduleId: 'ExternalShape.gss', path: ['outer'],
      parent: 'shape-competitor', expected: {} },
    { id: 'shape-editor', moduleId: 'ExternalShape.gss', path: ['outer', 'editor'],
      parent: 'shape-outer', expected: {} },
    { id: 'shape-button', moduleId: 'ExternalShape.gss', path: [], externalClassName: '',
      tag: 'button', parent: 'shape-editor', expected: { color: 'rgb(255, 0, 0)' } },
    { id: 'shape-outside-button', moduleId: 'ExternalShape.gss', path: [], externalClassName: '',
      tag: 'button', parent: 'shape-competitor', expected: { color: 'rgb(0, 0, 255)' } },
    { id: 'shape-attribute', moduleId: 'ExternalShape.gss', path: [], externalClassName: '',
      tag: 'span', parent: 'shape-editor', expected: { 'background-color': 'rgba(0, 0, 0, 0)' } },
    { id: 'shape-outside-attribute', moduleId: 'ExternalShape.gss', path: [], externalClassName: '',
      tag: 'span', parent: 'shape-competitor', expected: { 'background-color': 'rgba(0, 0, 0, 0)' } }
  ],
  phases: [
    { name: 'attribute-ready', changes: [
      { node: 'shape-attribute', attributes: { 'data-mode': 'ready' } },
      { node: 'shape-outside-attribute', attributes: { 'data-mode': 'ready' } }
    ], expected: {
      'shape-competitor': {}, 'shape-outer': {}, 'shape-editor': {},
      'shape-button': { color: 'rgb(255, 0, 0)' },
      'shape-outside-button': { color: 'rgb(0, 0, 255)' },
      'shape-attribute': { 'background-color': 'rgb(0, 128, 0)' },
      'shape-outside-attribute': { 'background-color': 'rgba(0, 0, 0, 0)' }
    } },
    { name: 'attribute-restored', changes: [
      { node: 'shape-attribute', attributes: { 'data-mode': null } },
      { node: 'shape-outside-attribute', attributes: { 'data-mode': null } }
    ], expected: {
      'shape-competitor': {}, 'shape-outer': {}, 'shape-editor': {},
      'shape-button': { color: 'rgb(255, 0, 0)' },
      'shape-outside-button': { color: 'rgb(0, 0, 255)' },
      'shape-attribute': { 'background-color': 'rgba(0, 0, 0, 0)' },
      'shape-outside-attribute': { 'background-color': 'rgba(0, 0, 0, 0)' }
    } }
  ]
}, {
  name: 'external-attribute-css-escape-value',
  modules: [{ id: 'EscapedExternal.gss', source: String.raw`
    .editor :global([data-mode="a\a b"]) { background-color: blue; }
  ` }],
  reference: {
    css: String.raw`.native-editor [data-mode="a\a b"] { background-color: blue; }`,
    scopeSchemas: { 'EscapedExternal.gss': { moduleId: 'EscapedExternal.gss', exports: {
      editor: { selfClassName: 'native-editor', targets: {} }
    } } }
  },
  nodes: [
    { id: 'escaped-editor', moduleId: 'EscapedExternal.gss', path: ['editor'], expected: {} },
    { id: 'escaped-inside', moduleId: 'EscapedExternal.gss', path: [], externalClassName: '',
      parent: 'escaped-editor', tag: 'span', expected: { 'background-color': 'rgba(0, 0, 0, 0)' } },
    { id: 'escaped-outside', moduleId: 'EscapedExternal.gss', path: [], externalClassName: '',
      tag: 'span', expected: { 'background-color': 'rgba(0, 0, 0, 0)' } }
  ],
  phases: [
    { name: 'newline-value', changes: [
      { node: 'escaped-inside', attributes: { 'data-mode': 'a\nb' } },
      { node: 'escaped-outside', attributes: { 'data-mode': 'a\nb' } }
    ], expected: { 'escaped-editor': {},
      'escaped-inside': { 'background-color': 'rgb(0, 0, 255)' },
      'escaped-outside': { 'background-color': 'rgba(0, 0, 0, 0)' }
    } },
    { name: 'literal-n-value', changes: [
      { node: 'escaped-inside', attributes: { 'data-mode': 'anb' } },
      { node: 'escaped-outside', attributes: { 'data-mode': 'anb' } }
    ], expected: { 'escaped-editor': {},
      'escaped-inside': { 'background-color': 'rgba(0, 0, 0, 0)' },
      'escaped-outside': { 'background-color': 'rgba(0, 0, 0, 0)' }
    } }
  ]
}];
