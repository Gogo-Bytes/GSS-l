import { readFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, posix, relative, resolve } from 'node:path';
import { discoverStylesheetAssets } from '@gss-l/compiler';
import { normalizePath, type Rollup } from 'vite';

/** Serializable snapshots travel with Rollup's cached virtual Modules, not with generated JS. */
export type ProductionAsset = {
  url: string;
  identity: string;
  path: string;
  name: string;
  contents: string;
  suffix: string;
  publicPath: string | null;
};
export type ProductionStylesheet = { source: string; assets: ProductionAsset[] };

export async function readProductionAssets(
  id: string, source: string, projectRoot: string, publicDir: string, watch: (path: string) => void
): Promise<ProductionAsset[]> {
  const discovery = discoverStylesheetAssets({ id, source });
  // Let replaceStylesheet report the original structured parse diagnostics.
  if (discovery.diagnostics.some(({ severity }) => severity === 'error')) return [];
  const assets: ProductionAsset[] = [];
  for (const url of discovery.urls) {
    if (/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(url)) continue;
    const split = url.search(/[?#]/);
    const pathname = split < 0 ? url : url.slice(0, split);
    const suffix = split < 0 ? '' : url.slice(split);
    const publicPath = pathname.startsWith('/') ? posix.normalize(decodeURIComponent(pathname)) : null;
    if (publicPath !== null && !publicDir) throw new Error(`Cannot read GSS asset ${url}: publicDir is disabled.`);
    const requested = normalizePath(publicPath === null
      ? resolve(dirname(id), decodeURIComponent(pathname))
      : resolve(publicDir, `.${publicPath}`));
    const publicRelative = normalizePath(relative(publicDir, requested));
    if (publicPath !== null && (publicRelative === '..' || publicRelative.startsWith('../') || isAbsolute(publicRelative))) {
      throw new Error(`GSS public asset escapes publicDir: ${url}.`);
    }
    watch(requested);
    try {
      const path = normalizePath(await realpath(requested));
      watch(path);
      const logicalPath = normalizePath(relative(projectRoot, path));
      if (publicPath === null && isAbsolute(logicalPath)) throw new Error('Cannot derive a project-relative Asset identity.');
      const identity = publicPath === null
        ? ['file', logicalPath, suffix] : ['public', publicPath, suffix];
      assets.push({ url, identity: JSON.stringify(identity), publicPath,
        path, name: basename(path), suffix, contents: (await readFile(path)).toString('base64') });
    } catch (cause) {
      throw new Error(`Cannot read GSS asset ${url} from ${id}.`, { cause });
    }
  }
  return assets;
}

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

export function emitProductionAssets(context: Rollup.PluginContext, assets: readonly ProductionAsset[], base: string) {
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
