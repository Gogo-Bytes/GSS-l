import { mkdtemp, realpath, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { webpack, type Configuration, type Stats } from 'webpack';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import { browserslistToTargets, Features } from 'lightningcss';
import { react } from '@gss-l/react';
import { expect, it } from 'vitest';
import { gss, gssCssMinimizers } from '../dist/index.js';

const require = createRequire(import.meta.url);
async function build(config: Configuration): Promise<Stats> {
  const compiler = webpack(config);
  if (!compiler) throw new Error('Missing compiler');
  try {
    return await new Promise((resolve, reject) => compiler.run((error, stats) => {
      if (error) reject(error);
      else if (!stats || stats.hasErrors()) reject(new Error(stats?.toString({ all: false, errors: true })));
      else resolve(stats);
    }));
  } finally {
    await new Promise<void>((resolve, reject) => compiler.close(error => error ? reject(error) : resolve()));
  }
}

it('isolates GSS lowering through public configuration while ordinary CSS matches the native host', async () => {
  const root = await realpath(await mkdtemp(path.join(tmpdir(), 'gss-webpack-public-')));
  const options = { parallel: false, minimizerOptions: { targets: browserslistToTargets(['safari 9']), include: Features.LogicalProperties } };
  const before = structuredClone(options);
  try {
    await writeFile(path.join(root, 'a.gss'), '.card { margin-inline-start: 1px; margin-left: 2px; }');
    await writeFile(path.join(root, 'ordinary.css'), '.ordinary { margin-inline-start: 1px; margin-left: 2px; user-select: none; }');
    await writeFile(path.join(root, 'entry.js'), "import './ordinary.css';import a from './a.gss';console.log(a.card);");
    await writeFile(path.join(root, 'native.js'), "import './ordinary.css';");
    const config = (native: boolean): Configuration => ({
      context: root, mode: 'production', devtool: 'source-map',
      entry: native ? { index: './native.js' } : { index: './entry.js', second: './entry.js' },
      output: { path: path.join(root, native ? 'native' : 'gss'), publicPath: '/' },
      module: { rules: [{ test: /\.css$/, use: [MiniCssExtractPlugin.loader, require.resolve('css-loader')] }] },
      optimization: { splitChunks: false, minimizer: native
        ? [new CssMinimizerPlugin({ ...options, minify: CssMinimizerPlugin.lightningCssMinify })]
        : gssCssMinimizers(options) },
      plugins: [new MiniCssExtractPlugin({ filename: '[name].css' }),
        ...['index', ...(native ? [] : ['second'])].map(name => new HtmlWebpackPlugin({ filename: `${name}.html`, chunks: [name] })),
        ...(native ? [] : [gss({ adapter: react() })])]
    });
    await build(config(false));
    await build(config(true));
    expect(options).toEqual(before);
    const generated = await readFile(path.join(root, 'gss/gss-l.css'), 'utf8');
    expect(generated).toContain('margin-inline-start:1px');
    expect(generated).toContain('margin-left:2px');
    expect(generated).not.toContain('[dir=');
    expect(await readFile(path.join(root, 'gss/index.css'), 'utf8'))
      .toBe(await readFile(path.join(root, 'native/index.css'), 'utf8'));
    for (const name of ['index', 'second']) {
      const html = await readFile(path.join(root, 'gss', `${name}.html`), 'utf8');
      expect(html.indexOf(`href="/${name}.css"`)).toBeGreaterThan(-1);
      expect(html.indexOf('href="/gss-l.css"')).toBeGreaterThan(html.indexOf(`href="/${name}.css"`));
    }
  } finally { await rm(root, { recursive: true, force: true }); }
});
