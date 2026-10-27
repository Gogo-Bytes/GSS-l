import { expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

it('does not merge different CSS string content values after Unicode normalization', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const a = session.replaceStylesheet({ id: '/project/a.gss', source: '.icon::before { content: "caf\u00e9"; }' });
  const b = session.replaceStylesheet({ id: '/project/b.gss', source: '.icon::before { content: "cafe\u0301"; }' });
  expect(a.committed && b.committed).toBe(true);
  const composedClass = a.module!.scopeSchema.exports.icon!.selfClassName;
  const decomposedClass = b.module!.scopeSchema.exports.icon!.selfClassName;
  expect(composedClass).not.toBe(decomposedClass);
  const snapshot = session.finalize();
  expect(snapshot.manifest.rules).toEqual([
    expect.objectContaining({ className: composedClass, value: '"caf\u00e9"', sources: ['a.gss'] }),
    expect.objectContaining({ className: decomposedClass, value: '"cafe\u0301"', sources: ['b.gss'] })
  ]);
  expect(snapshot.css).toContain(`.${composedClass}::before`);
  expect(snapshot.css).toContain(`.${decomposedClass}::before`);
});
