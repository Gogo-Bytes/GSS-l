import { posix } from 'node:path';
import type { FinalizedGssSnapshot } from '@gss-l/compiler';
import type { Rollup } from 'vite';
import { injectCentralStylesheet } from './central-html.js';

export function emitProductionSnapshot(
  context: Rollup.PluginContext,
  bundle: Rollup.OutputBundle,
  snapshot: FinalizedGssSnapshot,
  base: string
): void {
  const reference = context.emitFile({ type: 'asset', name: 'gss.css', source: snapshot.css });
  const cssAsset = context.getFileName(reference);
  for (const [fileName, compiler] of [
    ['gss-manifest.json', snapshot.manifest],
    ['gss-report.json', snapshot.report]
  ] as const) {
    if (bundle[fileName]) context.error(`GSS output ${fileName} already exists.`);
    context.emitFile({
      type: 'asset', fileName,
      source: JSON.stringify({ version: 1, cssAsset, compiler }, null, 2) + '\n'
    });
  }
  for (const entry of Object.values(bundle)) {
    if (entry.type !== 'asset' || !entry.fileName.endsWith('.html')) continue;
    const html = typeof entry.source === 'string' ? entry.source : new TextDecoder().decode(entry.source);
    const relativeBase = base === '' || base === './';
    const assetPath = relativeBase ? posix.relative(posix.dirname(entry.fileName), cssAsset) : cssAsset;
    const encodedPath = assetPath.split('/').map(encodeURIComponent).join('/');
    const href = relativeBase
      ? (encodedPath.startsWith('../') ? encodedPath : `./${encodedPath}`)
      : base + encodedPath;
    entry.source = injectCentralStylesheet(html, href);
  }
}
