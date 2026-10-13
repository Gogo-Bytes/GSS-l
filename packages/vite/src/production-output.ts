import { posix } from 'node:path';
import type { FinalizedGssSnapshot } from '@gss-l/compiler';
import type { Rollup } from 'vite';
import { injectCentralStylesheet } from './central-html.js';

export function emitProductionSnapshot(
  context: Rollup.PluginContext,
  bundle: Rollup.OutputBundle,
  render: (cssFileName: string) => FinalizedGssSnapshot,
  base: string
): void {
  const mapAsset = 'gss.css.map';
  const linkedCss = (css: string, cssFileName: string) => {
    if (!css) return css;
    const relative = posix.relative(posix.dirname(cssFileName || 'gss.css'), mapAsset);
    const url = relative.split('/').map(encodeURIComponent).join('/');
    return `${css}\n/*# sourceMappingURL=${url.startsWith('../') ? url : `./${url}`} */`;
  };
  // Start relative to the output root, before a concrete CSS filename exists.
  let snapshot = render('');
  let cssAsset: string | undefined;
  let cssPath = 'gss.css';
  // CSS-relative URLs and assetFileNames must agree, including hash-dependent directories.
  // Discard only our own candidates; never delete another plugin's deduplicated asset.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const existing = new Set(Object.keys(bundle));
    const emittedCss = linkedCss(snapshot.css, cssPath);
    const reference = context.emitFile({ type: 'asset', name: 'gss.css', source: emittedCss });
    const candidate = context.getFileName(reference);
    const next = render(candidate);
    if (linkedCss(next.css, candidate) === emittedCss) {
      cssAsset = candidate;
      snapshot = next;
      break;
    }
    if (!existing.has(candidate)) delete bundle[candidate];
    cssPath = candidate;
    snapshot = next;
  }
  if (cssAsset === undefined) context.error('Cannot stabilize GSS CSS asset URL paths.');
  if (snapshot.css) {
    if (bundle[mapAsset]) context.error(`GSS output ${mapAsset} already exists.`);
    context.emitFile({ type: 'asset', fileName: mapAsset,
      source: JSON.stringify({ ...snapshot.sourceMap, file: cssAsset }) + '\n' });
  }
  for (const [fileName, compiler] of [
    ['gss-manifest.json', snapshot.manifest],
    ['gss-report.json', snapshot.report]
  ] as const) {
    if (bundle[fileName]) context.error(`GSS output ${fileName} already exists.`);
    context.emitFile({
      type: 'asset', fileName,
      source: JSON.stringify({ version: fileName === 'gss-manifest.json' ? 2 : 1,
        cssAsset, compiler }, null, 2) + '\n'
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
