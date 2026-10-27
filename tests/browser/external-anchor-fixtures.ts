import type { CompiledReferenceFixture, ReferenceFixture } from './fixtures.js';

// Independently authored native CSS: never derived from Compiler output.
// The external nodes intentionally have no GSS scope path or generated class.
export const externalAnchorFixtures: readonly (ReferenceFixture & {
  reference: CompiledReferenceFixture['reference'];
})[] = [{
  name: 'external-descendant-anchored-dynamic-class',
  modules: [{ id: 'External.gss', source: '.editor :global(.ProseMirror-focused) { color: red; }' }],
  reference: {
    css: '.native-editor-anchor .ProseMirror-focused { color: red; }',
    scopeSchemas: { 'External.gss': { moduleId: 'External.gss', exports: {
      editor: { selfClassName: 'native-editor-anchor', targets: {} }
    } } }
  },
  nodes: [
    { id: 'editor', moduleId: 'External.gss', path: ['editor'], expected: {} },
    { id: 'external-inside', parent: 'editor', moduleId: 'External.gss', path: [],
      externalClassName: 'ProseMirror-focused', expected: { color: 'rgb(255, 0, 0)' } },
    { id: 'external-outside', moduleId: 'External.gss', path: [],
      externalClassName: 'ProseMirror-focused', expected: { color: 'rgb(0, 0, 0)' } }
  ],
  phases: [
    { name: 'external-class-removed', changes: [{ node: 'external-inside', externalClassName: '' }],
      expected: { editor: {}, 'external-inside': { color: 'rgb(0, 0, 0)' },
        'external-outside': { color: 'rgb(0, 0, 0)' } } },
    { name: 'external-class-restored', changes: [{ node: 'external-inside', externalClassName: 'ProseMirror-focused' }],
      expected: { editor: {}, 'external-inside': { color: 'rgb(255, 0, 0)' },
        'external-outside': { color: 'rgb(0, 0, 0)' } } }
  ]
}, {
  name: 'external-descendant-owned-ancestor-specificity',
  modules: [{ id: 'NestedExternal.gss', source:
    '.outer .editor :global(.ProseMirror-focused) { color: red; }' }],
  // This competitor is authored independently and has three class selectors.
  // A compiled selector that drops the owned ancestor has only two and loses.
  setupCss: '.competitor.competitor .ProseMirror-focused { color: blue; }',
  reference: {
    css: '.native-outer .native-editor .ProseMirror-focused { color: red; }',
    scopeSchemas: { 'NestedExternal.gss': { moduleId: 'NestedExternal.gss', exports: {
      outer: { selfClassName: 'native-outer', targets: {
        editor: { selfClassName: 'native-editor', targets: {} }
      } }
    } } }
  },
  nodes: [
    { id: 'competitor', moduleId: 'NestedExternal.gss', path: [],
      externalClassName: 'competitor', expected: {} },
    { id: 'outer', parent: 'competitor', moduleId: 'NestedExternal.gss', path: ['outer'], expected: {} },
    { id: 'editor', parent: 'outer', moduleId: 'NestedExternal.gss', path: ['outer', 'editor'], expected: {} },
    { id: 'nested-external', parent: 'editor', moduleId: 'NestedExternal.gss', path: [],
      externalClassName: 'ProseMirror-focused', expected: { color: 'rgb(255, 0, 0)' } },
    { id: 'outside-editor', parent: 'competitor', moduleId: 'NestedExternal.gss', path: [],
      externalClassName: 'ProseMirror-focused', expected: { color: 'rgb(0, 0, 255)' } }
  ],
  phases: [
    { name: 'class-removed', changes: [{ node: 'nested-external', externalClassName: '' }],
      expected: { competitor: {}, outer: {}, editor: {}, 'nested-external': { color: 'rgb(0, 0, 0)' },
        'outside-editor': { color: 'rgb(0, 0, 255)' } } },
    { name: 'class-restored', changes: [{ node: 'nested-external', externalClassName: 'ProseMirror-focused' }],
      expected: { competitor: {}, outer: {}, editor: {}, 'nested-external': { color: 'rgb(255, 0, 0)' },
        'outside-editor': { color: 'rgb(0, 0, 255)' } } }
  ]
}, {
  name: 'external-descendant-registered-media-layer',
  config: { layers: ['base'], conditions: { media: ['(min-width: 400px)'] } },
  modules: [{ id: 'ConditionedExternal.gss', source:
    '@layer base { @media (min-width: 400px) { .editor :global(.ProseMirror-focused) { color: red; } } }' }],
  reference: {
    css: '@layer base; @layer base { @media (min-width: 400px) { .native-editor-anchor .ProseMirror-focused { color: red; } } }',
    scopeSchemas: { 'ConditionedExternal.gss': { moduleId: 'ConditionedExternal.gss', exports: {
      editor: { selfClassName: 'native-editor-anchor', targets: {} }
    } } }
  },
  nodes: [
    { id: 'editor', moduleId: 'ConditionedExternal.gss', path: ['editor'], expected: {} },
    { id: 'conditioned-inside', parent: 'editor', moduleId: 'ConditionedExternal.gss', path: [],
      externalClassName: 'ProseMirror-focused', expected: { color: 'rgb(255, 0, 0)' } },
    { id: 'conditioned-outside', moduleId: 'ConditionedExternal.gss', path: [],
      externalClassName: 'ProseMirror-focused', expected: { color: 'rgb(0, 0, 0)' } }
  ],
  phases: [
    { name: 'media-off', viewportWidth: 300, changes: [],
      expected: { editor: {}, 'conditioned-inside': { color: 'rgb(0, 0, 0)' },
        'conditioned-outside': { color: 'rgb(0, 0, 0)' } } },
    { name: 'media-restored', viewportWidth: 640, changes: [],
      expected: { editor: {}, 'conditioned-inside': { color: 'rgb(255, 0, 0)' },
        'conditioned-outside': { color: 'rgb(0, 0, 0)' } } }
  ]
}, {
  name: 'external-descendant-compound-class',
  modules: [{ id: 'CompoundExternal.gss', source:
    '.editor :global(.ProseMirror.ProseMirror-focused) { color: red; }' }],
  reference: {
    css: '.native-editor-anchor .ProseMirror.ProseMirror-focused { color: red; }',
    scopeSchemas: { 'CompoundExternal.gss': { moduleId: 'CompoundExternal.gss', exports: {
      editor: { selfClassName: 'native-editor-anchor', targets: {} }
    } } }
  },
  nodes: [
    { id: 'editor', moduleId: 'CompoundExternal.gss', path: ['editor'], expected: {} },
    { id: 'compound-inside', parent: 'editor', moduleId: 'CompoundExternal.gss', path: [],
      externalClassName: 'ProseMirror ProseMirror-focused', expected: { color: 'rgb(255, 0, 0)' } },
    { id: 'compound-outside', moduleId: 'CompoundExternal.gss', path: [],
      externalClassName: 'ProseMirror ProseMirror-focused', expected: { color: 'rgb(0, 0, 0)' } },
    { id: 'focused-only', parent: 'editor', moduleId: 'CompoundExternal.gss', path: [],
      externalClassName: 'ProseMirror-focused', expected: { color: 'rgb(0, 0, 0)' } }
  ],
  phases: [
    { name: 'focus-class-removed', changes: [{ node: 'compound-inside', externalClassName: 'ProseMirror' }],
      expected: { editor: {}, 'compound-inside': { color: 'rgb(0, 0, 0)' },
        'compound-outside': { color: 'rgb(0, 0, 0)' }, 'focused-only': { color: 'rgb(0, 0, 0)' } } },
    { name: 'focus-class-restored', changes: [{ node: 'compound-inside', externalClassName: 'ProseMirror ProseMirror-focused' }],
      expected: { editor: {}, 'compound-inside': { color: 'rgb(255, 0, 0)' },
        'compound-outside': { color: 'rgb(0, 0, 0)' }, 'focused-only': { color: 'rgb(0, 0, 0)' } } }
  ]
}, {
  name: 'owned-node-external-class-condition',
  modules: [{ id: 'SameNode.gss', source:
    '.editor:global(.ProseMirror-focused) { color: red; }' }],
  reference: {
    css: '.native-editor.ProseMirror-focused { color: red; }',
    scopeSchemas: { 'SameNode.gss': { moduleId: 'SameNode.gss', exports: {
      editor: { selfClassName: 'native-editor', targets: {} }
    } } }
  },
  nodes: [
    { id: 'editor-focused', moduleId: 'SameNode.gss', path: ['editor'],
      extraClassName: 'ProseMirror-focused', expected: { color: 'rgb(255, 0, 0)' } },
    { id: 'editor-unfocused', moduleId: 'SameNode.gss', path: ['editor'],
      extraClassName: '', expected: { color: 'rgb(0, 0, 0)' } },
    { id: 'external-only', moduleId: 'SameNode.gss', path: [],
      externalClassName: 'ProseMirror-focused', expected: { color: 'rgb(0, 0, 0)' } }
  ],
  phases: [
    { name: 'owned-focus-removed', changes: [{ node: 'editor-focused', extraClassName: '' }],
      expected: { 'editor-focused': { color: 'rgb(0, 0, 0)' },
        'editor-unfocused': { color: 'rgb(0, 0, 0)' }, 'external-only': { color: 'rgb(0, 0, 0)' } } },
    { name: 'owned-focus-restored', changes: [{ node: 'editor-focused', extraClassName: 'ProseMirror-focused' }],
      expected: { 'editor-focused': { color: 'rgb(255, 0, 0)' },
        'editor-unfocused': { color: 'rgb(0, 0, 0)' }, 'external-only': { color: 'rgb(0, 0, 0)' } } }
  ]
}];
