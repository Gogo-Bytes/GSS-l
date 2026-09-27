import type { ScopeSchema } from '@gss-l/compiler';
import type { ReferenceFixture } from './fixtures.js';

type CrossLayerSpecificityFixture = ReferenceFixture & {
  reference: { css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>> };
};

const moduleId = 'CrossLayerSpecificity.gss';
const scopeSchemas: Readonly<Record<string, ScopeSchema>> = {
  [moduleId]: { moduleId, exports: {
    probe: { selfClassName: 'probe', targets: {} },
    error: { selfClassName: 'error', targets: {} }
  } }
};

const baseRule = '@layer base { .probe:has(.error) { color: red; background-color: red !important; } }';
const overrideRule = '@layer override { .probe:where([data-mode=ready]) { color: blue; background-color: blue !important; } }';
const unlayeredRule = '.probe { outline-color: green; }';

function fixture(reverseSource: boolean, reverseConfig: boolean): CrossLayerSpecificityFixture {
  const rules = reverseSource ? [overrideRule, baseRule, unlayeredRule] : [baseRule, overrideRule, unlayeredRule];
  const layers = reverseConfig ? ['override', 'base'] : ['base', 'override'];
  const expected = { color: 'rgb(255, 0, 0)', 'background-color': 'rgb(255, 0, 0)', 'outline-color': 'rgb(0, 128, 0)' };
  const checked = reverseConfig
    ? { color: 'rgb(255, 0, 0)', 'background-color': 'rgb(0, 0, 255)', 'outline-color': 'rgb(0, 128, 0)' }
    : { color: 'rgb(0, 0, 255)', 'background-color': 'rgb(255, 0, 0)', 'outline-color': 'rgb(0, 128, 0)' };
  const prelude = reverseConfig ? '@layer override, base;' : '@layer base, override;';
  return {
    name: `cross-layer-specificity-${reverseSource ? 'reversed' : 'forward'}-source-${reverseConfig ? 'reversed' : 'forward'}-config`,
    config: { layers },
    modules: [{ id: moduleId, source: rules.join('\n') }],
    reference: { css: `${prelude}\n\n${rules.join('\n')}`, scopeSchemas },
    nodes: [
      { id: 'probe', moduleId, path: ['probe'], expected },
      { id: 'error', parent: 'probe', moduleId, path: ['error'], tag: 'span', expected: {} }
    ],
    phases: [{ name: 'ready', changes: [{ node: 'probe', attributes: { 'data-mode': 'ready' } }], expected: { probe: checked } }]
  };
}

export const crossLayerSpecificityFixtures: readonly CrossLayerSpecificityFixture[] = [
  ...[false, true].flatMap((reverseSource) => [false, true].map((reverseConfig) =>
    fixture(reverseSource, reverseConfig)))
];
