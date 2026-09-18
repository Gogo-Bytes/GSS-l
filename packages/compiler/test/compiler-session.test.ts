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
