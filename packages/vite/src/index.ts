import { readFile, realpath } from 'node:fs/promises';
import {
  createGssCompilerSession,
  type GssCompilerSession,
  type GssSourceAdapter,
  type ReplaceStylesheetResult,
  type SourceAdapterDiagnostic
} from '@gss-l/compiler';
import { isFileLoadingAllowed, normalizePath, type Plugin, type Rollup, type ViteDevServer } from 'vite';
import { CENTRAL_CSS_URL, fromVirtualGssId, resolveCentralCssId, toVirtualGssId } from './virtual-id.js';
import { hasCentralStylesheet } from './central-html.js';
import { createDevCssOwner } from './dev-css.js';
import { emitProductionSnapshot } from './production-output.js';
import { reachableModuleIds } from './production-census.js';
import { emitProductionAssets, isProductionStylesheet, type ProductionStylesheet } from './production-assets.js';
import { readStylesheetAssets, type StylesheetAsset } from './stylesheet-assets.js';
import { createDevAssetOwner } from './dev-assets.js';

export type GssOptions = { adapter: GssSourceAdapter };

const STYLESHEET_META = 'gss-l:stylesheet';

export function gss({ adapter }: GssOptions): Plugin {
  if (!adapter) throw new Error('gss({ adapter }) requires an explicit framework Adapter.');
  let session: GssCompilerSession;
  let projectRoot = '';
  let publicDir = '';
  let development = false;
  let devServer: ViteDevServer | undefined;
  let centralCssHref = CENTRAL_CSS_URL;
  let base = '/';
  let cssOwner: ReturnType<typeof createDevCssOwner> | undefined;
  let assetOwner: ReturnType<typeof createDevAssetOwner> | undefined;
  const trackedStylesheets = new Set<string>();
  const sourceDependencies = new Map<string, Set<string>>();
  const cachedStylesheets = new Set<string>();
  const devAssets = new Map<string, StylesheetAsset[]>();
  const assetDependencies = new Map<string, Set<string>>();
  const failedReplacements = new Set<string>();
  type Replacement = { result: Promise<(ReplaceStylesheetResult & ProductionStylesheet) | undefined> };
  const latest = new Map<string, Replacement>();

  function readDevCss() {
    const resolveAssetUrl = assetOwner?.resolve(devAssets.values());
    return session.finalize(resolveAssetUrl ? { resolveAssetUrl } : undefined).css;
  }

  function startReplacement(physicalId: string, read: () => string | Promise<string>, watch?: (path: string) => void): Replacement {
    trackedStylesheets.add(physicalId);
    // The task identity is a per-physical-file generation, including deletion tombstones.
    const task: Replacement = { result: Promise.resolve(undefined) };
    latest.set(physicalId, task);
    task.result = (async () => {
      let source: string;
      let assets: StylesheetAsset[] = [];
      const paths = new Set<string>();
      try {
        if (devServer && !isFileLoadingAllowed(devServer.config, physicalId)) {
          throw new Error(`Vite denied GSS file access: ${physicalId}`);
        }
        source = await read();
        assets = await readStylesheetAssets(physicalId, source, projectRoot, publicDir, (path) => {
          if (latest.get(physicalId) !== task) return;
          paths.add(path);
          if (development) {
            assetDependencies.set(physicalId, new Set([...(assetDependencies.get(physicalId) ?? []), path]));
            devServer?.watcher.add(path);
          }
          if (!development) watch?.(path);
        }, (path) => {
          if (devServer && !isFileLoadingAllowed(devServer.config, path)) throw new Error(`Vite denied GSS asset access: ${path}`);
        });
      } catch (error) {
        if (latest.get(physicalId) === task) {
          if (development) failedReplacements.add(physicalId);
          throw error;
        }
        return undefined;
      }
      if (latest.get(physicalId) !== task) return undefined;
      const result = session.replaceStylesheet({ id: physicalId, source, assetReferences: assets.map(({ url, identity }) => ({ url, identity })) });
      if (!result.committed && development) failedReplacements.add(physicalId);
      if (result.committed && development) {
        // Latest successful contribution wins shared URL versions; failed attempts retain prior URLs.
        devAssets.delete(physicalId);
        devAssets.set(physicalId, assets);
        assetDependencies.set(physicalId, paths);
        cssOwner?.publish(failedReplacements.delete(physicalId));
      }
      return { ...result, source, assets };
    })();
    return task;
  }

  async function compile(context: Rollup.PluginContext, physicalId: string) {
    let task = startReplacement(physicalId, () => readFile(physicalId, 'utf8'), (path) => context.addWatchFile(path));
    let result = await task.result;
    // Concurrent consumers follow the newest result, never the last-known-good on failure.
    while (latest.get(physicalId) !== task) {
      const next = latest.get(physicalId);
      if (!next) context.error('GSS session was reset during compilation.');
      task = next;
      result = await task.result;
    }
    if (!result) context.error(`GSS stylesheet was invalidated: ${physicalId}`);
    reportDiagnostics(context, result.diagnostics.filter(({ severity }) => development || severity === 'error'));
    if (!result.committed || !result.module) context.error('GSS compilation failed.');
    return { artifact: result.module, source: result.source, assets: result.assets };
  }

  return {
    name: 'gss-l',
    enforce: 'pre',
    async configResolved(config) {
      development = config.command === 'serve';
      base = config.base;
      centralCssHref = `${base}${CENTRAL_CSS_URL.slice(1)}`;
      projectRoot = normalizePath(await realpath(config.root));
      publicDir = config.publicDir;
      session = createGssCompilerSession({ projectRoot });
      trackedStylesheets.clear();
      sourceDependencies.clear();
      latest.clear();
      cachedStylesheets.clear();
      devAssets.clear();
      assetDependencies.clear();
      failedReplacements.clear();
      cssOwner?.dispose();
      assetOwner?.dispose();
      assetOwner = undefined;
      cssOwner = undefined;
      devServer = undefined;
    },
    buildStart() {
      if (development) return;
      session = createGssCompilerSession({ projectRoot });
      latest.clear();
      trackedStylesheets.clear();
      sourceDependencies.clear();
      cachedStylesheets.clear();
    },
    shouldTransformCachedModule({ id }) {
      if (!development && fromVirtualGssId(id)) {
        cachedStylesheets.add(id);
        return true;
      }
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        if (development) return;
        // Replay only the final graph's source snapshots, including Rollup-cached Modules.
        // Do not read files here: CSS must match the JavaScript generated for this build.
        session = createGssCompilerSession({ projectRoot });
        let count = 0;
        const assets: StylesheetAsset[] = [];
        for (const id of reachableModuleIds(this)) {
          const physicalId = fromVirtualGssId(id);
          const info = this.getModuleInfo(id);
          if (!physicalId || info?.isExternal) continue;
          const metadata: unknown = info?.meta[STYLESHEET_META];
          if (!isProductionStylesheet(metadata)) this.error(`Missing GSS source snapshot for ${physicalId}.`);
          assets.push(...metadata.assets);
          const result = session.replaceStylesheet({ id: physicalId, source: metadata.source, assetReferences: metadata.assets });
          reportDiagnostics(this, result.diagnostics);
          if (!result.committed) this.error('GSS census compilation failed.');
          count += 1;
        }
        if (count === 0) return;
        const resolveAssetUrl = emitProductionAssets(this, assets, base);
        emitProductionSnapshot(this, bundle, (cssFileName) =>
          session.finalize({ resolveAssetUrl: resolveAssetUrl(cssFileName) }), base);
      }
    },
    configureServer(server) {
      devServer = server;
      assetOwner = createDevAssetOwner(server);
      cssOwner = createDevCssOwner(server, readDevCss);
      return assetOwner.install;
    },
    closeBundle() {
      cssOwner?.dispose();
      assetOwner?.dispose();
      latest.clear();
      trackedStylesheets.clear();
      sourceDependencies.clear();
      cachedStylesheets.clear();
      devAssets.clear();
      assetDependencies.clear();
      failedReplacements.clear();
    },
    async hotUpdate(context) {
      if (this.environment.name !== 'client') return;
      const physicalId = normalizePath(context.file);
      if (!trackedStylesheets.has(physicalId)) {
        const owners = [...assetDependencies].filter(([, paths]) => paths.has(physicalId)).map(([id]) => id);
        if (owners.length === 0) return;
        const graph = this.environment.moduleGraph;
        const changed = new Set<NonNullable<ReturnType<typeof graph.getModuleById>>>();
        for (const owner of owners) {
          const before = JSON.stringify(session.getScopeSchema(owner));
          const task = startReplacement(owner, () => readFile(owner, 'utf8'));
          const result = await task.result;
          if (latest.get(owner) !== task) continue;
          if (result) reportDiagnostics(this, result.diagnostics);
          if (before === JSON.stringify(session.getScopeSchema(owner))) continue;
          const virtual = graph.getModuleById(toVirtualGssId(owner));
          if (virtual) changed.add(virtual);
          for (const [sourceId, dependencies] of sourceDependencies) {
            if (!dependencies.has(owner)) continue;
            const source = graph.getModuleById(sourceId);
            if (source) changed.add(source);
          }
        }
        for (const module of changed) graph.invalidateModule(module, new Set(), context.timestamp, true);
        // Byte-only changes need the native CSS update already published, not JS propagation/reload.
        return [...changed];
      }
      const graph = this.environment.moduleGraph;
      const modules = new Set(context.modules);
      const virtual = graph.getModuleById(toVirtualGssId(physicalId));
      if (virtual) modules.add(virtual);
      for (const [sourceId, dependencies] of sourceDependencies) {
        if (!dependencies.has(physicalId)) continue;
        const source = graph.getModuleById(sourceId);
        if (source) modules.add(source);
      }
      for (const module of modules) graph.invalidateModule(module, new Set(), context.timestamp, true);
      if (context.type === 'delete') {
        latest.set(physicalId, { result: Promise.resolve(undefined) });
        session.invalidate(physicalId);
        devAssets.delete(physicalId);
        assetDependencies.delete(physicalId);
        failedReplacements.delete(physicalId);
        cssOwner?.publish();
      } else {
        const task = startReplacement(physicalId, context.read);
        const result = await task.result;
        if (latest.get(physicalId) !== task) return [];
        if (result) reportDiagnostics(this, result.diagnostics);
      }
      return [...modules];
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!development || hasCentralStylesheet(html, centralCssHref)) return html;
        return [{
          tag: 'link',
          attrs: { rel: 'stylesheet', href: centralCssHref, 'data-gss-dev': '' },
          injectTo: 'head'
        }];
      }
    },
    async resolveId(source, importer) {
      if (development && resolveCentralCssId(source)) return resolveCentralCssId(source);
      if (fromVirtualGssId(source)) return source;
      if (!source.endsWith('.gss') || source.startsWith('\0')) return null;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (!resolved || resolved.external) return null;
      return toVirtualGssId(normalizePath(await realpath(resolved.id)));
    },
    async load(id) {
      if (development && resolveCentralCssId(id)) return readDevCss();
      const physicalId = fromVirtualGssId(id);
      if (!physicalId) return null;
      this.addWatchFile(physicalId);
      const { artifact, source, assets } = await compile(this, physicalId);
      return development ? artifact.moduleCode : {
        code: artifact.moduleCode,
        meta: { [STYLESHEET_META]: { source, assets } }
      };
    },
    async transform(source, id) {
      const physicalId = fromVirtualGssId(id);
      if (physicalId && cachedStylesheets.delete(id)) {
        this.addWatchFile(physicalId);
        const compiled = await compile(this, physicalId);
        return {
          code: compiled.artifact.moduleCode,
          meta: { [STYLESHEET_META]: { source: compiled.source, assets: compiled.assets } }
        };
      }
      if (!adapter.supports(id)) return null;
      const imports = adapter.discoverImports({ id, source });
      if (imports.length === 0) {
        sourceDependencies.delete(id);
        return null;
      }
      const dependencies = new Map<string, string>();
      for (const importId of new Set(imports)) {
        const resolved = await this.resolve(importId, id, { skipSelf: false });
        const physicalId = resolved && !resolved.external ? fromVirtualGssId(resolved.id) : undefined;
        if (!physicalId) this.error(`Cannot resolve GSS dependency ${importId} from ${id}.`);
        this.addWatchFile(physicalId);
        const watched = sourceDependencies.get(id) ?? new Set<string>();
        watched.add(physicalId);
        sourceDependencies.set(id, watched);
        await compile(this, physicalId);
        dependencies.set(importId, physicalId);
      }
      const result = adapter.transform({
        id,
        source,
        resolveScopeSchema(importId) {
          const physicalId = dependencies.get(importId);
          return physicalId ? session.getScopeSchema(physicalId) : undefined;
        }
      });
      reportDiagnostics(this, result.diagnostics);
      sourceDependencies.set(id, new Set(dependencies.values()));
      return { code: result.code, ...(result.map ? { map: JSON.stringify(result.map) } : {}) };
    }
  };
}

function reportDiagnostics(
  context: Rollup.MinimalPluginContext,
  diagnostics: readonly SourceAdapterDiagnostic[]
): void {
  for (const diagnostic of diagnostics) {
    const log = { ...diagnostic, message: `[${diagnostic.code}] ${diagnostic.message}` };
    if (diagnostic.severity === 'error') context.error(log);
    else if (diagnostic.severity === 'warning') context.warn(log);
    else context.info(log);
  }
}
