import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { rspack, type Compiler, type RuleSetRule, type Stats } from '@rspack/core';
import { react } from '@gss-l/react';
import { expect, it } from 'vitest';
import { isolatedCssMinimizers, isolateCssLoaders, orderGssStylesheets } from '../src/css-isolation.js';
import { installCssIsolation } from '../dist/css-isolation.js';
import { installMainCompilation } from '../dist/main-compilation.js';

it('preserves host options and disables only GSS logical lowering', () => {
  const options = { targets: ['safari >= 9'], include: { logicalProperties: true, nesting: true }, exclude: { vendorPrefixes: true } };
  const loader = { ident: 'host-lightning', loader: 'builtin:lightningcss-loader', options };
  const rules: RuleSetRule[] = [{ oneOf: [{ use: () => [loader] }] }];
  isolateCssLoaders(rules, '/project/.gss-internal/aggregate.css');
  const selected = rules[0]!.oneOf![0];
  if (!selected || typeof selected !== 'object') throw new Error('Expected CSS rule');
  const use = selected.use;
  if (typeof use !== 'function') throw new Error('Expected native use callback');
  const request = { resource: '/project/ordinary.css', realResource: '/project/ordinary.css', resourceQuery: '', resourceFragment: '', issuerLayer: '', issuer: '/project/index.js' };
  expect(use(request)).toEqual([loader]);
  const scoped = use({ ...request, resource: '/project/.gss-internal/aggregate.css' });
  expect(scoped).toEqual([{ ident: 'host-lightning:gss-logical', loader: loader.loader, options: { targets: options.targets,
    include: { logicalProperties: false, nesting: true }, exclude: { logicalProperties: true, vendorPrefixes: true } } }]);
  expect(options.include.logicalProperties).toBe(true);
  const result = isolatedCssMinimizers({ test: /\.css$/, minimizerOptions: options });
  expect(result[0]!.minimizerOptions?.exclude).toEqual({ logicalProperties: true, vendorPrefixes: true });
  expect(result[1]!.minimizerOptions).toBe(options);
});

it('moves only stylesheet slots, retaining ordinary order and all tag attributes', () => {
  const gss = { href: '/static/css/gss-l.hash.css?version=1', nonce: 'nonce' };
  const a = { href: '/a.css' }; const b = { href: '/b.css' }; const script = { script: true };
  const tags = [gss, script, a, b];
  orderGssStylesheets(tags, tag => 'href' in tag ? tag.href : undefined);
  expect(tags).toEqual([a, script, b, gss]);
  expect(tags[3]).toBe(gss);
});

it.each(['[name].[contenthash].css', '[contenthash].css'])('isolates native CSS or rejects unnamed CSS assets: %s', async (cssFilename) => {
  const root = await mkdtemp(path.join(tmpdir(), 'gss-isolation-'));
  const config = { targets: ['safari >= 9'] };
  await writeFile(path.join(root, 'index.js'), "import a from './a.gss';import './ordinary.css';console.log(a.a);");
  await writeFile(path.join(root, 'second.js'), "import a from './a.gss';import './ordinary.css';console.log(a.a);");
  await writeFile(path.join(root, 'a.gss'), '.a { margin-inline-start: 1px; margin-left: 2px; color: red; }');
  await writeFile(path.join(root, 'ordinary.css'), '.ordinary { margin-inline-start: 1px; margin-left: 2px; color: blue; }');
  const compiler = rspack({ context: root, mode: 'production', entry: { index: './index.js', second: './second.js' },
    output: { path: path.join(root, 'dist'), cssFilename }, experiments: { css: true },
    optimization: { splitChunks: false, minimizer: isolatedCssMinimizers({ minimizerOptions: config })
      .map(options => new rspack.LightningCssMinimizerRspackPlugin(options)) },
    module: { rules: [{ test: /\.css$/, type: 'css', use: [{ loader: 'builtin:lightningcss-loader', options: config }] }] },
    plugins: [new rspack.HtmlRspackPlugin({ filename: 'index.html', chunks: ['index'] }),
      new rspack.HtmlRspackPlugin({ filename: 'second.html', chunks: ['second'] }), { apply(c: Compiler) {
        installCssIsolation(c, path.join(root, '.gss-internal/aggregate.css'));
        installMainCompilation(c, { config: { projectRoot: root }, adapter: react(), read: async id => ({ source: await readFile(id, 'utf8') }) });
      } }]
  });
  try {
    const stats = await new Promise<Stats>((resolve, reject) => compiler.run((error, stats) => error ? reject(error) : stats ? resolve(stats) : reject(new Error('No stats'))));
    if (cssFilename === '[contenthash].css') {
      expect(stats.hasErrors()).toBe(true);
      expect(stats.toString({ all: false, errors: true })).toContain('GSS CSS isolation requires');
      return;
    }
    expect(stats.hasErrors(), stats.toString({ all: false, errors: true })).toBe(false);
    const assets = stats.compilation.getAssets();
    const gss = assets.find(asset => /^gss-l\..*\.css$/.test(asset.name))!;
    expect(gss).toBeDefined();
    expect(String(gss.source.source())).toContain('margin-inline-start:1px');
    expect(String(gss.source.source())).not.toContain(':lang');
    const ordinary = assets.filter(asset => asset.name.endsWith('.css') && asset !== gss);
    expect(ordinary.length).toBeGreaterThan(0);
    expect(ordinary.every(asset => String(asset.source.source()).includes(':lang'))).toBe(true);
    for (const name of ['index.html', 'second.html']) {
      const html = String(assets.find(asset => asset.name === name)!.source.source());
      const css = [...html.matchAll(/href="([^"]+\.css)"/g)].map(match => match[1]!);
      expect(css.at(-1)).toContain(gss.name);
    }
    expect(compiler.options.optimization.splitChunks && compiler.options.optimization.splitChunks.cacheGroups?.default).toBe(false);
  } finally {
    await new Promise<void>((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
