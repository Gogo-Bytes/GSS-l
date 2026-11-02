import path from 'node:path';
import type { GssSourceAdapter } from '@gss-l/compiler';
import { LightningCssMinimizerRspackPlugin, type LightningCssMinimizerRspackPluginOptions, type RspackPluginInstance } from '@rspack/core';
import { installMainCompilation } from './main-compilation.js';
import { readStylesheetInput, stylesheetAssetUrl } from './stylesheet-io.js';
import { installCssIsolation, isolatedCssMinimizers } from './css-isolation.js';

/** Replace the host CSS minimizer with this pair; targets remain in the host options. */
export function gssCssMinimizers(options: LightningCssMinimizerRspackPluginOptions = {}): RspackPluginInstance[] {
  return isolatedCssMinimizers(options).map(config => new LightningCssMinimizerRspackPlugin(config));
}


export type GssOptions = { adapter: GssSourceAdapter };

/** Use with the host's CSS rules and gssCssMinimizers when CSS minification is enabled. */
export function gss({ adapter }: GssOptions): RspackPluginInstance {
  if (!adapter) throw new Error('gss({ adapter }) requires an explicit framework Adapter.');
  return { apply(compiler) {
    installCssIsolation(compiler, path.join(compiler.context, '.gss-internal/aggregate.css'));
    installMainCompilation(compiler, { config: { projectRoot: compiler.context }, adapter,
      read: (id, compilation) => readStylesheetInput(compiler, compilation, id),
      finalize: { resolveAssetUrl: identity => stylesheetAssetUrl(compiler.context, identity) } });
  } };
}
