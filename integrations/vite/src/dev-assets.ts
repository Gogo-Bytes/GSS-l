import { createHash } from 'node:crypto';
import { lookup } from 'mrmime';
import { isFileLoadingAllowed, send, type ViteDevServer } from 'vite';
import type { StylesheetAsset } from './stylesheet-assets.js';

/** Already-resolved byte snapshots bypass Vite's second CSS URL resolution/automatic SVG inlining. */
export function createDevAssetOwner(server: ViteDevServer) {
  const prefix = `${server.config.base}@gss-l/assets/`;
  let current = new Map<string, StylesheetAsset>();
  let previous = new Map<string, StylesheetAsset>();
  let retirement: ReturnType<typeof setTimeout> | undefined;
  let disposed = false;

  return {
    // Install after Vite's host/CORS/base middleware, before its HTML transform middleware.
    install() {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.originalUrl ?? request.url ?? '/', 'http://gss.invalid').pathname;
        if (!pathname.startsWith(prefix)) return next();
        const token = pathname.slice(prefix.length).split('/')[0]!;
        const asset = disposed ? undefined : current.get(token) ?? previous.get(token);
        if (!asset) { response.statusCode = 404; response.end(); return; }
        if (!isFileLoadingAllowed(server.config, asset.path)) { response.statusCode = 403; response.end(); return; }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          response.statusCode = 405; response.end(); return;
        }
        send(request, response, Buffer.from(asset.contents, 'base64'), lookup(asset.name) ?? 'application/octet-stream', {
          etag: `"${token}"`, cacheControl: 'no-cache',
          headers: { ...server.config.server.headers, 'X-Content-Type-Options': 'nosniff' }
        });
      });
    },
    resolve(assets: Iterable<StylesheetAsset[]>) {
      const next = new Map<string, StylesheetAsset>();
      const urls = new Map<string, string>();
      for (const contribution of assets) for (const asset of contribution) {
        const token = createHash('sha256').update(JSON.stringify([asset.identity, asset.path, asset.contents])).digest('hex');
        next.set(token, asset);
        const fragmentAt = asset.suffix.indexOf('#');
        const query = fragmentAt < 0 ? asset.suffix : asset.suffix.slice(0, fragmentAt);
        const fragment = fragmentAt < 0 ? '' : asset.suffix.slice(fragmentAt);
        urls.set(asset.identity, `${prefix}${token}/${encodeURIComponent(asset.name)}${query}${query ? '&' : '?'}gss-v=${token}${fragment}`);
      }
      if (next.size !== current.size || [...next.keys()].some((key) => !current.has(key))) {
        previous = current;
        current = next;
        clearTimeout(retirement);
        // One bounded prior generation lets in-flight CSS link replacements finish.
        retirement = setTimeout(() => previous.clear(), 30000);
        retirement.unref();
      }
      return (identity: string) => {
        const url = urls.get(identity);
        if (!url) throw new Error(`Missing dev GSS Asset ${identity}.`);
        return url;
      };
    },
    dispose() {
      disposed = true;
      clearTimeout(retirement);
      current.clear();
      previous.clear();
    }
  };
}
