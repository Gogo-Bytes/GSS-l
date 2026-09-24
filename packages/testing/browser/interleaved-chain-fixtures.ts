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

const deepScopeSchemas: Readonly<Record<string, ScopeSchema>> = {
  'InterleavedDeep.gss': { moduleId: 'InterleavedDeep.gss', exports: {
    input: { selfClassName: 'input', targets: {
      label: { selfClassName: 'label', targets: {
        icon: { selfClassName: 'icon', targets: { badge: { selfClassName: 'badge', targets: {} } } }
      } }
    } }
  } }
};
const deepDeclarations = [
  '.input + .label .icon .badge { color: red; }',
  '.input + .label .icon .badge { background-color: blue; }'
] as const;

const prefixScopeSchemas: Readonly<Record<string, ScopeSchema>> = {
  'InterleavedPrefix.gss': { moduleId: 'InterleavedPrefix.gss', exports: {
    root: { selfClassName: 'root', targets: {
      input: { selfClassName: 'input', targets: {
        label: { selfClassName: 'label', targets: { icon: { selfClassName: 'icon', targets: {} } } }
      } }
    } }
  } }
};
const prefixDeclarations = [
  '.root .input + .label .icon { color: red; }',
  '.root .input + .label .icon { background-color: blue; }'
] as const;

const generalPrefixScopeSchemas: Readonly<Record<string, ScopeSchema>> = {
  'InterleavedGeneralPrefix.gss': { moduleId: 'InterleavedGeneralPrefix.gss', exports: {
    root: { selfClassName: 'root', targets: {
      input: { selfClassName: 'input', targets: {
        label: { selfClassName: 'label', targets: { icon: { selfClassName: 'icon', targets: {} } } }
      } }
    } }
  } }
};
const generalPrefixDeclarations = [
  '.root .input ~ .label .icon { color: red; }',
  '.root .input ~ .label .icon { background-color: blue; }'
] as const;

type InterleavedFixture = ReferenceFixture & {
  reference: { css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>> };
};

export const interleavedChainFixtures: readonly InterleavedFixture[] = [
  ...[false, true].map((reverse): InterleavedFixture => {
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
  }),
  ...[false, true].map((reverse): InterleavedFixture => {
    const sourceRules = reverse ? [...deepDeclarations].reverse() : [...deepDeclarations];
    return {
      name: `interleaved-owned-descendant-deep-${reverse ? 'reversed' : 'forward'}`,
      modules: [{ id: 'InterleavedDeep.gss', source: sourceRules.join('\n') }],
      setupCss: 'div { color: black; }',
      reference: {
        css: '.input + .label .icon .badge { color: red; } .input + .label .icon .badge { background-color: blue; }',
        scopeSchemas: deepScopeSchemas
      },
      nodes: [
        { id: 'source', tag: 'input', moduleId: 'InterleavedDeep.gss', path: ['input'], expected: {} },
        { id: 'label', moduleId: 'InterleavedDeep.gss', path: ['input', 'label'], expected: {} },
        { id: 'icon', parent: 'label', moduleId: 'InterleavedDeep.gss', path: ['input', 'label', 'icon'], expected: {} },
        { id: 'badge', parent: 'icon', moduleId: 'InterleavedDeep.gss', path: ['input', 'label', 'icon', 'badge'], expected: {
          color: 'rgb(255, 0, 0)', 'background-color': 'rgb(0, 0, 255)'
        } }
      ]
    };
  }),
  ...[false, true].map((reverse): InterleavedFixture => {
    const sourceRules = reverse ? [...prefixDeclarations].reverse() : [...prefixDeclarations];
    return {
      name: `interleaved-owned-descendant-prefix-${reverse ? 'reversed' : 'forward'}`,
      modules: [{ id: 'InterleavedPrefix.gss', source: sourceRules.join('\n') }],
      setupCss: 'div { color: black; }',
      reference: {
        css: '.root .input + .label .icon { color: red; } .root .input + .label .icon { background-color: blue; }',
        scopeSchemas: prefixScopeSchemas
      },
      nodes: [
        { id: 'root', moduleId: 'InterleavedPrefix.gss', path: ['root'], expected: {} },
        { id: 'source', parent: 'root', tag: 'input', moduleId: 'InterleavedPrefix.gss', path: ['root', 'input'], expected: {} },
        { id: 'label', parent: 'root', moduleId: 'InterleavedPrefix.gss', path: ['root', 'input', 'label'], expected: {} },
        { id: 'icon', parent: 'label', moduleId: 'InterleavedPrefix.gss', path: ['root', 'input', 'label', 'icon'], expected: {
          color: 'rgb(255, 0, 0)', 'background-color': 'rgb(0, 0, 255)'
        } }
      ]
    };
  }),
  ...[false, true].map((reverse): InterleavedFixture => {
    const sourceRules = reverse ? [...generalPrefixDeclarations].reverse() : [...generalPrefixDeclarations];
    return {
      name: `interleaved-owned-descendant-general-prefix-${reverse ? 'reversed' : 'forward'}`,
      modules: [{ id: 'InterleavedGeneralPrefix.gss', source: sourceRules.join('\n') }],
      setupCss: 'div { color: black; }',
      reference: {
        css: '.root .input ~ .label .icon { color: red; } .root .input ~ .label .icon { background-color: blue; }',
        scopeSchemas: generalPrefixScopeSchemas
      },
      nodes: [
        { id: 'root', moduleId: 'InterleavedGeneralPrefix.gss', path: ['root'], expected: {} },
        { id: 'source', parent: 'root', tag: 'input', moduleId: 'InterleavedGeneralPrefix.gss', path: ['root', 'input'], expected: {} },
        { id: 'label', parent: 'root', moduleId: 'InterleavedGeneralPrefix.gss', path: ['root', 'input', 'label'], expected: {} },
        { id: 'icon', parent: 'label', moduleId: 'InterleavedGeneralPrefix.gss', path: ['root', 'input', 'label', 'icon'], expected: {
          color: 'rgb(255, 0, 0)', 'background-color': 'rgb(0, 0, 255)'
        } }
      ]
    };
  })
];
