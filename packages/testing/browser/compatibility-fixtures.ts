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
}];
