import { mkdtemp, readFile, rm, writeFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rspack, type Stats, type Compiler, type Compilation } from '@rspack/core';
import { react } from '@gss-l/react';
import { expect, it } from 'vitest';
import { installMainCompilation } from '../dist/main-compilation.js';

it('uses the main CSS graph across entries, lazy removal, failed input, recovery and empty contributions', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gss-main-'));
  const source = path.join(root, 'a.gss');
  const index = path.join(root, 'index.js');
  const token = path.join(root, 'token.txt');
  const processor = path.join(root, 'processor.cjs');
  await writeFile(token, 'ok');
  await writeFile(processor, `const fs=require('node:fs');module.exports=function(css){if(!css.trim())return css;const token=${JSON.stringify(token)};if(fs.readFileSync(token,'utf8')==='fail')throw new Error('processor failure before dependency registration');this.addDependency(token);return css}`);
  await writeFile(source, '.card { margin-left: 9px; margin: var(--space); color: red; }');
  await writeFile(path.join(root, 'b.gss'), '.lazy { color: blue; }');
  await writeFile(index, "import a from './a.gss';console.log(a.card);import('./lazy.js');");
  await writeFile(path.join(root, 'other.js'), "console.log('other entry');");
  await writeFile(path.join(root, 'lazy.js'), "import b from './b.gss';console.log(b.lazy);");
  let publication: ReturnType<typeof installMainCompilation>;
  const compiler = rspack({ context: root, mode: 'development', devtool: 'source-map',
    entry: { index: './index.js', other: './other.js' },
    experiments: { css: true },
    module: { rules: [{ test: /\.css$/, type: 'css', use: [processor] }] },
    output: { path: path.join(root, 'dist') },
    plugins: [{ apply(c: Compiler) {
      publication = installMainCompilation(c, { config: { projectRoot: root }, adapter: react(),
        read: async id => ({ source: await readFile(id, 'utf8') }) });
    } }]
  });
  // Native watch may report extra rounds for initial timestamps or the preceding edit.
  // Select by inputs observed before compilation, never by the CSS result under test.
  let inputs: string[] = [];
  const roundInputs = new WeakMap<Compilation, string[]>();
  compiler.hooks.watchRun.tapPromise('TestInputs', async () => {
    inputs = await Promise.all([index, source, token].map(file => readFile(file, 'utf8')));
  });
  compiler.hooks.thisCompilation.tap('TestInputs', compilation => roundInputs.set(compilation, inputs));
  const pending: Stats[] = [];
  let deliver: ((stats: Stats) => void) | undefined;
  let rejectRun: ((error: Error) => void) | undefined;
  const watching = compiler.watch({ aggregateTimeout: 20 }, (error, stats) => {
    if (error) { rejectRun?.(error); return; }
    if (!stats) return;
    if (deliver) { const resolve = deliver; deliver = undefined; resolve(stats); }
    else pending.push(stats);
  });
  const run = () => pending.length ? Promise.resolve(pending.shift()!) : new Promise<Stats>((resolve, reject) => {
    deliver = resolve; rejectRun = reject;
  });
  const currentRun = async () => {
    const expected = await Promise.all([index, source, token].map(file => readFile(file, 'utf8')));
    for (;;) {
      const stats = await run();
      if (JSON.stringify(roundInputs.get(stats.compilation)) === JSON.stringify(expected)) return stats;
    }
  };
  const css = (stats: Stats) => stats.compilation.getAssets().filter(a => a.name.endsWith('.css'))
    .map(a => String(a.source.source())).join('\n');
  try {
    const first = await currentRun();
    expect(first.hasErrors(), first.toString({ all: false, errors: true })).toBe(false);
    expect(css(first)).toContain('color: blue');
    expect(css(first)).toContain('margin: var(--space)');
    expect(css(first)).not.toContain('margin-left: 9px');
    for (const entry of first.compilation.entrypoints.values()) {
      expect(entry.getFiles().some(file => file.endsWith('.css'))).toBe(true);
    }
    await expect(access(path.join(root, '.gss-internal/aggregate.css'))).rejects.toThrow();
    await writeFile(index, "import a from './a.gss';console.log(a.card);");
    const removed = await currentRun();
    expect(removed.hasErrors(), removed.toString({all:false,errors:true})).toBe(false);
    expect(css(removed)).not.toContain('color: blue');
    const previous = publication!.published;
    await writeFile(source, '.card {');
    const failed = await currentRun();
    expect(failed.hasErrors()).toBe(true);
    expect(publication!.published).toBe(previous);
    await writeFile(source, '.card { color: green; }');
    const recovered = await currentRun();
    expect(recovered.hasErrors()).toBe(false);
    expect(css(recovered)).toContain('color: green');
    expect(css(recovered)).not.toContain('color: red');
    const processed = publication!.published;
    await writeFile(token, 'fail');
    expect((await currentRun()).hasErrors()).toBe(true);
    expect(publication!.published).toBe(processed);
    await writeFile(token, 'ok');
    expect((await currentRun()).hasErrors()).toBe(false);
    await writeFile(index, "console.log('no gss');");
    const empty = await currentRun();
    expect(empty.hasErrors()).toBe(false);
    expect(css(empty)).not.toContain('color:');
    expect([...empty.compilation.fileDependencies]).not.toContain(token);
    expect(publication!.published!.snapshot.manifest.modules).toEqual([]);
  } finally {
    await new Promise<void>(resolve => watching.close(resolve));
    await new Promise<void>((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
