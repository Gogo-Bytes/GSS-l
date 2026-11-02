import { expect, it } from 'vitest';
import { createGssCompilerSession } from '@gss-l/compiler';
import { prepareCandidateSnapshot } from '../src/candidate-snapshot.js';
import { createStylesheetPreparation, StylesheetPreparationError } from '../src/source-preparation.js';

const config = { projectRoot: '/project' };
const a = '/project/a.gss';
const b = '/project/b.gss';

it('replays the reachable set deterministically, including modules not prepared by a loader', async () => {
  const sources = new Map([
    [a, '.card { margin-left: 9px; margin: var(--space); }'],
    [b, '.card { color: red; }']
  ]);
  const prepare = createStylesheetPreparation(config, async (id) => ({ source: sources.get(id)! }));
  await prepare(b);
  const actual = await prepareCandidateSnapshot(config, [b, a, b], prepare);
  const other = await prepareCandidateSnapshot(config, [a, b], prepare);
  const oracle = createGssCompilerSession(config);
  for (const [id, source] of sources) expect(oracle.replaceStylesheet({ id, source }).committed).toBe(true);
  expect(actual.snapshot).toEqual(oracle.finalize());
  expect(actual.snapshot).toEqual(other.snapshot);
  expect(actual.stylesheets.map(({ input }) => input.id)).toEqual([a, b]);
  expect(actual.snapshot.css).toContain('margin: var(--space)');
  expect(actual.snapshot.css).not.toContain('margin-left: 9px');
});

it('drops an unreachable contribution even when it remains in the preparation cache', async () => {
  const prepare = createStylesheetPreparation(config, async (id) => ({
    source: id === a ? '.card { color: red; }' : '.card { color: blue; }'
  }));
  const first = await prepareCandidateSnapshot(config, [a, b], prepare);
  const next = await prepareCandidateSnapshot(config, [a], prepare);
  expect(first.snapshot.manifest.modules).toEqual(['a.gss', 'b.gss']);
  expect(next.snapshot.manifest.modules).toEqual(['a.gss']);
  expect(next.snapshot.css).not.toContain('color: blue');
  expect(first.snapshot.css).toContain('color: blue');
});

it('produces an empty candidate when all imports disappear', async () => {
  const prepare = createStylesheetPreparation(config, async () => ({ source: '.card { color: red; }' }));
  await prepare(a);
  const result = await prepareCandidateSnapshot(config, [], prepare);
  expect(result.stylesheets).toEqual([]);
  expect(result.snapshot.css).toBe('');
  expect(result.snapshot.manifest.modules).toEqual([]);
});

it('rejects conflicting global resources that were valid in isolation', async () => {
  const prepare = createStylesheetPreparation(config, async (id) => ({ source: id === a
    ? '@property --brand { syntax: "<color>"; inherits: true; initial-value: red; }'
    : '@property --brand { syntax: "<length>"; inherits: false; initial-value: 0px; }' }));
  await Promise.all([prepare(a), prepare(b)]);
  const previous = await prepareCandidateSnapshot(config, [a], prepare);
  const before = JSON.stringify(previous);
  await expect(prepareCandidateSnapshot(config, [a, b], prepare)).rejects.toMatchObject({
    diagnostics: [expect.objectContaining({ code: 'GSS1301', id: b })]
  });
  expect(JSON.stringify(previous)).toBe(before);
});

it('rejects a failed reachable stylesheet without returning a partial candidate', async () => {
  const prepare = createStylesheetPreparation(config, async (id) => ({
    source: id === a ? '.card { color: red; }' : '.card { color: red;'
  }));
  await expect(prepareCandidateSnapshot(config, [a, b], prepare)).rejects.toBeInstanceOf(StylesheetPreparationError);
});

it('rejects a local module artifact inconsistent with the replayed candidate', async () => {
  const prepare = createStylesheetPreparation(config, async () => ({ source: '.card { color: red; }' }));
  const prepared = await prepare(a);
  await expect(prepareCandidateSnapshot(config, [a], async () => ({
    ...prepared, module: { ...prepared.module, moduleCode: 'export default {};' }
  }))).rejects.toThrow('module artifact changed');
});

it('rejects an input prepared under a different canonical ID', async () => {
  const prepare = createStylesheetPreparation(config, async () => ({ source: '.card { color: red; }' }));
  const prepared = await prepare(b);
  await expect(prepareCandidateSnapshot(config, [a], async () => prepared)).rejects.toThrow('prepared input ID differs');
});

it('retains asset identity and uses the final host URL resolver', async () => {
  const prepare = createStylesheetPreparation(config, async () => ({
    source: '.card { background-image: url("./image.png"); }',
    assetReferences: [{ url: './image.png', identity: 'image-1' }]
  }));
  const result = await prepareCandidateSnapshot(config, [a], prepare, {
    resolveAssetUrl(identity) { expect(identity).toBe('image-1'); return '/assets/image.hash.png'; }
  });
  expect(result.snapshot.css).toContain('/assets/image.hash.png');
  expect(result.stylesheets[0]?.input.assetReferences).toEqual([{ url: './image.png', identity: 'image-1' }]);
});

it('retains preserved mode and warnings through global replay', async () => {
  const prepare = createStylesheetPreparation(config, async () => ({ source: '.card { future-property: value; }' }));
  const result = await prepareCandidateSnapshot(config, [a], prepare);
  expect(result.stylesheets[0]?.module.compilationMode).toBe('preserved');
  expect(result.snapshot.css).toContain('future-property: value');
  expect(result.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'GSS1104', id: a })]));
});
