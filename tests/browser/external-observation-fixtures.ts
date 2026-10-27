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
}, {
  name: 'functional-external-owned-conditions',
  modules: [{ id: 'FunctionalExternal.gss', source: `
    .editorNot:not(:global(.external)) { background-color: red; }
    .editorIs:is(:global(.external)) { background-color: red; }
    .editorWhere:where(:global(.external)) { background-color: red; }
  ` }],
  reference: {
    css: `
      .native-not:not(.external) { background-color: red; }
      .native-is:is(.external) { background-color: red; }
      .native-where:where(.external) { background-color: red; }
    `,
    scopeSchemas: { 'FunctionalExternal.gss': { moduleId: 'FunctionalExternal.gss', exports: {
      editorNot: { selfClassName: 'native-not', targets: {} },
      editorIs: { selfClassName: 'native-is', targets: {} },
      editorWhere: { selfClassName: 'native-where', targets: {} }
    } } }
  },
  nodes: [
    { id: 'not-with-class', moduleId: 'FunctionalExternal.gss', path: ['editorNot'],
      extraClassName: 'external', expected: { 'background-color': 'rgba(0, 0, 0, 0)' } },
    { id: 'not-without-class', moduleId: 'FunctionalExternal.gss', path: ['editorNot'],
      expected: { 'background-color': 'rgb(255, 0, 0)' } },
    { id: 'is-with-class', moduleId: 'FunctionalExternal.gss', path: ['editorIs'],
      extraClassName: 'external', expected: { 'background-color': 'rgb(255, 0, 0)' } },
    { id: 'is-without-class', moduleId: 'FunctionalExternal.gss', path: ['editorIs'],
      expected: { 'background-color': 'rgba(0, 0, 0, 0)' } },
    { id: 'where-with-class', moduleId: 'FunctionalExternal.gss', path: ['editorWhere'],
      extraClassName: 'external', expected: { 'background-color': 'rgb(255, 0, 0)' } },
    { id: 'where-without-class', moduleId: 'FunctionalExternal.gss', path: ['editorWhere'],
      expected: { 'background-color': 'rgba(0, 0, 0, 0)' } },
    { id: 'outside', moduleId: 'FunctionalExternal.gss', path: [], externalClassName: 'external',
      expected: { 'background-color': 'rgba(0, 0, 0, 0)' } }
  ],
  phases: [
    { name: 'external-classes-removed', changes: [
      { node: 'not-with-class', extraClassName: '' },
      { node: 'is-with-class', extraClassName: '' },
      { node: 'where-with-class', extraClassName: '' }
    ], expected: {
      'not-with-class': { 'background-color': 'rgb(255, 0, 0)' },
      'not-without-class': { 'background-color': 'rgb(255, 0, 0)' },
      'is-with-class': { 'background-color': 'rgba(0, 0, 0, 0)' },
      'is-without-class': { 'background-color': 'rgba(0, 0, 0, 0)' },
      'where-with-class': { 'background-color': 'rgba(0, 0, 0, 0)' },
      'where-without-class': { 'background-color': 'rgba(0, 0, 0, 0)' },
      outside: { 'background-color': 'rgba(0, 0, 0, 0)' }
    } },
    { name: 'external-classes-restored', changes: [
      { node: 'not-with-class', extraClassName: 'external' },
      { node: 'is-with-class', extraClassName: 'external' },
      { node: 'where-with-class', extraClassName: 'external' }
    ], expected: {
      'not-with-class': { 'background-color': 'rgba(0, 0, 0, 0)' },
      'not-without-class': { 'background-color': 'rgb(255, 0, 0)' },
      'is-with-class': { 'background-color': 'rgb(255, 0, 0)' },
      'is-without-class': { 'background-color': 'rgba(0, 0, 0, 0)' },
      'where-with-class': { 'background-color': 'rgb(255, 0, 0)' },
      'where-without-class': { 'background-color': 'rgba(0, 0, 0, 0)' },
      outside: { 'background-color': 'rgba(0, 0, 0, 0)' }
    } }
  ]
}];
