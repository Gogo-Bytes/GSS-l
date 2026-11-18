import type { ReferenceFixture } from './fixtures.js';

// Independent native declarations: verify the shared mode and the two non-overlapping writes.
const cases = [
  ['white-space-before-text-wrap', 'white-space:pre; text-wrap:pretty', 'wrap', 'pretty'],
  ['white-space-after-text-wrap', 'text-wrap:pretty; white-space:pre', 'nowrap', 'pretty'],
  ['white-space-before-mode', 'white-space:pre; text-wrap-mode:wrap', 'wrap', 'auto'],
  ['white-space-after-mode', 'text-wrap-mode:wrap; white-space:pre', 'nowrap', 'auto'],
  ['important-wrap-before-white-space', 'text-wrap:pretty!important; white-space:pre', 'wrap', 'pretty']
] as const;

export const whiteSpaceFixtures = cases.map(([name, declarations, mode, style]) => {
  const id = 'Whitespace.gss';
  const css = `.text { ${declarations} }`;
  return {
    name, modules: [{ id, source: css }],
    reference: { css, scopeSchemas: { [id]: { moduleId: id, exports: { text: { selfClassName: 'text', targets: {} } } } } },
    nodes: [{ id: 'text', moduleId: id, path: ['text'], expected: {
      'text-wrap-mode': mode, 'text-wrap-style': style, 'white-space-collapse': 'preserve'
    } }]
  } satisfies ReferenceFixture & { reference: unknown };
});
