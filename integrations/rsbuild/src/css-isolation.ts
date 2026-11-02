import type { RsbuildPlugin } from '@rsbuild/core';
import { isolatedCssMinimizers, orderGssStylesheets } from '@gss-l/rspack/internal/css-isolation';

/** Internal configuration bridge, composed by the future public pluginGss entry. */
export const cssIsolation: RsbuildPlugin = {
  name: 'gss:css-isolation',
  setup(api) {
    api.modifyBundlerChain({ order: 'post', handler(chain, { CHAIN_ID, rspack }) {
      const id = CHAIN_ID.MINIMIZER.CSS;
      // Development / disabled CSS minification still uses the scoped loader in the core plugin.
      if (!chain.optimization.minimizers.has(id)) return;
      const entries = chain.optimization.minimizers.entries();
      if (Object.keys(entries).some(key => key.startsWith(`${id}-`)) ||
          chain.optimization.minimizer(id).get('plugin') !== rspack.LightningCssMinimizerRspackPlugin) {
        throw new Error('GSS CSS isolation currently requires the single native Rsbuild CSS minimizer.');
      }
      chain.optimization.minimizer(id).tap(([options]) => {
        const [gss, ordinary] = isolatedCssMinimizers(options);
        chain.optimization.minimizer('gss-css').use(rspack.LightningCssMinimizerRspackPlugin, [gss]).before(id);
        return [ordinary];
      });
    } });
    api.modifyHTMLTags(tags => {
      for (const group of [tags.headTags, tags.bodyTags]) {
        orderGssStylesheets(group, tag => tag.tag === 'link' && tag.attrs?.rel === 'stylesheet' && typeof tag.attrs.href === 'string' ? tag.attrs.href : undefined);
      }
      return tags;
    });
  }
};
