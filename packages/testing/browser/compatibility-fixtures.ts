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
