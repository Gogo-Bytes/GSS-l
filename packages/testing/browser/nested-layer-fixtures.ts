import type { ScopeSchema } from '@gss-l/compiler';
import type { ReferenceFixture } from './fixtures.js';

type NestedLayerFixture = ReferenceFixture & {
  reference: { css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>> };
};

const moduleId = 'NestedLayers.gss';
const scopeSchemas: Readonly<Record<string, ScopeSchema>> = {
  [moduleId]: { moduleId, exports: { probe: { selfClassName: 'probe', targets: {} } } }
};

const sourceGroups = [
  `@layer framework { @layer base { .probe {
    color: red;
    background-color: red !important;
    border-color: red;
    outline-color: red !important;
  } } }`,
  `@layer framework { @layer utilities { .probe {
    color: blue;
    background-color: blue !important;
    border-color: blue;
    outline-color: blue !important;
  } } }`,
  '.probe { border-color: green; outline-color: green !important; }'
];

// This independent native reference is intentionally authored separately from sourceGroups.
const referenceGroups = [
  `@layer framework { @layer base { .probe {
    color: red;
    background-color: red !important;
    border-color: red;
    outline-color: red !important;
  } } }`,
  `@layer framework { @layer utilities { .probe {
    color: blue;
    background-color: blue !important;
    border-color: blue;
    outline-color: blue !important;
  } } }`,
  '.probe { border-color: green; outline-color: green !important; }'
];

function fixture(reverseSource: boolean, reverseConfig: boolean): NestedLayerFixture {
  const layers = reverseConfig
    ? ['framework.utilities', 'framework.base']
    : ['framework.base', 'framework.utilities'];
  const source = (reverseSource ? [...sourceGroups].reverse() : sourceGroups).join('\n');
  const expected = reverseConfig ? {
    color: 'rgb(255, 0, 0)',
    'background-color': 'rgb(0, 0, 255)',
    'border-top-color': 'rgb(0, 128, 0)',
    'outline-color': 'rgb(0, 0, 255)'
  } : {
    color: 'rgb(0, 0, 255)',
    'background-color': 'rgb(255, 0, 0)',
    'border-top-color': 'rgb(0, 128, 0)',
    'outline-color': 'rgb(255, 0, 0)'
  };
  const referenceSource = (reverseSource ? [...referenceGroups].reverse() : referenceGroups).join('\n');
  const referenceCss = `${reverseConfig
    ? '@layer framework.utilities, framework.base;'
    : '@layer framework.base, framework.utilities;'}\n\n${referenceSource}`;
  return {
    name: `nested-layers-${reverseSource ? 'reverse' : 'forward'}-source-${reverseConfig ? 'reverse' : 'forward'}-config`,
    config: { layers },
    modules: [{ id: moduleId, source }],
    reference: { css: referenceCss, scopeSchemas },
    nodes: [{ id: 'nested-layer-probe', moduleId, path: ['probe'], expected }]
  };
}

export const nestedLayerFixtures: readonly NestedLayerFixture[] = [
  ...[false, true].flatMap((reverseSource) => [false, true].map((reverseConfig) =>
    fixture(reverseSource, reverseConfig)))
];
