import type { CompiledReferenceFixture, ReferenceFixture } from './fixtures.js';

// Deliberately place an orphan runtime target beside a *different* nested owned anchor.
// An escaped dot in one class is not the descendant separator between two owned classes.
export const scopeSourceAliasFixtures: readonly (ReferenceFixture & {
  reference: CompiledReferenceFixture['reference'];
})[] = [{
  name: 'scope-source-path-separator-isolation',
  modules: [{ id: 'Alias.gss', source: `
    .a .b .c :global(.external) { color: red; }
    .a\\.b + .x { background-color: blue; }
  ` }],
  reference: {
    css: `.native-a .native-b .native-c .external { color: red; }
      .native-a-dot-b + .native-x { background-color: blue; }`,
    scopeSchemas: { 'Alias.gss': { moduleId: 'Alias.gss', exports: {
      a: { selfClassName: 'native-a', targets: {
        b: { selfClassName: 'native-b', targets: {
          c: { selfClassName: 'native-c', targets: {} }
        } }
      } },
      'a.b': { selfClassName: 'native-a-dot-b', targets: {
        x: { selfClassName: 'native-x', targets: {} }
      } }
    } } }
  },
  nodes: [
    { id: 'alias-a', moduleId: 'Alias.gss', path: ['a'], expected: { color: 'rgb(0, 0, 0)' } },
    { id: 'alias-b', moduleId: 'Alias.gss', path: ['a', 'b'], parent: 'alias-a', expected: { color: 'rgb(0, 0, 0)' } },
    { id: 'alias-orphan', moduleId: 'Alias.gss', path: ['a.b', 'x'], parent: 'alias-a',
      expected: { 'background-color': 'rgba(0, 0, 0, 0)' } },
    { id: 'alias-c', moduleId: 'Alias.gss', path: ['a', 'b', 'c'], parent: 'alias-b', expected: {} },
    { id: 'alias-external', moduleId: 'Alias.gss', path: [], externalClassName: 'external', parent: 'alias-c',
      expected: { color: 'rgb(255, 0, 0)' } },
    { id: 'alias-dot-source', moduleId: 'Alias.gss', path: ['a.b'], expected: { color: 'rgb(0, 0, 0)' } },
    { id: 'alias-valid-target', moduleId: 'Alias.gss', path: ['a.b', 'x'],
      expected: { 'background-color': 'rgb(0, 0, 255)' } }
  ]
}];
