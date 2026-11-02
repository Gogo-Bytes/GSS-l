import { LightningCssMinimizerRspackPlugin, type LightningCssMinimizerRspackPluginOptions, type RspackPluginInstance } from '@rspack/core';
import { isolatedCssMinimizers } from './css-isolation.js';

/** Replace the host CSS minimizer with this pair; targets remain in the host options. */
export function gssCssMinimizers(options: LightningCssMinimizerRspackPluginOptions = {}): RspackPluginInstance[] {
  return isolatedCssMinimizers(options).map(config => new LightningCssMinimizerRspackPlugin(config));
}
