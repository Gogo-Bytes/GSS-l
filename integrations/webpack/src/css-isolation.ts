import type { Compiler, Module } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';

export const GSS_CSS_CHUNK = 'gss-l';
export const gssCssAsset = /(?:^|\/)gss-l(?:\.[^/]*)?\.css$/;

/** Pair with isolatedCssMinimizers in the host configuration before creating the compiler. */
export function installCssIsolation(compiler: Compiler, aggregateId: () => string): void {
  const previous = compiler.options.optimization.splitChunks;
  if (previous && previous.cacheGroups?.[GSS_CSS_CHUNK]) throw new Error('GSS CSS chunk name is already configured.');
  compiler.options.optimization.splitChunks = {
    ...(previous || {}),
    cacheGroups: {
      // Enabling the CSS-only group must not enable default JS splitting when the host disabled it.
      ...(!previous ? { default: false, defaultVendors: false } : previous.cacheGroups),
      [GSS_CSS_CHUNK]: { name: GSS_CSS_CHUNK, chunks: 'all', enforce: true, priority: 100,
        test: (module: Module) => (module.type === 'css/mini-extract' || module.type === 'css') &&
          module.identifier().includes(aggregateId()) }
    }
  };
  compiler.hooks.thisCompilation.tap('GssCssIsolation', compilation => {
    compilation.hooks.afterProcessAssets.tap('GssCssIsolation', () => {
      for (const chunk of compilation.chunks) {
        if (chunk.name !== GSS_CSS_CHUNK) continue;
        for (const file of chunk.files) {
          if (file.endsWith('.css') && !gssCssAsset.test(file)) {
            compilation.errors.push(new Error('GSS CSS isolation requires a CSS filename containing the gss-l chunk name.'));
          }
        }
      }
    });
    HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tap('GssCssIsolation', data => {
      // Aggregate CSS was appended after ordinary entry CSS before splitting. Preserve that order.
      for (const tags of [data.headTags, data.bodyTags]) {
        orderGssStylesheets(tags, tag => tag.tagName === 'link' && tag.attributes.rel === 'stylesheet' && typeof tag.attributes.href === 'string' ? tag.attributes.href : undefined);
      }
      return data;
    });
  });
}

/** HTML hooks keep non-stylesheet slots and tag objects intact. */
export function orderGssStylesheets<T>(tags: T[], stylesheetHref: (tag: T) => string | undefined): void {
  const slots = tags.flatMap((tag, index) => stylesheetHref(tag) !== undefined ? [index] : []);
  const links = slots.map(index => tags[index]!);
  const isGss = (tag: T) => gssCssAsset.test(stylesheetHref(tag)!.split(/[?#]/)[0]!);
  links.sort((a, b) => Number(isGss(a)) - Number(isGss(b)));
  slots.forEach((slot, index) => { tags[slot] = links[index]!; });
}
