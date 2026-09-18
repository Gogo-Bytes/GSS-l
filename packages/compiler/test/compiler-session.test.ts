import { describe, expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

const colorRedClass =
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_red--importance_normal';
const colorBlueClass =
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_blue--importance_normal';
const colorGreenClass =
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_green--importance_normal';
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
