import type {
  Compiler, LightningCssMinimizerRspackPluginOptions, LightningcssLoaderOptions,
  RuleSetRule, RuleSetUse, RuleSetUseItem
} from '@rspack/core';

export const GSS_CSS_CHUNK = 'gss-l';
const gssCssAsset = /(?:^|\/)gss-l(?:\.[^/]*)?\.css$/;

function preserveLogical<T extends LightningcssLoaderOptions>(options: T): T {
  return { ...options, include: { ...options.include, logicalProperties: false },
    exclude: { ...options.exclude, logicalProperties: true } };
}

/** Internal bridge: the host passes its effective options, including targets. No target discovery. */
export function isolatedCssMinimizers(options: LightningCssMinimizerRspackPluginOptions = {}) {
  const gss: LightningCssMinimizerRspackPluginOptions = { ...options, test: gssCssAsset,
    minimizerOptions: preserveLogical(options.minimizerOptions ?? {}) };
  delete gss.include;
  delete gss.exclude;
  return [gss,
    { ...options, exclude: [...(Array.isArray(options.exclude) ? options.exclude : options.exclude ? [options.exclude] : []), gssCssAsset] }
  ];
}

/** Preserve the host's use callbacks and all unrelated loader options. */
export function isolateCssLoaders(rules: readonly (RuleSetRule | false | null | undefined | '' | 0 | '...')[], aggregateId: string): void {
  const adapt = (item: RuleSetUseItem): RuleSetUseItem => {
    if (!item) return item;
    const loader = typeof item === 'string' ? item : item.loader;
    if (loader !== 'builtin:lightningcss-loader') return item;
    const options = typeof item === 'string' ? {} : item.options ?? {};
    if (typeof options !== 'object') throw new Error('GSS CSS isolation requires object Lightning CSS loader options.');
    return { ...(typeof item === 'string' ? { loader } : item),
      ...(typeof item !== 'string' && item.ident ? { ident: `${item.ident}:gss-logical` } : {}),
      options: preserveLogical(options) };
  };
  for (const rule of rules) {
    if (!rule || typeof rule !== 'object') continue;
    if (rule.loader) {
      Object.assign(rule, { use: { loader: rule.loader, ...(rule.options ? { options: rule.options } : {}) } });
      Reflect.deleteProperty(rule, 'loader');
      Reflect.deleteProperty(rule, 'options');
    }
    if (rule.use) {
      const original = rule.use;
      const scoped: RuleSetUse = info => {
        const use = typeof original === 'function' ? original(info) : original;
        if (info.resource?.split('?')[0] !== aggregateId) return use;
        return Array.isArray(use) ? use.map(adapt) : adapt(use);
      };
      rule.use = scoped;
    }
    if (rule.rules) isolateCssLoaders(rule.rules, aggregateId);
    if (rule.oneOf) isolateCssLoaders(rule.oneOf, aggregateId);
  }
}

/** Pair with isolatedCssMinimizers in the host configuration before creating the compiler. */
export function installCssIsolation(compiler: Compiler, aggregateId: string): void {
  isolateCssLoaders(compiler.options.module.rules, aggregateId);
  const previous = compiler.options.optimization.splitChunks;
  if (previous && previous.cacheGroups?.[GSS_CSS_CHUNK]) throw new Error('GSS CSS chunk name is already configured.');
  compiler.options.optimization.splitChunks = {
    ...(previous || {}),
    cacheGroups: {
      // Enabling the CSS-only group must not enable default JS splitting when the host disabled it.
      ...(!previous ? { default: false, defaultVendors: false } : previous.cacheGroups),
      [GSS_CSS_CHUNK]: { name: GSS_CSS_CHUNK, chunks: 'all', enforce: true, priority: 100,
        test: module => (module.type === 'css/mini-extract' || module.type === 'css') &&
          module.identifier().includes(aggregateId) }
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
    compiler.rspack.HtmlRspackPlugin.getCompilationHooks(compilation).alterAssetTagGroups.tap('GssCssIsolation', data => {
      // Aggregate CSS was appended after ordinary entry CSS before splitting. Preserve that order.
      for (const tags of [data.headTags, data.bodyTags]) {
        orderGssStylesheets(tags, tag => tag.tagName === 'link' && tag.attributes.rel === 'stylesheet' && typeof tag.attributes.href === 'string' ? tag.attributes.href : undefined);
      }
      return data;
    });
  });
}

/** Both native HTML and Rsbuild hooks keep non-stylesheet slots and tag objects intact. */
export function orderGssStylesheets<T>(tags: T[], stylesheetHref: (tag: T) => string | undefined): void {
  const slots = tags.flatMap((tag, index) => stylesheetHref(tag) !== undefined ? [index] : []);
  const links = slots.map(index => tags[index]!);
  const isGss = (tag: T) => gssCssAsset.test(stylesheetHref(tag)!.split(/[?#]/)[0]!);
  links.sort((a, b) => Number(isGss(a)) - Number(isGss(b)));
  slots.forEach((slot, index) => { tags[slot] = links[index]!; });
}
