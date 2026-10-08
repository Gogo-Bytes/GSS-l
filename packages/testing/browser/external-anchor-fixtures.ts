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
}];
