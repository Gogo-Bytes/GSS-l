import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rspack, type Compilation, type Stats } from '@rspack/core';
import { expect, it } from 'vitest';
import { installPublication } from '../src/publication.js';
import { prepareCandidateSnapshot } from '@gss-l/integration-preparation';
import { createStylesheetPreparation } from '@gss-l/integration-preparation';

it('publishes only emitted successful rounds and replaces recovery dependencies after success', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gss-publication-'));
  await writeFile(path.join(root, 'index.js'), 'export default 1;');
  const config = { projectRoot: root };
  const candidate = await prepareCandidateSnapshot(config, [path.join(root, 'style.gss')],
    createStylesheetPreparation(config, async () => ({ source: '.card { color: red; }' })));
  const empty = await prepareCandidateSnapshot(config, [], async () => { throw new Error('unreachable'); });
  let fail = false;
  let skip = false;
  let next = candidate;
  let token = 'old';
  let last: Compilation;
  const compiler = rspack({ context: root, mode: 'development', entry: './index.js',
    output: { path: path.join(root, 'dist') } });
  const publication = installPublication(compiler);
  compiler.hooks.shouldEmit.tap('Test', () => skip ? false : undefined);
  compiler.hooks.thisCompilation.tap('Test', (compilation) => {
    last = compilation;
    compilation.hooks.processAssets.tap({ name: 'Test', stage: compiler.rspack.Compilation.PROCESS_ASSETS_STAGE_ADDITIONAL }, () => {
      publication.registerDependencies(compilation, {
        fileDependencies: [path.join(root, `${token}.txt`)],
        contextDependencies: [path.join(root, `${token}-context`)],
        missingDependencies: [path.join(root, `${token}-missing`)]
      });
      publication.stage(compilation, next);
      compilation.emitAsset('gss.css', new compiler.rspack.sources.RawSource(next.snapshot.css));
      // A late unrelated error must block publication just like a GSS error.
      if (fail) compilation.errors.push(new Error('unrelated JS error'));
    });
  });
  const run = () => new Promise<Stats>((resolve, reject) => compiler.run((error, stats) => {
    if (error) reject(error); else if (stats) resolve(stats); else reject(new Error('No stats'));
  }));
  const dependencies = (stats: Stats, kind: 'fileDependencies' | 'contextDependencies' | 'missingDependencies') =>
    [...stats.compilation[kind]];
  try {
    expect(publication.published).toBeUndefined();
    expect((await run()).hasErrors()).toBe(false);
    expect(publication.published).toBe(candidate);
    const bytes = await readFile(path.join(root, 'dist/gss.css'), 'utf8');
    next = empty; token = 'failed'; fail = true;
    const failed = await run();
    expect(failed.hasErrors()).toBe(true);
    expect(publication.published).toBe(candidate);
    expect(await readFile(path.join(root, 'dist/gss.css'), 'utf8')).toBe(bytes);
    expect(dependencies(failed, 'fileDependencies')).toEqual(expect.arrayContaining([path.join(root, 'old.txt'), path.join(root, 'failed.txt')]));
    fail = false; skip = true; token = 'skipped';
    const skipped = await run();
    expect(skipped.hasErrors()).toBe(false);
    expect(publication.published).toBe(candidate);
    expect(dependencies(skipped, 'contextDependencies')).toContain(path.join(root, 'old-context'));
    expect(dependencies(skipped, 'missingDependencies')).toContain(path.join(root, 'failed-missing'));
    skip = false; token = 'new';
    const recovered = await run();
    expect(publication.published).toBe(empty);
    expect(await readFile(path.join(root, 'dist/gss.css'), 'utf8')).toBe('');
    expect(dependencies(recovered, 'fileDependencies')).not.toContain(path.join(root, 'old.txt'));
    expect(dependencies(recovered, 'missingDependencies')).not.toContain(path.join(root, 'failed-missing'));
    expect(() => publication.stage(last, candidate)).toThrow('inactive compilation');
    fail = true; token = 'later';
    const later = await run();
    expect(dependencies(later, 'fileDependencies')).toContain(path.join(root, 'new.txt'));
    expect(dependencies(later, 'fileDependencies')).not.toContain(path.join(root, 'old.txt'));
  } finally {
    await new Promise<void>((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
