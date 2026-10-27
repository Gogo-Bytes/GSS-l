import type { CompiledReferenceFixture, ReferenceFixture } from './fixtures.js';

// Browser-native CSS and literal readings are authored independently of GSS output.
export const propertyInheritanceFixtures: readonly (ReferenceFixture & {
  reference: CompiledReferenceFixture['reference'];
})[] = [{
  name: 'registered-property-inheritance-and-module-isolation',
  modules: [
    { id: 'Inheritance.gss', source: `
      @property --tone { syntax: "<color>"; inherits: true; initial-value: red; }
      .parent { --tone: blue; }
      .parent[data-active="yes"] { --tone: green; }
      .parent .child { color: var(--tone); }
      .alone { color: var(--tone); }
    ` },
    { id: 'Other.gss', source: '.other { --tone: purple; color: var(--tone); }' }
  ],
  reference: {
    css: `
      @property --tone { syntax: "<color>"; inherits: true; initial-value: red; }
      .native-parent { --tone: blue; }
      .native-parent[data-active="yes"] { --tone: green; }
      .native-parent .native-child { color: var(--tone); }
      .native-alone { color: var(--tone); }
      .native-other { --tone: purple; color: var(--tone); }
    `,
    scopeSchemas: {
      'Inheritance.gss': { moduleId: 'Inheritance.gss', exports: {
        parent: { selfClassName: 'native-parent', targets: {
          child: { selfClassName: 'native-child', targets: {} }
        } },
        alone: { selfClassName: 'native-alone', targets: {} }
      } },
      'Other.gss': { moduleId: 'Other.gss', exports: {
        other: { selfClassName: 'native-other', targets: {} }
      } }
    }
  },
  nodes: [
    { id: 'inherit-parent', moduleId: 'Inheritance.gss', path: ['parent'], expected: {
      color: 'rgb(0, 0, 0)', '--tone': 'rgb(0, 0, 255)'
    } },
    { id: 'inherit-child', moduleId: 'Inheritance.gss', path: ['parent', 'child'], parent: 'inherit-parent',
      expected: { color: 'rgb(0, 0, 255)', '--tone': 'rgb(0, 0, 255)' } },
    { id: 'inherit-alone', moduleId: 'Inheritance.gss', path: ['alone'], expected: { color: 'rgb(255, 0, 0)' } },
    { id: 'inherit-other', moduleId: 'Other.gss', path: ['other'], expected: { color: 'rgb(128, 0, 128)' } }
  ],
  phases: [
    { name: 'activated', changes: [{ node: 'inherit-parent', attributes: { 'data-active': 'yes' } }], expected: {
      'inherit-parent': { color: 'rgb(0, 0, 0)', '--tone': 'rgb(0, 128, 0)' },
      'inherit-child': { color: 'rgb(0, 128, 0)', '--tone': 'rgb(0, 128, 0)' },
      'inherit-alone': { color: 'rgb(255, 0, 0)' }, 'inherit-other': { color: 'rgb(128, 0, 128)' }
    } },
    { name: 'restored', changes: [{ node: 'inherit-parent', attributes: { 'data-active': null } }], expected: {
      'inherit-parent': { color: 'rgb(0, 0, 0)', '--tone': 'rgb(0, 0, 255)' },
      'inherit-child': { color: 'rgb(0, 0, 255)', '--tone': 'rgb(0, 0, 255)' },
      'inherit-alone': { color: 'rgb(255, 0, 0)' }, 'inherit-other': { color: 'rgb(128, 0, 128)' }
    } }
  ]
}];
