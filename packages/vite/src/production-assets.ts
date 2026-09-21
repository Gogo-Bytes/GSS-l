import { posix } from 'node:path';
import type { Rollup } from 'vite';
import type { StylesheetAsset } from './stylesheet-assets.js';

/** Serializable snapshots travel with Rollup's cached virtual Modules, not with generated JS. */
export type ProductionStylesheet = { source: string; assets: StylesheetAsset[] };

export function isProductionStylesheet(value: unknown): value is ProductionStylesheet {
  if (!value || typeof value !== 'object' || !('source' in value) || typeof value.source !== 'string' ||
      !('assets' in value) || !Array.isArray(value.assets)) return false;
  return value.assets.every((asset: unknown) => {
    if (!asset || typeof asset !== 'object') return false;
    if (!('publicPath' in asset) || (asset.publicPath !== null && typeof asset.publicPath !== 'string')) return false;
    return ['url', 'identity', 'path', 'name', 'contents', 'suffix']
      .every((key) => key in asset && typeof Reflect.get(asset, key) === 'string');
  });
}

export function emitProductionAssets(context: Rollup.PluginContext, assets: readonly StylesheetAsset[], base: string) {
  const contents = new Map<string, string>();
  for (const asset of assets) {
    if (contents.has(asset.path) && contents.get(asset.path) !== asset.contents) {
      context.error(`Inconsistent GSS asset snapshot for ${asset.path}. Rebuild from stable inputs.`);
    }
    contents.set(asset.path, asset.contents);
  }
  const publicFiles = new Set(assets.flatMap((asset) => asset.publicPath === null ? [] : [asset.publicPath.slice(1)]));
  for (const name of ['gss-manifest.json', 'gss-report.json']) {
    if (publicFiles.has(name)) context.error(`GSS output ${name} collides with a referenced public resource.`);
  }
  const outputs = new Map<string, { fileName: string; suffix: string }>();
  for (const asset of assets) {
    if (outputs.has(asset.identity)) continue;
    const fileName = asset.publicPath !== null ? asset.publicPath.slice(1)
      : context.getFileName(context.emitFile({ type: 'asset', name: asset.name, source: Buffer.from(asset.contents, 'base64') }));
    if (asset.publicPath === null && publicFiles.has(fileName)) {
      context.error(`GSS asset output ${fileName} collides with a referenced public resource.`);
    }
    outputs.set(asset.identity, { fileName, suffix: asset.suffix });
  }
  return (cssFileName: string) => {
    if (publicFiles.has(cssFileName)) context.error(`GSS CSS output ${cssFileName} collides with a referenced public resource.`);
    return (identity: string) => {
      const output = outputs.get(identity);
      if (output === undefined) context.error(`Missing emitted GSS Asset ${identity}.`);
      const relativeBase = base === '' || base === './';
      const path = relativeBase ? posix.relative(posix.dirname(cssFileName), output.fileName) : output.fileName;
      const encoded = path.split('/').map(encodeURIComponent).join('/');
      const url = relativeBase ? (encoded.startsWith('../') ? encoded : `./${encoded}`) : base + encoded;
      return url + output.suffix;
    };
  };
}
