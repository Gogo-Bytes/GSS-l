import type { CompiledReferenceFixture, ReferenceFixture } from './fixtures.js';

// Independent native CSS, authored in both source orders; never derived from Compiler output.
const base = '.native-editor { color: blue; }';
const focused = '.native-editor.ProseMirror-focused { color: red; }';
const sourceBase = '.editor { color: blue; }';
const sourceFocused = '.editor:global(.ProseMirror-focused) { color: red; }';

export const sameNodeRefinementFixtures: readonly (ReferenceFixture & {
  reference: CompiledReferenceFixture['reference'];
})[] = [
  { name: 'same-node-refinement-base-first', source: `${sourceBase} ${sourceFocused}`, css: `${base} ${focused}` },
  { name: 'same-node-refinement-condition-first', source: `${sourceFocused} ${sourceBase}`, css: `${focused} ${base}` }
].map(({ name, source, css }) => ({
  name,
  modules: [{ id: 'Refinement.gss', source }],
  reference: {
    css,
    scopeSchemas: { 'Refinement.gss': { moduleId: 'Refinement.gss', exports: {
      editor: { selfClassName: 'native-editor', targets: {} }
    } } }
  },
  nodes: [
    { id: 'editor-focused', moduleId: 'Refinement.gss', path: ['editor'],
      extraClassName: 'ProseMirror-focused', expected: { color: 'rgb(255, 0, 0)' } },
    { id: 'editor-unfocused', moduleId: 'Refinement.gss', path: ['editor'],
      extraClassName: '', expected: { color: 'rgb(0, 0, 255)' } },
    { id: 'external-only', moduleId: 'Refinement.gss', path: [],
      externalClassName: 'ProseMirror-focused', expected: { color: 'rgb(0, 0, 0)' } }
  ],
  phases: [
    { name: 'owned-focus-removed', changes: [{ node: 'editor-focused', extraClassName: '' }],
      expected: { 'editor-focused': { color: 'rgb(0, 0, 255)' },
        'editor-unfocused': { color: 'rgb(0, 0, 255)' }, 'external-only': { color: 'rgb(0, 0, 0)' } } },
    { name: 'owned-focus-restored', changes: [{ node: 'editor-focused', extraClassName: 'ProseMirror-focused' }],
      expected: { 'editor-focused': { color: 'rgb(255, 0, 0)' },
        'editor-unfocused': { color: 'rgb(0, 0, 255)' }, 'external-only': { color: 'rgb(0, 0, 0)' } } }
  ]
}));
