import type { ReferenceFixture } from './fixtures.js';

// Expectations are native cascade literals, never derived from either compilation.
export const conditionLayerFixtures: readonly ReferenceFixture[] = [
  ...(['media', 'supports', 'container'] as const).flatMap((kind) =>
    [false, true].flatMap((reverseSource) => [false, true].map((reverseConfig) =>
      conditionFixture(kind, reverseSource, reverseConfig)))),
  ...[false, true].flatMap((reverseSource) => [false, true].map((reverseConfig) =>
    layerFixture(reverseSource, reverseConfig))),
  ...[false, true].map(layerConditionFixture)
];

function conditionFixture(kind: 'media' | 'supports' | 'container', reverseSource: boolean, reverseConfig: boolean): ReferenceFixture {
  const moduleId = 'Condition.gss';
  const queries = kind === 'supports' ? ['(display: block)', '(display: grid)', '(display: gss-unsupported)']
    : kind === 'container' ? ['panel (min-width: 200px)', 'panel (min-width: 400px)']
      : ['(min-width: 200px)', '(min-width: 400px)'];
  const groups = [
    '.provider {} .outer .specific { color: green; } .important { color: purple !important; } .target { color: black; padding-left: 1px !important; }',
    `@${kind} ${queries[0]} { .target { color: red; padding-left: 3px !important; } .specific { color: red; } .important { color: red; } }`,
    `@${kind} ${queries[1]} { .target { color: blue; padding-left: 7px !important; } .specific { color: blue; } .important { color: blue; } }`,
    ...kind === 'supports' ? [`@supports ${queries[2]} { .target { color: orange; padding-left: 99px !important; } }`] : []
  ];
  const stable = { specific: { color: 'rgb(0, 128, 0)' }, important: { color: 'rgb(128, 0, 128)' } };
  const both = { target: { color: reverseConfig ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)', 'padding-left': reverseConfig ? '3px' : '7px' }, ...stable };
  const none = { target: { color: 'rgb(0, 0, 0)', 'padding-left': '1px' }, ...stable };
  const first = { target: { color: 'rgb(255, 0, 0)', 'padding-left': '3px' }, ...stable };
  const resize = (width: number) => kind === 'media' ? { viewportWidth: width } : { containerWidth: width };
  const modules = [
    { id: moduleId, source: (reverseSource ? [...groups].reverse() : groups).join('\n') },
    { id: 'Isolation.gss', source: '.target { color: orange; }' }
  ];
  return {
    name: `registered-${kind}-${reverseSource ? 'reverse' : 'forward'}-source-${reverseConfig ? 'reverse' : 'forward'}-config`,
    config: { conditions: { [kind]: reverseConfig ? [...queries].reverse() : queries } },
    modules: reverseSource ? [...modules].reverse() : modules,
    // Identical provider-only setup, separate from all measured oracle declarations.
    ...(kind === 'container' ? { setupCss: '#provider { container-type: inline-size; container-name: panel; width: 640px; }' } : {}),
    conditionProbes: kind === 'media' ? { media: queries } : kind === 'supports' ? { supports: queries } : { container: 'provider' },
    nodes: [
      { id: 'provider', moduleId, path: ['provider'], expected: {} },
      { id: 'outer', moduleId, path: ['outer'], parent: 'provider', expected: {} },
      { id: 'target', moduleId, path: ['target'], parent: 'provider', expected: both.target },
      { id: 'specific', moduleId, path: ['outer', 'specific'], parent: 'outer', expected: stable.specific },
      { id: 'important', moduleId, path: ['important'], parent: 'provider', expected: stable.important },
      { id: 'isolated', moduleId: 'Isolation.gss', path: ['target'], expected: { color: 'rgb(255, 165, 0)' } }
    ],
    phases: kind === 'supports' ? [
      { name: 'supports-rechecked', changes: [], expected: { ...both, isolated: { color: 'rgb(255, 165, 0)' } } }
    ] : [
      { name: 'no-match', ...resize(100), changes: [], expected: { ...none, isolated: { color: 'rgb(255, 165, 0)' } } },
      { name: 'first-only', ...resize(300), changes: [], expected: { ...first, isolated: { color: 'rgb(255, 165, 0)' } } },
      { name: 'restored-both', ...resize(640), changes: [], expected: { ...both, isolated: { color: 'rgb(255, 165, 0)' } } }
    ]
  };
}

function layerFixture(reverseSource: boolean, reverseConfig: boolean): ReferenceFixture {
  const moduleId = 'Layers.gss';
  const groups = [
    '@layer early { .normal { color: red; } .important { color: red !important; } .unlayered { color: red; } .unlayeredImportant { color: red !important; } }',
    '@layer late { .normal { color: blue; } .important { color: blue !important; } .unlayered { color: blue; } .unlayeredImportant { color: blue !important; } }',
    '.unlayered { color: green; } .unlayeredImportant { color: green !important; }'
  ];
  const first = reverseConfig ? 'rgb(0, 0, 255)' : 'rgb(255, 0, 0)';
  const last = reverseConfig ? 'rgb(255, 0, 0)' : 'rgb(0, 0, 255)';
  return {
    name: `native-layers-${reverseSource ? 'reverse' : 'forward'}-source-${reverseConfig ? 'reverse' : 'forward'}-config`,
    config: { layers: reverseConfig ? ['late', 'early'] : ['early', 'late'] },
    modules: [{ id: moduleId, source: (reverseSource ? [...groups].reverse() : groups).join('\n') }],
    nodes: [
      { id: 'layer-normal', moduleId, path: ['normal'], expected: { color: last } },
      { id: 'layer-important', moduleId, path: ['important'], expected: { color: first } },
      { id: 'unlayered', moduleId, path: ['unlayered'], expected: { color: 'rgb(0, 128, 0)' } },
      { id: 'unlayered-important', moduleId, path: ['unlayeredImportant'], expected: { color: first } }
    ]
  };
}

function layerConditionFixture(reverse: boolean): ReferenceFixture {
  const moduleId = 'LayerCondition.gss';
  const groups = [
    '@layer early { .target { color: red; padding-left: 2px !important; } @media (min-width: 400px) { .target { color: purple; padding-left: 7px !important; } } }',
    '@layer late { .target { color: blue; padding-left: 9px !important; } }'
  ];
  const baseline = { color: 'rgb(0, 0, 255)', 'padding-left': '7px' };
  return {
    name: `layer-registered-media-${reverse ? 'reverse' : 'forward'}`,
    config: { layers: ['early', 'late'], conditions: { media: ['(min-width: 400px)'] } },
    modules: [{ id: moduleId, source: (reverse ? [...groups].reverse() : groups).join('\n') }],
    conditionProbes: { media: ['(min-width: 400px)'] },
    nodes: [{ id: 'layer-condition', moduleId, path: ['target'], expected: baseline }],
    phases: [
      { name: 'no-match', viewportWidth: 100, changes: [], expected: { 'layer-condition': { color: 'rgb(0, 0, 255)', 'padding-left': '2px' } } },
      { name: 'restored', viewportWidth: 640, changes: [], expected: { 'layer-condition': baseline } }
    ]
  };
}
