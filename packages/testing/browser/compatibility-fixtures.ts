import type { CompiledReferenceFixture, ReferenceFixture } from './fixtures.js';

// Native CSS is written independently of the compatibility transformer and its output.
export const compatibilityFixtures: readonly (ReferenceFixture & {
  reference: CompiledReferenceFixture['reference'];
})[] = [{
  name: 'host-target-indivisible-flex-sequence',
  config: { compatibilityTargetStages: [{ safari: '6.0' }] },
  modules: [{ id: 'Flex.gss', source: '.card { display: flex; }' }],
  reference: {
    css: '.native-card { display: -webkit-box; display: -webkit-flex; display: flex; }',
    scopeSchemas: { 'Flex.gss': { moduleId: 'Flex.gss', exports: {
      card: { selfClassName: 'native-card', targets: {} }
    } } }
  },
  nodes: [
    { id: 'card', moduleId: 'Flex.gss', path: ['card'], expected: { display: 'flex' } },
    { id: 'unowned', moduleId: 'Flex.gss', path: [], externalClassName: '', expected: { display: 'block' } }
  ]
}, {
  name: 'host-target-layered-media-sequence',
  config: { compatibilityTargetStages: [{ safari: '6.0' }],
    layers: ['base', 'components'], conditions: { media: ['(min-width: 400px)'] } },
  conditionProbes: { media: ['(min-width: 400px)'] },
  modules: [{ id: 'LayeredFlex.gss', source: `
    @layer base { .card { display: block; } }
    @layer components { @media (min-width: 400px) { .card { display: flex; } } }
  ` }],
  reference: {
    css: `@layer base, components;
      @layer base { .native-card { display: block; } }
      @layer components { @media (min-width: 400px) {
        .native-card { display: -webkit-box; display: -webkit-flex; display: flex; }
      } }`,
    scopeSchemas: { 'LayeredFlex.gss': { moduleId: 'LayeredFlex.gss', exports: {
      card: { selfClassName: 'native-card', targets: {} }
    } } }
  },
  nodes: [{ id: 'layered-card', moduleId: 'LayeredFlex.gss', path: ['card'], expected: { display: 'flex' } }],
  phases: [
    { name: 'media-off', viewportWidth: 100, changes: [], expected: { 'layered-card': { display: 'block' } } },
    { name: 'media-restored', viewportWidth: 640, changes: [], expected: { 'layered-card': { display: 'flex' } } }
  ]
}, {
  name: 'host-target-preserved-media-isolation',
  config: { compatibilityTargetStages: [{ safari: '6.0' }], atomizationFallback: 'preserve-module',
    layers: ['base'], conditions: { media: ['(min-width: 400px)'] } },
  conditionProbes: { media: ['(min-width: 400px)'] },
  preservedModuleIds: ['Fallback.gss'],
  modules: [
    { id: 'Fallback.gss', source: `@layer base {
      .card { display: flex; color: black; }
      @media (min-width: 400px) { .card { flex-direction: column; color: red; } }
    }` },
    { id: 'Atomic.gss', source: '.other { color: blue; }' }
  ],
  reference: {
    css: `@layer base;
      @layer base { .native-fallback { display: -webkit-box; display: -webkit-flex; display: flex; color: black; }
        @media (min-width: 400px) { .native-fallback { -webkit-box-orient: vertical;
          -webkit-box-direction: normal; -webkit-flex-direction: column; flex-direction: column; color: red; } } }
      .native-atomic { color: blue; }`,
    scopeSchemas: {
      'Fallback.gss': { moduleId: 'Fallback.gss', exports: { card: { selfClassName: 'native-fallback', targets: {} } } },
      'Atomic.gss': { moduleId: 'Atomic.gss', exports: { other: { selfClassName: 'native-atomic', targets: {} } } }
    }
  },
  nodes: [
    { id: 'fallback-card', moduleId: 'Fallback.gss', path: ['card'], expected: {
      display: 'flex', 'flex-direction': 'column', color: 'rgb(255, 0, 0)'
    } },
    { id: 'atomic-other', moduleId: 'Atomic.gss', path: ['other'], expected: { color: 'rgb(0, 0, 255)' } }
  ],
  phases: [
    { name: 'media-off', viewportWidth: 100, changes: [], expected: {
      'fallback-card': { display: 'flex', 'flex-direction': 'row', color: 'rgb(0, 0, 0)' },
      'atomic-other': { color: 'rgb(0, 0, 255)' }
    } },
    { name: 'media-restored', viewportWidth: 640, changes: [], expected: {
      'fallback-card': { display: 'flex', 'flex-direction': 'column', color: 'rgb(255, 0, 0)' },
      'atomic-other': { color: 'rgb(0, 0, 255)' }
    } }
  ]
}, {
  name: 'host-target-asset-property-resource',
  config: { compatibilityTargetStages: [{ safari: '6.0' }] },
  assetUrls: { 'asset-a': '/__reference_assets__/one-a.svg' },
  assetDimensions: { '/__reference_assets__/one-a.svg': '3x2' },
  modules: [{ id: 'Resource.gss', source: `
    @property --tone { syntax: "<color>"; inherits: false; initial-value: red; }
    .card { color: var(--tone); background-image: url("./a.svg"); display: flex; }
  `, assetReferences: [{ url: './a.svg', identity: 'asset-a' }] }],
  reference: {
    css: `
      @property --tone { syntax: "<color>"; inherits: false; initial-value: red; }
      .native-card { color: var(--tone); background-image: url("/__reference_assets__/one-a.svg");
        display: -webkit-box; display: -webkit-flex; display: flex; }
    `,
    scopeSchemas: { 'Resource.gss': { moduleId: 'Resource.gss', exports: {
      card: { selfClassName: 'native-card', targets: {} }
    } } }
  },
  nodes: [
    { id: 'resource-card', moduleId: 'Resource.gss', path: ['card'], expected: {
      color: 'rgb(255, 0, 0)', 'background-image': 'url("/__reference_assets__/one-a.svg")', display: 'flex'
    } },
    { id: 'resource-unowned', moduleId: 'Resource.gss', path: [], externalClassName: '', expected: {
      color: 'rgb(0, 0, 0)', 'background-image': 'none', display: 'block'
    } }
  ]
}];
