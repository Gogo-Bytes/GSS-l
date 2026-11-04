import type { GssSourceAdapter } from '@gss-l/compiler';
import type { WebpackPluginInstance } from 'webpack';
import CssMinimizerPlugin from 'css-minimizer-webpack-plugin';
import { Features, type transform } from 'lightningcss';
import { installMainCompilation } from './main-compilation.js';
import { readStylesheetInput, stylesheetAssetUrl } from './stylesheet-io.js';
import { installCssIsolation, gssCssAsset } from './css-isolation.js';

export type GssCssMinimizerOptions = CssMinimizerPlugin.BasePluginOptions & {
  minify?: typeof CssMinimizerPlugin.lightningCssMinify;
  minimizerOptions?: Omit<Parameters<typeof transform>[0], 'code' | 'filename'>;
};

/** Replace one Lightning CSS minimizer; reuse the host options, including targets. */
export function gssCssMinimizers(options: GssCssMinimizerOptions = {}): WebpackPluginInstance[] {
  if (options.minify && options.minify !== CssMinimizerPlugin.lightningCssMinify) {
    throw new Error('GSS webpack CSS isolation requires Lightning CSS minify.');
  }
  const native = options.minimizerOptions ?? {};
  const gss = { ...options, test: gssCssAsset, minify: CssMinimizerPlugin.lightningCssMinify,
    minimizerOptions: { ...native, include: (native.include ?? 0) & ~Features.LogicalProperties,
      exclude: (native.exclude ?? 0) | Features.LogicalProperties } };
  delete gss.include;
  delete gss.exclude;
  const ordinary = { ...options, minify: CssMinimizerPlugin.lightningCssMinify };
  // Plugin 8's schema accepts Rule[], while its BasePluginOptions declaration only lists Rule.
  // Keep the host filter and add the GSS exclusion using the runtime-supported array form.
  Object.assign(ordinary, { exclude: [...(options.exclude ? [options.exclude] : []), gssCssAsset] });
  return [new CssMinimizerPlugin(gss), new CssMinimizerPlugin(ordinary)];
}

export type GssOptions = { adapter: GssSourceAdapter };

/** Pair with MiniCssExtractPlugin, HtmlWebpackPlugin and gssCssMinimizers. */
export function gss({ adapter }: GssOptions): WebpackPluginInstance {
  if (!adapter) throw new Error('gss({ adapter }) requires an explicit framework Adapter.');
  return { apply(compiler) {
    const main = installMainCompilation(compiler, { config: { projectRoot: compiler.context }, adapter,
      read: (id, compilation) => readStylesheetInput(compiler, compilation, id),
      finalize: { resolveAssetUrl: identity => stylesheetAssetUrl(compiler.context, identity) } });
    installCssIsolation(compiler, () => main.aggregateId);
  } };
}
