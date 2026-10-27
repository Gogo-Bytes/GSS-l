import { expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

it.each([
  ['/workspace/app', '/workspace/shared/Card.gss', '../shared/Card.gss'],
  ['/workspace/app', '/workspace/app-other/Card.gss', '../app-other/Card.gss'],
  ['/workspace/app', '/workspace/app/src/Card.gss', 'src/Card.gss'],
  ['/', '/shared/Card.gss', 'shared/Card.gss'],
  ['C:\\workspace\\app', 'C:\\workspace\\shared\\Card.gss', '../shared/Card.gss'],
  ['c:/workspace/app', 'C:/workspace/shared/Card.gss', '../shared/Card.gss'],
  ['//server/share/app', '//server/share/shared/Card.gss', '../shared/Card.gss'],
  ['/workspace/app/./src/..', '/workspace/shared/./Card.gss', '../shared/Card.gss'],
  ['/workspace/app', '../shared/Card.gss', '../shared/Card.gss']
])('derives a project-relative logical id from root %s and source %s', (projectRoot, id, logicalId) => {
  const compiler = createGssCompilerSession({ projectRoot });
  const result = compiler.replaceStylesheet({ id, source: '.card { future-paint: red; }' });
  expect(result.committed).toBe(true);
  expect(result.module?.scopeSchema.moduleId).toBe(logicalId);
  expect(compiler.getScopeSchema(id)).toEqual(result.module?.scopeSchema);
});

it('keeps root-external CSS, JS and manifest identical after relocating the workspace', () => {
  const outputs = ['/checkout/one', '/another/checkout/two'].map((workspace) => {
    const compiler = createGssCompilerSession({ projectRoot: `${workspace}/app` });
    const result = compiler.replaceStylesheet({
      id: `${workspace}/shared/Card.gss`,
      source: '.card { future-paint: red; animation: spin 1s; } @keyframes spin { to { opacity: 0; } }'
    });
    expect(result.committed).toBe(true);
    const snapshot = compiler.finalize();
    expect(snapshot.manifest.modules).toEqual(['../shared/Card.gss']);
    return { code: result.module?.moduleCode, css: snapshot.css, manifest: snapshot.manifest };
  });
  expect(outputs[0]).toEqual(outputs[1]);
});

it.each([
  ['C:/workspace/app', 'D:/shared/Card.gss'],
  ['//server/share/app', '//other/share/Card.gss'],
  ['relative-root', '/absolute/Card.gss']
])('fails closed when %s cannot express %s relatively', (projectRoot, id) => {
  const compiler = createGssCompilerSession({ projectRoot });
  compiler.replaceStylesheet({ id: 'Good.gss', source: '.good { color: red; }' });
  const previous = compiler.finalize();
  const result = compiler.replaceStylesheet({ id, source: '.card { future-paint: red; }' });
  expect(result.committed).toBe(false);
  expect(result.diagnostics).toEqual([expect.objectContaining({
    severity: 'error', reason: 'non-relative-module-identity'
  })]);
  expect(compiler.finalize()).toEqual(previous);
  expect(compiler.getScopeSchema(id)).toBeUndefined();
});
