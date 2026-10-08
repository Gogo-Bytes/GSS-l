import type { CompiledReferenceFixture, ReferenceFixture } from './fixtures.js';

// Hand-authored native CSS. The observed descendant is supplied by a third party,
// not by either compiler's ScopeSchema.
export const externalObservationFixtures: readonly (ReferenceFixture & {
  reference: CompiledReferenceFixture['reference'];
})[] = [{
  name: 'observed-external-descendant-class',
  modules: [{ id: 'ObservedExternal.gss', source:
    '.editor:has(:global(.ProseMirror-focused)) { background-color: red; }' }],
  reference: {
    css: '.native-editor:has(.ProseMirror-focused) { background-color: red; }',
    scopeSchemas: { 'ObservedExternal.gss': { moduleId: 'ObservedExternal.gss', exports: {
      editor: { selfClassName: 'native-editor', targets: {} }
    } } }
  },
  nodes: [
    { id: 'editor', moduleId: 'ObservedExternal.gss', path: ['editor'],
      expected: { 'background-color': 'rgb(255, 0, 0)' } },
    { id: 'observed-child', parent: 'editor', moduleId: 'ObservedExternal.gss', path: [],
      externalClassName: 'ProseMirror-focused', expected: { 'background-color': 'rgba(0, 0, 0, 0)' } },
    { id: 'editor-empty', moduleId: 'ObservedExternal.gss', path: ['editor'],
      expected: { 'background-color': 'rgba(0, 0, 0, 0)' } },
    { id: 'outside-child', moduleId: 'ObservedExternal.gss', path: [],
      externalClassName: 'ProseMirror-focused', expected: { 'background-color': 'rgba(0, 0, 0, 0)' } }
  ],
  phases: [
    { name: 'observed-class-removed', changes: [{ node: 'observed-child', externalClassName: '' }],
      expected: { editor: { 'background-color': 'rgba(0, 0, 0, 0)' },
        'observed-child': { 'background-color': 'rgba(0, 0, 0, 0)' },
        'editor-empty': { 'background-color': 'rgba(0, 0, 0, 0)' },
        'outside-child': { 'background-color': 'rgba(0, 0, 0, 0)' } } },
    { name: 'observed-class-restored', changes: [{ node: 'observed-child', externalClassName: 'ProseMirror-focused' }],
      expected: { editor: { 'background-color': 'rgb(255, 0, 0)' },
        'observed-child': { 'background-color': 'rgba(0, 0, 0, 0)' },
        'editor-empty': { 'background-color': 'rgba(0, 0, 0, 0)' },
        'outside-child': { 'background-color': 'rgba(0, 0, 0, 0)' } } }
  ]
}];
