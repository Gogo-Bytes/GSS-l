import type { ScopeSchema } from '@gss-l/compiler';
import type { ReferenceFixture } from './fixtures.js';

// Hand-authored native oracle for the bounded ADR-0010/0012 chain
// `.input + .label .icon`: adjacent source/label, then owned descendant icon.
const scopeSchemas: Readonly<Record<string, ScopeSchema>> = {
  'Interleaved.gss': { moduleId: 'Interleaved.gss', exports: {
    input: { selfClassName: 'input', targets: {
      label: { selfClassName: 'label', targets: { icon: { selfClassName: 'icon', targets: {} } } }
    } }
  } }
};
const declarations = [
  '.input + .label .icon { color: red; }',
  '.input + .label .icon { background-color: blue; }'
] as const;

export const interleavedChainFixtures: readonly (ReferenceFixture & {
  reference: { css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>> };
})[] = [false, true].map((reverse) => {
  const sourceRules = reverse ? [...declarations].reverse() : [...declarations];
  return {
    name: `interleaved-owned-descendant-${reverse ? 'reversed' : 'forward'}`,
    modules: [{ id: 'Interleaved.gss', source: sourceRules.join('\n') }],
    setupCss: 'div { color: black; }',
    reference: {
      css: '.input + .label .icon { color: red; } .input + .label .icon { background-color: blue; }',
      scopeSchemas
    },
    nodes: [
      { id: 'source', tag: 'input', moduleId: 'Interleaved.gss', path: ['input'], expected: {} },
      { id: 'label', moduleId: 'Interleaved.gss', path: ['input', 'label'], expected: {} },
      { id: 'icon', parent: 'label', moduleId: 'Interleaved.gss', path: ['input', 'label', 'icon'], expected: {
        color: 'rgb(255, 0, 0)', 'background-color': 'rgb(0, 0, 255)'
      } }
    ]
  };
});
