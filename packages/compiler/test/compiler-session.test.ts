import { describe, expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

const colorRedClass =
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_red--importance_normal';
const colorBlueClass =
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_blue--importance_normal';
const colorGreenClass =
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_green--importance_normal';
const hoverColorRedClass =
  'gss-a--layer_unlayered--condition_base--state_hover--property_color--value_red--importance_normal';
const displayBlockClass =
  'gss-a--layer_unlayered--condition_base--state_self--property_display--value_block--importance_normal';
const displayInlineBlockClass =
  'gss-a--layer_unlayered--condition_base--state_self--property_display--value_inline_2d_block--importance_normal';
const fontSize16Class =
  'gss-a--layer_unlayered--condition_base--state_self--property_font_2d_size--value_16px--importance_normal';

describe('GssCompilerSession', () => {
  it('replaces one stylesheet and finalizes one readable pure atom', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/button.gss',
      source: '.button { color: red; }'
    });

    expect(replacement).toMatchObject({
      id: '/project/src/button.gss',
      committed: true,
      generation: 1,
      diagnostics: [],
      module: {
        scopeSchema: {
          moduleId: 'src/button.gss',
          exports: {
            button: {
              selfClassName: colorRedClass,
              targets: {}
            }
          }
        },
        moduleCode: `const button = { self: "${colorRedClass}" };\nexport default { button };\n`
      }
    });

    expect(compiler.finalize()).toMatchObject({
      generation: 1,
      css: `.${colorRedClass} {\n  color: red;\n}`
    });
  });

  it('keeps the last good contribution, replaces it, and invalidates it by Module id', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });
    const id = '/project/src/button.gss';

    expect(compiler.replaceStylesheet({ id, source: '.button { color: red; }' }).generation).toBe(1);
    expect(compiler.replaceStylesheet({
      id,
      source: '.button { color: red; color: blue; }'
    })).toMatchObject({ committed: false, generation: 1 });
    expect(compiler.finalize().css).toContain(`.${colorRedClass}`);

    expect(compiler.replaceStylesheet({ id, source: '.button { color: blue; }' })).toMatchObject({
      committed: true,
      generation: 2
    });
    expect(compiler.finalize().css).toBe(`.${colorBlueClass} {\n  color: blue;\n}`);

    expect(compiler.invalidate(id)).toEqual({ id, changed: true, generation: 3 });
    expect(compiler.finalize()).toMatchObject({
      generation: 3,
      css: '',
      report: { modules: 0, rules: 0 }
    });
  });

  it('returns a structured diagnostic for malformed selector syntax', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/broken.gss',
      source: '.button:is( { color: red; }'
    });

    expect(replacement).toMatchObject({
      committed: false,
      generation: 0,
      diagnostics: [{
        code: 'GSS1001',
        severity: 'error',
        phase: 'parse'
      }]
    });
  });

  it('rejects an authored duplicate exact-property sequence transactionally', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/button.gss',
      source: '.button { color: red; color: blue; }'
    });

    expect(replacement).toMatchObject({
      committed: false,
      generation: 0,
      diagnostics: [{
        code: 'GSS1204',
        severity: 'error',
        phase: 'resolve',
        reason: 'duplicate-exact-property'
      }]
    });
    expect(compiler.finalize()).toMatchObject({
      generation: 0,
      css: '',
      report: { modules: 0, rules: 0 }
    });
  });

  it('reuses one semantic atom across Modules and retains every source', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    compiler.replaceStylesheet({
      id: '/project/src/a.gss',
      source: '.a { color: red; }'
    });
    compiler.replaceStylesheet({
      id: '/project/src/b.gss',
      source: '.b { color: red; }'
    });

    expect(compiler.finalize()).toMatchObject({
      generation: 2,
      report: { modules: 2, rules: 1 },
      manifest: {
        modules: ['/project/src/a.gss', '/project/src/b.gss'],
        rules: [{
          className: colorRedClass,
          property: 'color',
          value: 'red',
          important: false,
          sources: ['src/a.gss', 'src/b.gss']
        }]
      }
    });
  });

  it.each([
    [':not([aria-disabled="true"])', ':not([aria-disabled="true"])'],
    [
      ':is([data-size="small"], :hover)',
      ':is(:hover,[data-size="small"])'
    ]
  ])('plans the functional attribute condition %s', (authoredCondition, normalizedCondition) => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/control.gss',
      source: `.control${authoredCondition} { color: red; }`
    });

    expect(replacement.diagnostics).toEqual([]);
    const className = replacement.module?.scopeSchema.exports.control?.selfClassName;
    expect(compiler.finalize().css).toBe(
      `.${className}${normalizedCondition} {\n  color: red;\n}`
    );
  });

  it('rejects conflicting @font-face definitions for one selection signature', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    compiler.replaceStylesheet({
      id: '/project/src/a.gss',
      source: `@font-face {
        font-family: "Inter";
        src: url("./a.woff2");
        font-weight: 400;
      }`
    });
    const replacement = compiler.replaceStylesheet({
      id: '/project/src/b.gss',
      source: `@font-face {
        font-family: "Inter";
        src: url("./b.woff2");
        font-weight: 400;
      }`
    });

    expect(replacement).toMatchObject({
      committed: false,
      generation: 1,
      diagnostics: [{
        code: 'GSS1301',
        reason: 'conflicting-global-resource'
      }]
    });
    expect(compiler.finalize().css).toContain('./a.woff2');
    expect(compiler.finalize().css).not.toContain('./b.woff2');
  });

  it('emits @font-face intact and reports its URL dependencies', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/typography.gss',
      source: `
        @font-face {
          font-family: "Inter";
          src: url("./inter.woff2") format("woff2"), url('./inter.woff') format('woff');
          font-style: normal;
          font-weight: 400;
        }
        .text { font-family: "Inter"; }
      `
    });

    expect(replacement).toMatchObject({
      committed: true,
      diagnostics: [],
      module: {
        dependencies: ['./inter.woff2', './inter.woff']
      }
    });
    expect(compiler.finalize().css).toContain(
      `@font-face {\n` +
      `  font-family: "Inter";\n` +
      `  src: url("./inter.woff2") format("woff2"), url('./inter.woff') format('woff');\n` +
      `  font-style: normal;\n` +
      `  font-weight: 400;\n}`
    );
  });

  it('rewrites static local names in animation shorthand without touching var()', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/motion.gss',
      source: `
        @keyframes fade { to { opacity: 1; } }
        @keyframes spin { to { transform: rotate(1turn); } }
        .motion {
          animation: 1s ease fade, 2s linear spin, 3s external, var(--animation);
        }
      `
    });

    const fade = 'gss-k--module_src_2f_motion_2e_gss--name_fade';
    const spin = 'gss-k--module_src_2f_motion_2e_gss--name_spin';
    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    expect(compiler.finalize().css).toContain(
      `animation: 1s ease ${fade}, 2s linear ${spin}, 3s external, var(--animation);`
    );
  });

  it('renames module-local keyframes and rewrites a static animation-name reference', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/spinner.gss',
      source: `
        @keyframes fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .spinner { animation-name: fade; }
      `
    });

    const generatedName = 'gss-k--module_src_2f_spinner_2e_gss--name_fade';
    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    const className = replacement.module?.scopeSchema.exports.spinner?.selfClassName;
    expect(className).toContain('--property_animation_2d_name--value_gss_2d_k');
    expect(compiler.finalize().css).toBe(
      `@keyframes ${generatedName} {\n` +
      `  from {\n    opacity: 0;\n  }\n` +
      `  to {\n    opacity: 1;\n  }\n` +
      `}\n\n.${className} {\n  animation-name: ${generatedName};\n}`
    );
  });

  it('rejects conflicting global @property registrations transactionally', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    compiler.replaceStylesheet({
      id: '/project/src/a.gss',
      source: '@property --brand { syntax: "<color>"; inherits: true; initial-value: red; }'
    });
    const replacement = compiler.replaceStylesheet({
      id: '/project/src/b.gss',
      source: '@property --brand { syntax: "<length>"; inherits: false; initial-value: 0px; }'
    });

    expect(replacement).toMatchObject({
      committed: false,
      generation: 1,
      diagnostics: [{
        code: 'GSS1301',
        phase: 'registry',
        reason: 'conflicting-global-resource'
      }]
    });
    expect(compiler.finalize()).toMatchObject({ report: { modules: 1 } });
    expect(compiler.finalize().css).toContain('syntax: "<color>";');
    expect(compiler.finalize().css).not.toContain('syntax: "<length>";');
  });

  it('emits an @property registration as an indivisible global resource', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/theme.gss',
      source: `
        @property --brand {
          syntax: "<color>";
          inherits: true;
          initial-value: red;
        }
        .theme { --brand: blue; }
      `
    });

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    const className = replacement.module?.scopeSchema.exports.theme?.selfClassName;
    expect(compiler.finalize().css).toBe(
      `@property --brand {\n  syntax: "<color>";\n  inherits: true;\n  initial-value: red;\n}\n\n` +
      `.${className} {\n  --brand: blue;\n}`
    );
  });

  it('rejects logical and physical conflicts introduced by target accumulation', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/family.gss',
      source: `
        .son { margin-inline-start: 1rem; }
        .father .son { margin-left: 2rem; }
      `
    });

    expect(replacement).toMatchObject({
      committed: false,
      diagnostics: [{
        code: 'GSS1206',
        reason: 'logical-physical-property-conflict'
      }]
    });
  });

  it('rejects direction-dependent logical and physical property conflicts', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/box.gss',
      source: '.box { margin-inline-start: 1rem; margin-left: 2rem; }'
    });

    expect(replacement).toMatchObject({
      committed: false,
      generation: 0,
      diagnostics: [{
        code: 'GSS1206',
        severity: 'error',
        phase: 'resolve',
        reason: 'logical-physical-property-conflict'
      }]
    });
    expect(compiler.finalize()).toMatchObject({
      css: '',
      report: { modules: 0, rules: 0 }
    });
  });

  it('replaces and invalidates preserved module contributions without stale CSS', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });
    const id = '/project/src/replaced-fallback.gss';

    compiler.replaceStylesheet({ id, source: '.card { all: unset; }' });
    expect(compiler.finalize()).toMatchObject({
      report: { atomicModules: 0, preservedModules: 1 }
    });

    compiler.replaceStylesheet({ id, source: '.card { color: red; }' });
    expect(compiler.finalize()).toMatchObject({
      report: { atomicModules: 1, preservedModules: 0 }
    });
    expect(compiler.finalize().css).not.toContain('gss-s--');

    compiler.invalidate(id);
    expect(compiler.finalize()).toMatchObject({
      css: '',
      report: { modules: 0, atomicModules: 0, preservedModules: 0 }
    });
  });

  it('can reject an unregistered property effect in strict mode', () => {
    const compiler = createGssCompilerSession({
      projectRoot: '/project',
      atomizationFallback: 'error'
    });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/strict.gss',
      source: '.card { all: unset; }'
    });

    expect(replacement).toMatchObject({
      committed: false,
      generation: 0,
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        reason: 'capability-not-registered'
      }]
    });
  });

  it('preserves observed local class markers in a fallback selector', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/observed-fallback.gss',
      source: '.card:has(> .error) { all: unset; }'
    });

    expect(replacement.module?.scopeSchema.exports).toMatchObject({
      card: { selfClassName: expect.stringContaining('--path_card') },
      error: { selfClassName: expect.stringContaining('--path_error') }
    });
    expect(compiler.finalize().css).toContain(
      '.gss-s--module_src_2f_observed_2d_fallback_2e_gss--path_card' +
      ':has(> .gss-s--module_src_2f_observed_2d_fallback_2e_gss--path_error)'
    );
  });

  it('preserves descendant scope paths without changing the GSS export contract', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/nested-fallback.gss',
      source: '.father .son { all: unset; }'
    });

    const father = replacement.module?.scopeSchema.exports.father;
    expect(father?.selfClassName).toBe(
      'gss-s--module_src_2f_nested_2d_fallback_2e_gss--path_father'
    );
    expect(father?.targets.son?.selfClassName).toBe(
      'gss-s--module_src_2f_nested_2d_fallback_2e_gss--path_father_2e_son'
    );
    expect(compiler.finalize().css).toContain(
      '.gss-s--module_src_2f_nested_2d_fallback_2e_gss--path_father ' +
      '.gss-s--module_src_2f_nested_2d_fallback_2e_gss--path_father_2e_son'
    );
  });

  it('falls back the whole module when a property effect is not registered', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/fallback.gss',
      source: '.card { color: red; all: unset; opacity: 0.5; }'
    });

    expect(replacement).toMatchObject({
      committed: true,
      module: {
        compilationMode: 'preserved',
        fallbackReasons: [{ property: 'all', reason: 'property-effect-not-registered' }]
      },
      diagnostics: [{
        code: 'GSS1104',
        severity: 'warning',
        reason: 'module-preserved-fallback'
      }]
    });
    expect(compiler.finalize()).toMatchObject({
      report: {
        modules: 1,
        atomicModules: 0,
        preservedModules: 1,
        atomicCoverage: 0
      },
      manifest: {
        moduleDetails: [{ id: 'src/fallback.gss', compilationMode: 'preserved' }]
      }
    });
    expect(compiler.finalize().css).toBe(
      '.gss-s--module_src_2f_fallback_2e_gss--path_card {\n' +
      '  color: red;\n' +
      '  all: unset;\n' +
      '  opacity: 0.5;\n' +
      '}'
    );
  });

  it('resolves border family shorthand and longhand effects', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    compiler.replaceStylesheet({
      id: '/project/src/border.gss',
      source: '.box { border-top-color: red; border: 1px solid blue; }'
    });

    expect(compiler.finalize()).toMatchObject({ report: { modules: 1, rules: 1 } });
    expect(compiler.finalize().css).toContain('border: 1px solid blue;');
    expect(compiler.finalize().css).not.toContain('border-top-color: red;');
  });

  it('removes a longhand fully shadowed by a later shorthand', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/box.gss',
      source: '.box { margin-left: 10px; margin: 0; }'
    });

    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports.box?.selfClassName).not.toContain(
      '--property_margin_2d_left--'
    );
    expect(compiler.finalize()).toMatchObject({ report: { modules: 1, rules: 1 } });
    expect(compiler.finalize().css).toContain('margin: 0;');
  });

  it('orders a surviving shorthand before its later longhand override', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    compiler.replaceStylesheet({
      id: '/project/src/box.gss',
      source: '.box { margin: 0; margin-left: 10px; }'
    });

    const css = compiler.finalize().css;
    expect(compiler.finalize()).toMatchObject({ report: { modules: 1, rules: 2 } });
    expect(css.indexOf('margin: 0;')).toBeLessThan(css.indexOf('margin-left: 10px;'));
  });

  it('orders coactive condition rules by registered project order', () => {
    const compiler = createGssCompilerSession({
      projectRoot: '/project',
      conditions: {
        media: ['(min-width: 80rem)', '(min-width: 40rem)']
      }
    });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/layout.gss',
      source: `
        @media (min-width: 40rem) { .layout { color: blue; } }
        @media (min-width: 80rem) { .layout { color: red; } }
      `
    });

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    const css = compiler.finalize().css;
    expect(css.indexOf('@media (min-width: 80rem)')).toBeLessThan(
      css.indexOf('@media (min-width: 40rem)')
    );
  });

  it('preserves a configured layer around a structural contextual atom', () => {
    const compiler = createGssCompilerSession({
      projectRoot: '/project',
      layers: ['components']
    });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/family.gss',
      source: '@layer components { .father > .son { color: red; } }'
    });

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    const fatherClass = replacement.module?.scopeSchema.exports.father?.selfClassName;
    const sonClass = replacement.module?.scopeSchema.exports.father?.targets.son?.selfClassName;
    expect(fatherClass).toContain('--layer_components--');
    expect(sonClass).toContain('--layer_components--');
    expect(compiler.finalize().css).toBe(
      `@layer components;\n\n@layer components {\n  .${fatherClass} > .${sonClass} {\n    color: red;\n  }\n}`
    );
  });

  it('warns without rejecting an unregistered named layer', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/button.gss',
      source: '@layer components { .button { color: red; } }'
    });

    expect(replacement).toMatchObject({
      committed: true,
      diagnostics: [{
        code: 'GSS1103',
        severity: 'warning',
        reason: 'layer-not-registered'
      }]
    });
    expect(compiler.finalize().css).toContain('@layer components {');
  });

  it('plans a configured named cascade layer and emits its order prelude', () => {
    const compiler = createGssCompilerSession({
      projectRoot: '/project',
      layers: ['reset', 'components']
    });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/button.gss',
      source: '@layer components { .button { color: red; } }'
    });

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    const className = replacement.module?.scopeSchema.exports.button?.selfClassName;
    expect(className).toContain('--layer_components--condition_base--');
    expect(compiler.finalize().css).toBe(
      `@layer reset, components;\n\n@layer components {\n  .${className} {\n    color: red;\n  }\n}`
    );
  });

  it('preserves a registered condition around an ancestor-state atom', () => {
    const compiler = createGssCompilerSession({
      projectRoot: '/project',
      conditions: { media: ['(hover: hover)'] }
    });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/family.gss',
      source: '@media (hover: hover) { .father:hover .son { color: red; } }'
    });

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    const fatherClass = replacement.module?.scopeSchema.exports.father?.selfClassName;
    const sonClass = replacement.module?.scopeSchema.exports.father?.targets.son?.selfClassName;
    expect(fatherClass).toContain('--condition_media_3a__28_hover');
    expect(sonClass).toContain('--condition_media_3a__28_hover');
    expect(compiler.finalize().css).toBe(
      `@media (hover: hover) {\n  .${fatherClass}:hover .${sonClass} {\n    color: red;\n  }\n}`
    );
  });

  it('preserves a registered condition around an observed contextual atom', () => {
    const compiler = createGssCompilerSession({
      projectRoot: '/project',
      conditions: { supports: ['selector(:has(*))'] }
    });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/card.gss',
      source: '@supports selector(:has(*)) { .card:has(.error) { color: red; } }'
    });

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    const cardClass = replacement.module?.scopeSchema.exports.card?.selfClassName;
    const errorClass = replacement.module?.scopeSchema.exports.error?.selfClassName;
    expect(cardClass).toContain('--condition_supports_3a_selector');
    expect(errorClass).toContain('--condition_supports_3a_selector');
    expect(compiler.finalize().css).toBe(
      `@supports selector(:has(*)) {\n  .${cardClass}:has(.${errorClass}) {\n    color: red;\n  }\n}`
    );
  });

  it('preserves a registered condition around a structural contextual atom', () => {
    const compiler = createGssCompilerSession({
      projectRoot: '/project',
      conditions: { media: ['(min-width: 40rem)'] }
    });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/family.gss',
      source: '@media (min-width: 40rem) { .father > .son { color: red; } }'
    });

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    const fatherClass = replacement.module?.scopeSchema.exports.father?.selfClassName;
    const sonClass = replacement.module?.scopeSchema.exports.father?.targets.son?.selfClassName;
    expect(fatherClass).toContain('--condition_media_3a__28_min_2d_width');
    expect(sonClass).toContain('--condition_media_3a__28_min_2d_width');
    expect(compiler.finalize().css).toBe(
      `@media (min-width: 40rem) {\n  .${fatherClass} > .${sonClass} {\n    color: red;\n  }\n}`
    );
  });

  it('preserves a registered condition around an attribute atom', () => {
    const compiler = createGssCompilerSession({
      projectRoot: '/project',
      conditions: { supports: ['selector(:has(*))'] }
    });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/tab.gss',
      source: `
        @supports selector(:has(*)) {
          .tab[aria-selected="true"] { color: red; }
        }
      `
    });

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    const className = replacement.module?.scopeSchema.exports.tab?.selfClassName;
    expect(className).toContain('--condition_supports_3a_selector_28__3a_has_28__2a__29__29_--');
    expect(compiler.finalize().css).toContain(
      `.${className}[aria-selected="true"] {\n    color: red;\n  }`
    );
  });

  it('preserves a registered condition around a pseudo-element atom', () => {
    const compiler = createGssCompilerSession({
      projectRoot: '/project',
      conditions: { media: ['print'] }
    });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/article.gss',
      source: '@media print { .article::first-letter { color: red; } }'
    });

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    const className = replacement.module?.scopeSchema.exports.article?.selfClassName;
    expect(className).toContain('--condition_media_3a_print--state_self--pseudo_first_2d_letter--');
    expect(compiler.finalize().css).toBe(
      `@media print {\n  .${className}::first-letter {\n    color: red;\n  }\n}`
    );
  });

  it('preserves a registered condition around a state atom', () => {
    const compiler = createGssCompilerSession({
      projectRoot: '/project',
      conditions: { media: ['(hover: hover)'] }
    });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/button.gss',
      source: '@media (hover: hover) { .button:hover { color: red; } }'
    });

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    const className = replacement.module?.scopeSchema.exports.button?.selfClassName;
    expect(className).toContain('--condition_media_3a__28_hover_3a__20_hover_29_--state_hover--');
    expect(compiler.finalize().css).toBe(
      `@media (hover: hover) {\n  .${className}:hover {\n    color: red;\n  }\n}`
    );
  });

  it.each([
    ['supports', '(display: grid)'],
    ['container', 'sidebar (min-width: 30rem)']
  ])('plans a registered @%s condition', (kind, query) => {
    const compiler = createGssCompilerSession({
      projectRoot: '/project',
      conditions: { [kind]: [query] }
    });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/layout.gss',
      source: `@${kind} ${query} { .layout { display: block; } }`
    });

    expect(replacement.diagnostics).toEqual([]);
    const className = replacement.module?.scopeSchema.exports.layout?.selfClassName;
    expect(compiler.finalize().css).toBe(
      `@${kind} ${query} {\n  .${className} {\n    display: block;\n  }\n}`
    );
  });

  it('warns without rejecting an unregistered @media condition', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/layout.gss',
      source: '@media (orientation: landscape) { .layout { display: block; } }'
    });

    expect(replacement).toMatchObject({
      committed: true,
      generation: 1,
      diagnostics: [{
        code: 'GSS1102',
        severity: 'warning',
        phase: 'validate',
        reason: 'condition-not-registered'
      }]
    });
    expect(compiler.finalize().css).toContain('@media (orientation: landscape)');
  });

  it('plans a registered @media condition around a pure atom', () => {
    const compiler = createGssCompilerSession({
      projectRoot: '/project',
      conditions: { media: ['(min-width: 40rem)'] }
    });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/layout.gss',
      source: '@media (min-width: 40rem) { .layout { display: block; } }'
    });

    expect(replacement.diagnostics).toEqual([]);
    const className = replacement.module?.scopeSchema.exports.layout?.selfClassName;
    expect(className).toContain('--condition_media_3a__28_min_2d_width_3a__20_40rem_29_--');
    expect(compiler.finalize().css).toBe(
      `@media (min-width: 40rem) {\n  .${className} {\n    display: block;\n  }\n}`
    );
  });

  it.each([
    ['[aria-invalid="true"]', '[aria-invalid="true"]'],
    ['> img', '> img'],
    [':focus', ':focus']
  ])('plans the residual :has(%s) observation without a local export', (
    authoredObservation,
    normalizedObservation
  ) => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/card.gss',
      source: `.card:has(${authoredObservation}) { color: red; }`
    });

    expect(replacement.diagnostics).toEqual([]);
    expect(Object.keys(replacement.module?.scopeSchema.exports ?? {})).toEqual(['card']);
    const cardClass = replacement.module?.scopeSchema.exports.card?.selfClassName;
    expect(cardClass).toContain('--residual_');
    expect(compiler.finalize().css).toBe(
      `.${cardClass}:has(${normalizedObservation}) {\n  color: red;\n}`
    );
  });

  it('composes a current-element state with a pseudo-element', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/control.gss',
      source: '.control:hover::before { color: red; }'
    });

    expect(replacement.diagnostics).toEqual([]);
    const className = replacement.module?.scopeSchema.exports.control?.selfClassName;
    expect(className).toContain('--state_hover--pseudo_before--');
    expect(compiler.finalize().css).toBe(
      `.${className}:hover::before {\n  color: red;\n}`
    );
  });

  it.each([
    'before',
    'after',
    'placeholder',
    'marker',
    'file-selector-button',
    'backdrop',
    'first-line',
    'first-letter',
    'selection'
  ])('plans the supported ::%s pseudo-element', (pseudoElement) => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/control.gss',
      source: `.control::${pseudoElement} { color: red; }`
    });

    expect(replacement.diagnostics).toEqual([]);
    const className = replacement.module?.scopeSchema.exports.control?.selfClassName;
    expect(className).toContain(
      `--pseudo_${pseudoElement.replaceAll('-', '_2d_')}--property_color--`
    );
    expect(compiler.finalize().css).toBe(
      `.${className}::${pseudoElement} {\n  color: red;\n}`
    );
  });

  it('preserves a pseudo state on an observed local class', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/card.gss',
      source: '.card:has(.error:hover) { color: red; }'
    });

    expect(replacement.diagnostics).toEqual([]);
    const cardClass = replacement.module?.scopeSchema.exports.card?.selfClassName;
    const errorClass = replacement.module?.scopeSchema.exports.error?.selfClassName;
    expect(cardClass).toContain('--state_hover--');
    expect(compiler.finalize().css).toBe(
      `.${cardClass}:has(.${errorClass}:hover) {\n  color: red;\n}`
    );
  });

  it('expands a :has() selector list into independent observed branches', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/card.gss',
      source: '.card:has(.error, > .warning) { color: red; }'
    });

    expect(replacement.diagnostics).toEqual([]);
    const exports = replacement.module?.scopeSchema.exports;
    const subjectMarkers = exports?.card?.selfClassName.split(' ') ?? [];
    const errorSubject = subjectMarkers.find((marker) => marker.endsWith('--observed_error'));
    const warningSubject = subjectMarkers.find((marker) => marker.endsWith('--observed_warning'));
    const errorObserved = exports?.error?.selfClassName;
    const warningObserved = exports?.warning?.selfClassName;
    expect(subjectMarkers).toHaveLength(2);
    expect(compiler.finalize()).toMatchObject({ report: { modules: 1, rules: 2 } });
    expect(compiler.finalize().css).toContain(
      `.${errorSubject}:has(.${errorObserved}) {\n  color: red;\n}`
    );
    expect(compiler.finalize().css).toContain(
      `.${warningSubject}:has(> .${warningObserved}) {\n  color: red;\n}`
    );
  });

  it.each([
    ['>', 'child'],
    ['+', 'adjacent'],
    ['~', 'general_2d_sibling']
  ])('plans the :has(%s .error) observed relation', (combinator, encodedRelation) => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/card.gss',
      source: `.card:has(${combinator} .error) { color: red; }`
    });

    expect(replacement.diagnostics).toEqual([]);
    const cardClass = replacement.module?.scopeSchema.exports.card?.selfClassName;
    const errorClass = replacement.module?.scopeSchema.exports.error?.selfClassName;
    expect(cardClass).toContain(`--relation_${encodedRelation}--`);
    expect(compiler.finalize().css).toBe(
      `.${cardClass}:has(${combinator} .${errorClass}) {\n  color: red;\n}`
    );
  });

  it('plans :has() as a subject-observed contextual relation', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/card.gss',
      source: '.card:has(.error) { color: red; }'
    });

    const subjectMarker =
      'gss-hs--module_src_2f_card_2e_gss--subject_card--relation_descendant--observed_error';
    const observedMarker =
      'gss-ho--module_src_2f_card_2e_gss--subject_card--relation_descendant--observed_error';
    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports).toEqual({
      card: { selfClassName: subjectMarker, targets: {} },
      error: { selfClassName: observedMarker, targets: {} }
    });
    expect(compiler.finalize().css).toBe(
      `.${subjectMarker}:has(.${observedMarker}) {\n  color: red;\n}`
    );
  });

  it('uses zero specificity for :where() during ambiguity analysis', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/control.gss',
      source: `
        .control:where(:hover) { color: red; }
        .control:focus { color: blue; }
      `
    });

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    expect(compiler.finalize().report.rules).toBe(2);
  });

  it('accepts mutually exclusive positive and negative state conditions', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/control.gss',
      source: `
        .control:disabled { color: red; }
        .control:not(:disabled) { color: blue; }
      `
    });

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    expect(compiler.finalize().report.rules).toBe(2);
  });

  it.each([
    [':not(:disabled)', ':not(:disabled)'],
    [':is(:hover, :focus-visible)', ':is(:focus-visible,:hover)'],
    [':where(:hover, :active)', ':where(:active,:hover)']
  ])('plans the supported functional condition %s', (authoredCondition, normalizedCondition) => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/control.gss',
      source: `.control${authoredCondition} { color: red; }`
    });

    expect(replacement.diagnostics).toEqual([]);
    const className = replacement.module?.scopeSchema.exports.control?.selfClassName;
    expect(className).toContain('--property_color--value_red--');
    expect(compiler.finalize().css).toBe(
      `.${className}${normalizedCondition} {\n  color: red;\n}`
    );
  });

  it('canonicalizes equivalent state intersections for global atom reuse', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    compiler.replaceStylesheet({
      id: '/project/src/a.gss',
      source: '.button:hover:focus { color: red; }'
    });
    compiler.replaceStylesheet({
      id: '/project/src/b.gss',
      source: '.button:focus:hover { color: red; }'
    });

    expect(compiler.finalize()).toMatchObject({
      report: { modules: 2, rules: 1 },
      manifest: {
        rules: [{ sources: ['src/a.gss', 'src/b.gss'] }]
      }
    });
  });

  it('accepts coactive state conflicts with an explicit intersection winner', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/button.gss',
      source: `
        .button:hover { color: red; }
        .button:focus { color: blue; }
        .button:hover:focus { color: purple; }
      `
    });

    expect(replacement).toMatchObject({ committed: true, diagnostics: [] });
    expect(compiler.finalize().css).toContain('--state_focus_3a_hover--property_color--value_purple');
  });

  it('rejects an ambiguous coactive state conflict transactionally', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });
    const id = '/project/src/button.gss';
    compiler.replaceStylesheet({ id, source: '.button { display: block; }' });

    const replacement = compiler.replaceStylesheet({
      id,
      source: `
        .button:hover { color: red; }
        .button:focus { color: blue; }
      `
    });

    expect(replacement).toMatchObject({
      committed: false,
      generation: 1,
      diagnostics: [{
        code: 'GSS1205',
        severity: 'error',
        phase: 'resolve',
        reason: 'ambiguous-coactive-state-conflict'
      }]
    });
    expect(compiler.finalize().css).toBe(
      `.${displayBlockClass} {\n  display: block;\n}`
    );
  });

  it('combines an ARIA condition with a sibling runtime relation', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/field.gss',
      source: '.input[aria-invalid="true"] + .hint { color: red; }'
    });

    const sourceMarker = 'gss-s--module_src_2f_field_2e_gss--path_input';
    const targetMarker =
      'gss-t--module_src_2f_field_2e_gss--relation_adjacent--condition_attribute_3a_aria_2d_invalid_3d_true--source_input--target_input_2f_hint';
    expect(replacement.diagnostics).toEqual([]);
    expect(compiler.finalize().css).toBe(
      `.${sourceMarker}[aria-invalid="true"] + .${targetMarker} {\n  color: red;\n}`
    );
  });

  it('plans an ancestor ARIA condition as a source-target contextual atom', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/disclosure.gss',
      source: '.group[aria-expanded="true"] .item { color: red; }'
    });

    const sourceMarker = 'gss-s--module_src_2f_disclosure_2e_gss--path_group';
    const targetMarker =
      'gss-t--module_src_2f_disclosure_2e_gss--relation_descendant--condition_attribute_3a_aria_2d_expanded_3d_true--source_group--target_group_2f_item';
    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports.group?.selfClassName).toBe(sourceMarker);
    expect(replacement.module?.scopeSchema.exports.group?.targets.item?.selfClassName).toBe(
      targetMarker
    );
    expect(compiler.finalize().css).toBe(
      `.${sourceMarker}[aria-expanded="true"] .${targetMarker} {\n  color: red;\n}`
    );
  });

  it.each([
    ['data-variant', 'primary'],
    ['aria-selected', 'true']
  ])('plans the current-element [%s="%s"] condition', (attribute, value) => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/control.gss',
      source: `.control[${attribute}="${value}"] { color: red; }`
    });

    expect(replacement.diagnostics).toEqual([]);
    const className = replacement.module?.scopeSchema.exports.control?.selfClassName;
    expect(className).toContain(`--state_attribute_3a_${attribute.replace('-', '_2d_')}_3d_${value}--`);
    expect(compiler.finalize().css).toBe(
      `.${className}[${attribute}="${value}"] {\n  color: red;\n}`
    );
  });

  it('combines a source state with a runtime relation', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/field.gss',
      source: '.field:focus-within > .hint { color: red; }'
    });

    const sourceMarker = 'gss-s--module_src_2f_field_2e_gss--path_field';
    const targetMarker =
      'gss-t--module_src_2f_field_2e_gss--relation_child--state_focus_2d_within--source_field--target_field_2f_hint';
    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports.field?.selfClassName).toBe(sourceMarker);
    expect(replacement.module?.scopeSchema.exports.field?.targets.hint?.selfClassName).toBe(
      targetMarker
    );
    expect(compiler.finalize().css).toBe(
      `.${sourceMarker}:focus-within > .${targetMarker} {\n  color: red;\n}`
    );
  });

  it.each([
    ['focus', 'focus'],
    ['focus-visible', 'focus_2d_visible'],
    ['focus-within', 'focus_2d_within'],
    ['active', 'active'],
    ['disabled', 'disabled'],
    ['checked', 'checked']
  ])('plans the supported current-element :%s state', (state, encodedState) => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/control.gss',
      source: `.control:${state} { color: red; }`
    });

    const className =
      `gss-a--layer_unlayered--condition_base--state_${encodedState}--property_color--value_red--importance_normal`;
    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports.control?.selfClassName).toBe(className);
    expect(compiler.finalize().css).toBe(`.${className}:${state} {\n  color: red;\n}`);
  });

  it('fails closed for an unregistered pseudo state', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    expect(compiler.replaceStylesheet({
      id: '/project/src/link.gss',
      source: '.link:visited { color: red; }'
    })).toMatchObject({
      committed: false,
      generation: 0,
      diagnostics: [{
        code: 'GSS1101',
        phase: 'validate',
        reason: 'capability-not-registered'
      }]
    });
  });

  it('plans an ancestor hover as a source-target contextual atom', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/family.gss',
      source: '.father:hover .son { color: red; }'
    });

    const sourceMarker = 'gss-s--module_src_2f_family_2e_gss--path_father';
    const targetMarker =
      'gss-t--module_src_2f_family_2e_gss--relation_descendant--state_hover--source_father--target_father_2f_son';
    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports).toEqual({
      father: {
        selfClassName: sourceMarker,
        targets: {
          son: { selfClassName: targetMarker, targets: {} }
        }
      }
    });
    expect(compiler.finalize().css).toBe(
      `.${sourceMarker}:hover .${targetMarker} {\n  color: red;\n}`
    );
  });

  it('plans a current-element hover declaration as a state atom', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/button.gss',
      source: '.button { color: green; } .button:hover { color: red; }'
    });

    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports.button?.selfClassName).toBe(
      `${hoverColorRedClass} ${colorGreenClass}`
    );
    expect(compiler.finalize().css).toContain(
      `.${hoverColorRedClass}:hover {\n  color: red;\n}`
    );
  });

  it('lowers an ownership prefix before a runtime-relation suffix', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/grid.gss',
      source: '.panel .row > .cell { color: red; }'
    });

    const sourceMarker = 'gss-s--module_src_2f_grid_2e_gss--path_panel_2f_row';
    const targetMarker =
      'gss-t--module_src_2f_grid_2e_gss--relation_child--source_panel_2f_row--target_panel_2f_row_2f_cell';
    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports).toEqual({
      panel: {
        selfClassName: '',
        targets: {
          row: {
            selfClassName: sourceMarker,
            targets: {
              cell: { selfClassName: targetMarker, targets: {} }
            }
          }
        }
      }
    });
    expect(compiler.finalize().css).toBe(
      `.${sourceMarker} > .${targetMarker} {\n  color: red;\n}`
    );
  });

  it('emits a general-sibling contextual atom', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/field.gss',
      source: '.label ~ .help { color: red; }'
    });

    const sourceMarker = 'gss-s--module_src_2f_field_2e_gss--path_label';
    const targetMarker =
      'gss-t--module_src_2f_field_2e_gss--relation_general_2d_sibling--source_label--target_label_2f_help';
    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports.label?.targets.help?.selfClassName).toBe(
      targetMarker
    );
    expect(compiler.finalize().css).toBe(
      `.${sourceMarker} ~ .${targetMarker} {\n  color: red;\n}`
    );
  });

  it('emits an adjacent-sibling contextual atom', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/field.gss',
      source: '.label + .input { color: red; }'
    });

    const sourceMarker = 'gss-s--module_src_2f_field_2e_gss--path_label';
    const targetMarker =
      'gss-t--module_src_2f_field_2e_gss--relation_adjacent--source_label--target_label_2f_input';
    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports).toEqual({
      label: {
        selfClassName: sourceMarker,
        targets: {
          input: { selfClassName: targetMarker, targets: {} }
        }
      }
    });
    expect(compiler.finalize().css).toBe(
      `.${sourceMarker} + .${targetMarker} {\n  color: red;\n}`
    );
  });

  it('preserves every edge in a multi-level direct-child relation', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/family.gss',
      source: '.grand > .father > .son { color: red; }'
    });

    const sourceMarker = 'gss-s--module_src_2f_family_2e_gss--path_grand';
    const middleMarker =
      'gss-c--module_src_2f_family_2e_gss--relation_child_2f_child--position_1--path_grand_2f_father--target_grand_2f_father_2f_son';
    const targetMarker =
      'gss-t--module_src_2f_family_2e_gss--relation_child_2f_child--source_grand--target_grand_2f_father_2f_son';
    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports).toEqual({
      grand: {
        selfClassName: sourceMarker,
        targets: {
          father: {
            selfClassName: middleMarker,
            targets: {
              son: { selfClassName: targetMarker, targets: {} }
            }
          }
        }
      }
    });
    expect(compiler.finalize().css).toBe(
      `.${sourceMarker} > .${middleMarker} > .${targetMarker} {\n  color: red;\n}`
    );
  });

  it('emits source and target markers for a direct-child contextual atom', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/family.gss',
      source: '.father > .son { color: red; }'
    });

    const sourceMarker = 'gss-s--module_src_2f_family_2e_gss--path_father';
    const targetMarker =
      'gss-t--module_src_2f_family_2e_gss--relation_child--source_father--target_father_2f_son';
    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports).toEqual({
      father: {
        selfClassName: sourceMarker,
        targets: {
          son: {
            selfClassName: targetMarker,
            targets: {}
          }
        }
      }
    });
    expect(compiler.finalize()).toMatchObject({
      css: `.${sourceMarker} > .${targetMarker} {\n  color: red;\n}`,
      manifest: {
        rules: [{
          kind: 'contextual-atom',
          selector: `.${sourceMarker} > .${targetMarker}`,
          property: 'color',
          value: 'red'
        }]
      }
    });
  });

  it('normalizes standard CSS nesting before building target paths', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/family.gss',
      source: `
        .father {
          display: block;

          .son {
            color: red;
          }
        }
      `
    });

    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports).toEqual({
      father: {
        selfClassName: displayBlockClass,
        targets: {
          son: {
            selfClassName: colorRedClass,
            targets: {}
          }
        }
      }
    });
  });

  it('accumulates general path declarations and keeps only the target winner', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/family.gss',
      source: `
        .icon { display: inline-block; color: green; }
        .father .icon { color: red; }
        .father .son .icon { color: blue; font-size: 16px; }
      `
    });

    const exports = replacement.module?.scopeSchema.exports;
    if (!exports) throw new Error('Expected compiled scope exports.');
    expect(exports.icon?.selfClassName).toBe(`${colorGreenClass} ${displayInlineBlockClass}`);
    expect(exports.father?.targets.icon?.selfClassName).toBe(
      `${colorRedClass} ${displayInlineBlockClass}`
    );
    expect(exports.father?.targets.son?.targets.icon?.selfClassName).toBe(
      `${colorBlueClass} ${displayInlineBlockClass} ${fontSize16Class}`
    );
  });

  it('normalizes a selector list into independent scope branches', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/actions.gss',
      source: '.button, .link { color: red; }'
    });

    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports).toEqual({
      button: { selfClassName: colorRedClass, targets: {} },
      link: { selfClassName: colorRedClass, targets: {} }
    });
    expect(compiler.finalize()).toMatchObject({
      report: { modules: 1, rules: 1 },
      manifest: {
        rules: [{ sources: ['src/actions.gss'] }]
      }
    });
  });

  it('builds a nested scope for an owned descendant target', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/family.gss',
      source: '.father { display: block; } .father .son { color: red; }'
    });

    expect(replacement.diagnostics).toEqual([]);
    expect(replacement.module?.scopeSchema.exports).toEqual({
      father: {
        selfClassName: displayBlockClass,
        targets: {
          son: {
            selfClassName: colorRedClass,
            targets: {}
          }
        }
      }
    });
    expect(replacement.module?.moduleCode).toBe(
      `const father = { self: "${displayBlockClass}", "son": { self: "${colorRedClass}" } };\n` +
      'export default { father };\n'
    );
  });

  it('merges separate rules that contribute different declarations to one scope', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });

    const replacement = compiler.replaceStylesheet({
      id: '/project/src/button.gss',
      source: '.button { color: red; } .button { display: block; }'
    });

    expect(replacement.module?.scopeSchema.exports.button).toEqual({
      selfClassName: `${colorRedClass} ${displayBlockClass}`,
      targets: {}
    });
    expect(compiler.finalize().css).toBe(
      `.${colorRedClass} {\n  color: red;\n}\n\n` +
      `.${displayBlockClass} {\n  display: block;\n}`
    );
  });
});
