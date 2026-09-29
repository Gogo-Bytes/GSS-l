import { expect, it } from 'vitest';
import { createCompilerSession } from '../src/application/compiler-session.js';
import { parseStylesheet } from '../src/infrastructure/postcss-stylesheet-parser.js';
import { createDefaultNameAllocator } from '../src/application/name-allocator.js';

it('routes generated names through the injected allocator without changing the session seam', () => {
  const defaults = createDefaultNameAllocator();
  const compiler = createCompilerSession(
    { projectRoot: '/project' },
    { parseStylesheet },
    {
      ...defaults,
      createAtomicName: () => 'test-atomic-name'
    }
  );

  const result = compiler.replaceStylesheet({
    id: '/project/src/button.gss',
    source: '.button { color: red; }'
  });

  if (!result.module) throw new Error('Expected a committed Module artifact.');
  expect(result.module.scopeSchema.exports.button?.selfClassName).toBe('test-atomic-name');
  expect(compiler.finalize().css).toBe('.test-atomic-name {\n  color: red;\n}');
});
