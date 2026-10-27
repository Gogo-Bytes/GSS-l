import { readFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, posix, relative, resolve } from 'node:path';
import { discoverStylesheetAssets } from '@gss-l/compiler';
import { normalizePath } from 'vite';

/** Host-owned bytes and references shared by dev delivery and Rollup source snapshots. */
export type StylesheetAsset = {
  url: string;
  identity: string;
  path: string;
  name: string;
  contents: string;
  suffix: string;
  publicPath: string | null;
};

export async function readStylesheetAssets(
  id: string, source: string, projectRoot: string, publicDir: string, watch: (path: string) => void,
  authorize?: (path: string) => void
): Promise<StylesheetAsset[]> {
  const discovery = discoverStylesheetAssets({ id, source });
  // Let replaceStylesheet report the original structured parse diagnostics.
  if (discovery.diagnostics.some(({ severity }) => severity === 'error')) return [];
  const assets: StylesheetAsset[] = [];
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
    authorize?.(requested);
    watch(requested);
    try {
      const path = normalizePath(await realpath(requested));
      authorize?.(path);
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
