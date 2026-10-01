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

it('routes resource, preserved, and contextual marker names through the allocator', () => {
  const defaults = createDefaultNameAllocator();
  const compiler = createCompilerSession(
    { projectRoot: '/project' },
    { parseStylesheet },
    {
      ...defaults,
      createKeyframesName: () => 'test-keyframes',
      createScopeMarker: () => 'test-scope',
      createSourceMarker: () => 'test-source',
      createTargetMarker: () => 'test-target',
      createHasSubjectMarker: () => 'test-has-subject',
      createObservedMarker: () => 'test-observed'
    }
  );

  expect(compiler.replaceStylesheet({
    id: '/project/src/animation.gss',
    source: '@keyframes spin { to { opacity: 0; } } .box { animation-name: spin; }'
  }).committed).toBe(true);
  expect(compiler.finalize().css).toContain('@keyframes test-keyframes');

  expect(compiler.replaceStylesheet({
    id: '/project/src/fallback.gss',
    source: '.fallback { future-paint: red; }'
  }).committed).toBe(true);
  expect(compiler.finalize().css).toContain('.test-scope');

  expect(compiler.replaceStylesheet({
    id: '/project/src/contextual.gss',
    source: '.input + .label .icon { color: red; }'
  }).committed).toBe(true);
  expect(compiler.finalize().css).toContain('.test-source + .');
  expect(compiler.finalize().css).toContain('.test-target');

  expect(compiler.replaceStylesheet({
    id: '/project/src/observed.gss',
    source: '.card:has(> .error) { color: red; }'
  }).committed).toBe(true);
  expect(compiler.finalize().css).toContain('.test-has-subject:has(> .test-observed)');
});
