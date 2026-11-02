import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRsbuild, type Rspack } from '@rsbuild/core';
import { react } from '@gss-l/react';
import { expect, it } from 'vitest';
import { installCssIsolation } from '@gss-l/rspack/internal/css-isolation';
import { installMainCompilation } from '../../rspack/dist/main-compilation.js';
import { cssIsolation } from '../src/css-isolation.js';

it.each([true, false])('inherits host CSS configuration without enabling disabled minification: %s', async minify => {
  const root = await mkdtemp(path.join(tmpdir(), 'gss-rsbuild-'));
  let close: (() => Promise<void>) | undefined;
  try {
    await writeFile(path.join(root, 'index.js'), "import a from './a.gss';import './ordinary.css';console.log(a.card);");
    await writeFile(path.join(root, 'a.gss'), '.card { margin-inline-start: 1px; margin-left: 2px; }');
    await writeFile(path.join(root, 'ordinary.css'), '.ordinary { margin-inline-start: 1px; margin-left: 2px; user-select: none; }');
    await writeFile(path.join(root, 'baseline.js'), "import './ordinary.css';");
    const cssOptions = { minimizerOptions: { errorRecovery: false } };
    const original = structuredClone(cssOptions);
    const baseline = await createRsbuild({ cwd: root, rsbuildConfig: {
      mode: 'production', logLevel: 'error', source: { entry: { baseline: './baseline.js' } },
      output: { distPath: { root: 'baseline-dist' }, overrideBrowserslist: ['safari >= 9'], minify: { js: false, css: minify, cssOptions } }
    } });
    const baselineResult = await baseline.build();
    await baselineResult.close();
    const baselineHtml = await readFile(path.join(root, 'baseline-dist/baseline.html'), 'utf8');
    const baselineHref = /href="([^"]+\.css)"/.exec(baselineHtml)![1]!;
    const baselineCss = await readFile(path.join(root, 'baseline-dist', baselineHref), 'utf8');
    const host = await createRsbuild({ cwd: root, rsbuildConfig: {
      mode: 'production', logLevel: 'error', plugins: [cssIsolation],
      source: { entry: { index: './index.js', second: './index.js' } },
      output: { overrideBrowserslist: ['safari >= 9'], minify: { js: false, css: minify, cssOptions } },
      tools: { rspack(config) {
        config.plugins.push({ apply(compiler: Rspack.Compiler) {
          installCssIsolation(compiler, path.join(root, '.gss-internal/aggregate.css'));
          installMainCompilation(compiler, { config: { projectRoot: root }, adapter: react(),
            read: async id => ({ source: await readFile(id, 'utf8') }) });
        } });
      } }
    } });
    const result = await host.build();
    close = result.close;
    expect(result.stats?.hasErrors()).toBe(false);
    expect(cssOptions).toEqual(original);
    let shared: string | undefined;
    for (const name of ['index', 'second']) {
      const html = await readFile(path.join(root, `dist/${name}.html`), 'utf8');
      const links = [...html.matchAll(/href="([^"]+\.css)"/g)].map(match => match[1]!);
      const gss = links.at(-1)!;
      expect(gss).toContain('/gss-l.');
      if (shared) expect(gss).toBe(shared);
      shared = gss;
      const css = await readFile(path.join(root, 'dist', gss), 'utf8');
      expect(css).toMatch(/margin-inline-start:\s*1px/);
      expect(css).not.toContain(':lang');
      if (!minify) expect(css).toContain('\n');
      const ordinary = await readFile(path.join(root, 'dist', links[0]!), 'utf8');
      expect(ordinary).toBe(baselineCss);
      if (minify) {
        expect(ordinary).toContain(':lang');
        expect(ordinary).toContain('-webkit-user-select');
      }
    }
  } finally {
    await close?.();
    await rm(root, { recursive: true, force: true });
  }
});

it('does not silently leave a second host minimizer lowering GSS CSS', async () => {
  const host = await createRsbuild({ rsbuildConfig: { mode: 'production', logLevel: 'error', plugins: [cssIsolation],
    output: { minify: { cssOptions: [{}, {}] } } } });
  await expect(host.initConfigs()).rejects.toThrow('single native Rsbuild CSS minimizer');
});
