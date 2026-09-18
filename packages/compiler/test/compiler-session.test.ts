import { describe, expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

const colorRedClass =
  'gss-a--layer_unlayered--condition_base--state_self--property_color--value_red--importance_normal';

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
});
