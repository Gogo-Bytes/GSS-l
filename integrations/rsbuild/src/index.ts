import type { RsbuildPlugin } from '@rsbuild/core';
import { gss, type GssOptions } from '@gss-l/rspack';
import { cssIsolation } from './css-isolation.js';

export function pluginGss(options: GssOptions): RsbuildPlugin {
  return { name: 'gss', setup(api) {
    cssIsolation.setup(api);
    api.modifyRspackConfig(config => { config.plugins.push(gss(options)); });
  } };
}
