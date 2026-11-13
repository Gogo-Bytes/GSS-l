import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRsbuild } from '@rsbuild/core';
import { react } from '@gss-l/react';
import { expect, it } from 'vitest';
import { pluginGss } from '@gss-l/rsbuild';
import { cssIsolation } from '../src/css-isolation.js';

it.each([true, false])('inherits host CSS configuration without enabling disabled minification: %s', async minify => {
  const root = await mkdtemp(path.join(tmpdir(), 'gss-rsbuild-'));
  let close: (() => Promise<void>) | undefined;
  try {
    await writeFile(path.join(root, 'index.js'), "import a from './styles/a.gss';import './ordinary.css';console.log(a.card);");
    await mkdir(path.join(root, 'styles'));
    const filename = minify ? 'image.svg' : 'image %20.svg';
    const assetUrl = minify ? 'image.svg' : 'image%20%2520.svg';
    // A second decode must not silently select this different, existing asset.
    await writeFile(path.join(root, 'styles/image  .svg'), '<svg id="wrong-asset"/>');
    await writeFile(path.join(root, 'styles', filename), '<svg xmlns="http://www.w3.org/2000/svg"><rect id="shape"/><!--' + 'x'.repeat(8000) + '--></svg>');
    await writeFile(path.join(root, 'styles/a.gss'), `.card { margin-inline-start: 1px; margin-left: 2px; background-image: url("./${assetUrl}#shape"); }`);
    await writeFile(path.join(root, 'ordinary.css'), `.ordinary { margin-inline-start: 1px; margin-left: 2px; user-select: none; background-image: url("./styles/${assetUrl}#shape"); }`);
    await writeFile(path.join(root, 'baseline.js'), "import './ordinary.css';");
    const cssOptions = { minimizerOptions: { errorRecovery: false } };
    const original = structuredClone(cssOptions);
    const baseline = await createRsbuild({ cwd: root, rsbuildConfig: {
      mode: 'production', logLevel: 'error', source: { entry: { baseline: './baseline.js' } },
      output: { filename: { svg: '[contenthash].svg' }, distPath: { root: 'baseline-dist' }, overrideBrowserslist: ['safari >= 9'], minify: { js: false, css: minify, cssOptions } }
    } });
    const baselineResult = await baseline.build();
    await baselineResult.close();
    const baselineHtml = await readFile(path.join(root, 'baseline-dist/baseline.html'), 'utf8');
    const baselineHref = /href="([^"]+\.css)"/.exec(baselineHtml)![1]!;
    const baselineCss = await readFile(path.join(root, 'baseline-dist', baselineHref), 'utf8');
    const host = await createRsbuild({ cwd: root, rsbuildConfig: {
      mode: 'production', logLevel: 'error', plugins: [pluginGss({ adapter: react() })],
      source: { entry: { index: './index.js', second: './index.js' } },
      output: { filename: { svg: '[contenthash].svg' }, overrideBrowserslist: ['safari >= 9'], minify: { js: false, css: minify, cssOptions } }
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
      expect(css).toContain('#shape');
      expect(css).toContain('/static/svg/');
      expect(css).not.toContain(root);
      const asset = /url\(["']?([^"')]+)#shape/.exec(css)![1]!;
      expect(await readFile(path.join(root, 'dist', asset), 'utf8')).toContain('id="shape"');
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

it('reports the imported GSS failure location and builds after correction', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'gss-rsbuild-diagnostic-'));
  const source = path.join(root, 'card.gss');
  try {
    await writeFile(path.join(root, 'index.js'), "import card from './card.gss'; console.log(card.card);");
    await writeFile(source, '.card {');
    const host = await createRsbuild({ cwd: root, rsbuildConfig: {
      mode: 'development', logLevel: 'silent', plugins: [pluginGss({ adapter: react() })],
      source: { entry: { index: './index.js' } }
    } });
    const compiler = await host.createCompiler();
    try {
      const run = () => new Promise<{ hasErrors(): boolean; toString(options: { all: boolean; errors: boolean; errorDetails?: boolean }): string }>((resolve, reject) => {
        compiler.run((error, stats) => error ? reject(error) : stats ? resolve(stats) : reject(new Error('No stats')));
      });
      const failed = await run();
      expect(failed.hasErrors()).toBe(true);
      const message = failed.toString({ all: false, errors: true, errorDetails: true });
      expect(message).toContain(`${source}:1:1`);
      expect(message).toContain('1 | .card {');
      expect(message).toContain('^');
      await writeFile(source, '.card { color: green; }');
      const entry = path.join(root, 'index.js');
      const usage = 'export const View = <div className={alias}/>;';
      await writeFile(entry, ["import card from './card.gss';", "const alias = active ? card.card : 'x';", usage].join('\n'));
      const aliasFailure = await run();
      const display = aliasFailure.toString({ all: false, errors: true, errorDetails: true });
      expect(display).toContain('[GSS2104]');
      expect(display).toContain(`index.js:3:${usage.indexOf('{alias}') + 2}`);
      expect(display).toContain('3 | ' + usage);
      await writeFile(entry, "import card from './card.gss'; console.log(card.card);");
      const recovered = await run();
      expect(recovered.hasErrors(), recovered.toString({ all: false, errors: true })).toBe(false);
    } finally {
      await new Promise<void>((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
