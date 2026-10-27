import type { ScopeSchema } from '@gss-l/compiler';
import type { ReferenceFixture } from './fixtures.js';

// Hand-authored native CSS expectations for the CSS font shorthand reset. These do not
// use compileGssReference and deliberately encode the source-order computed outcomes.
type FontResetFixture = ReferenceFixture & {
  reference: { css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>> };
};
const scopeSchemas: Readonly<Record<string, ScopeSchema>> = {
  'FontReset.gss': { moduleId: 'FontReset.gss', exports: { text: { selfClassName: 'text', targets: {} } } }
};

export const fontResetFixtures: readonly FontResetFixture[] = [
  {
    name: 'font-shorthand-resets-font-variant',
    modules: [{ id: 'FontReset.gss', source: '.text { font-variant: small-caps; font: 16px serif; }' }],
    reference: { css: '.text { font-variant: small-caps; font: 16px serif; }', scopeSchemas },
    nodes: [{ id: 'font-reset', moduleId: 'FontReset.gss', path: ['text'], expected: { 'font-variant-caps': 'normal' } }]
  },
  {
    name: 'font-variant-after-font-shorthand',
    modules: [{ id: 'FontReset.gss', source: '.text { font: 16px serif; font-variant: small-caps; }' }],
    reference: { css: '.text { font: 16px serif; font-variant: small-caps; }', scopeSchemas },
    nodes: [{ id: 'font-reset', moduleId: 'FontReset.gss', path: ['text'], expected: { 'font-variant-caps': 'small-caps' } }]
  },
  {
    name: 'important-font-variant-survives-font-shorthand',
    modules: [{ id: 'FontReset.gss', source: '.text { font-variant: small-caps !important; font: 16px serif; }' }],
    reference: { css: '.text { font-variant: small-caps !important; font: 16px serif; }', scopeSchemas },
    nodes: [{ id: 'font-reset', moduleId: 'FontReset.gss', path: ['text'], expected: { 'font-variant-caps': 'small-caps' } }]
  }
];
