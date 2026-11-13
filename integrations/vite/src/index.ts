import { readFile, realpath } from 'node:fs/promises';
import { posix } from 'node:path';
import {
  createGssCompilerSession,
  type GssCompilerSession,
  type GssCompilerConfig,
  type GssSourceAdapter,
  type ReplaceStylesheetResult
} from '@gss-l/compiler';
import { isFileLoadingAllowed, normalizePath, type EnvironmentModuleNode, type HtmlTagDescriptor, type Plugin, type Rollup, type ViteDevServer } from 'vite';
import { CENTRAL_CSS_URL, LINKED_CSS_URL, STYLESHEET_URL_IMPORT, STYLESHEET_URL_ID, fromVirtualGssId, resolveCentralCssId, toVirtualGssId } from './virtual-id.js';
import { hasCentralStylesheet } from './central-html.js';
import { createDevCssOwner } from './dev-css.js';
import { emitProductionSnapshot, emitProductionMetadata, linkProductionStylesheet } from './production-output.js';
import { reachableModuleIds } from './production-census.js';
import { emitProductionAssets, isProductionStylesheet, type ProductionStylesheet } from './production-assets.js';
import { readStylesheetAssets, type StylesheetAsset } from './stylesheet-assets.js';
import { createDevAssetOwner } from './dev-assets.js';
import { reportDiagnostics } from './diagnostics.js';
import { resolveViteCssTargets } from './css-targets.js';

export type GssOptions = { adapter: GssSourceAdapter };

const HANDOFF_URL = '/@gss-l/atom-handoff.js';
const STYLESHEET_META = 'gss-l:stylesheet';

export function gss({ adapter }: GssOptions): Plugin[] {
  if (!adapter) throw new Error('gss({ adapter }) requires an explicit framework Adapter.');
  let session: GssCompilerSession;
  let projectRoot = '';
  let publicDir = '';
  let compatibilityStages: GssCompilerConfig['compatibilityTargetStages'];
  let compatibilityError: string | undefined;
  const newSession = () => createGssCompilerSession({ projectRoot,
    ...(compatibilityStages ? { compatibilityTargetStages: compatibilityStages } : {}) });
  let development = false;
  let devServer: ViteDevServer | undefined;
  let centralCssHref = CENTRAL_CSS_URL;
  let base = '/';
  let stylesheetReference: string | undefined;
  let explicitSnapshot: ReturnType<typeof emitProductionSnapshot> | undefined;
  let cssOwner: ReturnType<typeof createDevCssOwner> | undefined;
  let assetOwner: ReturnType<typeof createDevAssetOwner> | undefined;
  const trackedStylesheets = new Set<string>();
  const sourceDependencies = new Map<string, Set<string>>();
  const retiredImportLists = new WeakSet<EnvironmentModuleNode['importedModules']>();
  const cachedStylesheets = new Set<string>();
  const devAssets = new Map<string, StylesheetAsset[]>();
  const assetDependencies = new Map<string, Set<string>>();
  const failedReplacements = new Set<string>();
  type Replacement = { result: Promise<(ReplaceStylesheetResult & ProductionStylesheet) | undefined> };
  const latest = new Map<string, Replacement>();

  function readDevSnapshot() {
    const resolveAssetUrl = assetOwner?.resolve(devAssets.values());
    return session.finalize(resolveAssetUrl ? { resolveAssetUrl } : undefined);
  }

  function discardStylesheet(id: string) {
    latest.set(id, { result: Promise.resolve(undefined) });
    session.invalidate(id);
    devAssets.delete(id);
    assetDependencies.delete(id);
    failedReplacements.delete(id);
  }

  function hasSourceImporter(id: string) {
    for (const dependencies of sourceDependencies.values()) {
      if (dependencies.has(id)) return true;
    }
    return false;
  }

  // The adapter runs before Vite resolves all of the importer's other imports.
  // Keep its previous dependencies until the host accepts this version of the source.
  function finishSourceImports(id: string, next: Set<string>) {
    const previous = sourceDependencies.get(id);
    if (!previous) return;
    const removed = [...previous].filter((dependency) => !next.has(dependency));
    if (!removed.length) return;
    const client = devServer?.environments.client;
    const module = client?.moduleGraph.getModuleById(id);
    if (!client || !module) return;
    const priorEdges = module.importedModules;
    // Join the current request without awaiting it inside its own transform hook.
    void client.transformRequest(module.url).then((result) => {
      if (!result || module.transformResult !== result || sourceDependencies.get(id) !== previous) return;
      // Vite 7 skips updating its graph when the new JS has no imports at all.
      // Ignore that obsolete edge list only while the module still holds the same list.
      if (!next.size && module.importedModules === priorEdges) retiredImportLists.add(priorEdges);
      if (next.size) sourceDependencies.set(id, next);
      else sourceDependencies.delete(id);
      for (const dependency of removed) {
        if (hasSourceImporter(dependency)) continue;
        const virtual = client.moduleGraph.getModuleById(toVirtualGssId(dependency));
        // Vite 8 can list the virtual module as its own importer after a hot update.
        // Only another module can keep this stylesheet reachable.
        if (virtual && [...virtual.importers].some((importer) =>
          importer !== virtual && !retiredImportLists.has(importer.importedModules))) continue;
        discardStylesheet(dependency);
        trackedStylesheets.delete(dependency);
      }
      cssOwner?.publish();
    }, () => { /* A failed importer keeps the previous successful contribution. */ });
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
        if (compatibilityError) throw new Error(`GSS cannot follow Vite CSS targets: ${compatibilityError}`);
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
    reportDiagnostics(context, result.diagnostics.filter(({ severity }) => development || severity === 'error'), { id: physicalId, source: result.source });
    if (!result.committed || !result.module) context.error('GSS compilation failed.');
    return { artifact: result.module, source: result.source, assets: result.assets };
  }

  function stylesheetUrlModule(context: Rollup.PluginContext): string {
    if (development) return `export default ${JSON.stringify(`${base}${LINKED_CSS_URL.slice(1)}`)};`;
    // Native forward reference: Rolldown cannot defer an emitted asset's source.
    stylesheetReference ??= context.emitFile({ type: 'asset', name: 'gss-url-placeholder', source: '' });
    return `export default import.meta.ROLLUP_FILE_URL_${stylesheetReference};`;
  }

  function emitSnapshot(context: Rollup.PluginContext, bundle: Rollup.OutputBundle, deferMetadata = false) {
    // Replay only the final graph's source snapshots, including Rollup-cached Modules.
    // Do not read files here: CSS must match the JavaScript generated for this build.
    session = newSession();
    let count = 0;
    if (compatibilityError && reachableModuleIds(context).some((id) => fromVirtualGssId(id))) {
      context.error(`GSS cannot follow Vite CSS targets: ${compatibilityError}`);
    }
    const assets: StylesheetAsset[] = [];
    for (const id of reachableModuleIds(context)) {
      const physicalId = fromVirtualGssId(id);
      const info = context.getModuleInfo(id);
      if (!physicalId || info?.isExternal) continue;
      const metadata: unknown = info?.meta[STYLESHEET_META];
      if (!isProductionStylesheet(metadata)) context.error(`Missing GSS source snapshot for ${physicalId}.`);
      assets.push(...metadata.assets);
      const result = session.replaceStylesheet({ id: physicalId, source: metadata.source, assetReferences: metadata.assets });
      reportDiagnostics(context, result.diagnostics, { id: physicalId, source: metadata.source });
      if (!result.committed) context.error('GSS census compilation failed.');
      count += 1;
    }
    if (count === 0 && !stylesheetReference) return;
    const resolveAssetUrl = emitProductionAssets(context, assets, base);
    return emitProductionSnapshot(context, bundle, (cssFileName) =>
      session.finalize({ resolveAssetUrl: resolveAssetUrl(cssFileName) }), base, deferMetadata);
  }

  const plugin: Plugin = {
    name: 'gss-l',
    enforce: 'pre',
    async configResolved(config) {
      development = config.command === 'serve';
      base = config.base;
      centralCssHref = `${base}${CENTRAL_CSS_URL.slice(1)}`;
      projectRoot = normalizePath(await realpath(config.root));
      publicDir = config.publicDir;
      const compatibility = resolveViteCssTargets(config);
      compatibilityStages = compatibility.stages;
      compatibilityError = compatibility.error;
      session = newSession();
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
      session = newSession();
      stylesheetReference = undefined;
      explicitSnapshot = undefined;
      latest.clear();
      trackedStylesheets.clear();
      sourceDependencies.clear();
      cachedStylesheets.clear();
    },
    shouldTransformCachedModule({ id }) {
      if (id === STYLESHEET_URL_ID) return true;
      if (!development && fromVirtualGssId(id)) {
        cachedStylesheets.add(id);
        return true;
      }
    },
    renderStart() {
      if (development || !stylesheetReference) return;
      // Wait for the full graph, including lazy Modules, before finalizing the href asset.
      explicitSnapshot = emitSnapshot(this, {}, true);
    },
    resolveFileUrl({ referenceId, chunkId }) {
      if (referenceId !== stylesheetReference || !explicitSnapshot) return null;
      const fileName = explicitSnapshot.cssAsset;
      const relativePath = posix.relative(posix.dirname(chunkId), fileName);
      if (base === '' || base === './') {
        return `new URL(${JSON.stringify(relativePath)}, import.meta.url).href`;
      }
      return JSON.stringify(base + fileName.split('/').map(encodeURIComponent).join('/'));
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        if (development) return;
        if (explicitSnapshot) {
          emitProductionMetadata(this, bundle, explicitSnapshot.metadata);
          linkProductionStylesheet(bundle, explicitSnapshot.cssAsset, base);
        } else emitSnapshot(this, bundle);
      }
    },
    configureServer(server) {
      devServer = server;
      assetOwner = createDevAssetOwner(server);
      cssOwner = createDevCssOwner(server, readDevSnapshot);
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
          if (result) reportDiagnostics(this, result.diagnostics, { id: owner, source: result.source });
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
      if (context.type === 'delete' && hasSourceImporter(physicalId) && session.getScopeSchema(physicalId)) {
        // Cancel older work, retain the delivered CSS/exports, and let Vite report the failure
        // without propagating a JS update that would reload the already mounted page.
        latest.set(physicalId, { result: Promise.resolve(undefined) });
        assetDependencies.delete(physicalId); // Its source must return before asset edits can recompile it.
        failedReplacements.add(physicalId);
        this.error({ id: physicalId, message: `Referenced GSS stylesheet is missing: ${physicalId}` });
      }
      if (context.type === 'delete') {
        discardStylesheet(physicalId);
        cssOwner?.publish();
      } else {
        const before = JSON.stringify(session.getScopeSchema(physicalId));
        const task = startReplacement(physicalId, context.read);
        const result = await task.result;
        if (latest.get(physicalId) !== task) return [];
        if (result) reportDiagnostics(this, result.diagnostics, { id: physicalId, source: result.source });
        // Native CSS publication also clears errors on identical-byte recovery.
        // Only changed scope JavaScript needs propagation through its importers.
        if (result?.committed && before === JSON.stringify(session.getScopeSchema(physicalId))) return [];
      }
      for (const module of modules) graph.invalidateModule(module, new Set(), context.timestamp, true);
      return [...modules];
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        if (!development || hasCentralStylesheet(html, centralCssHref) ||
          hasCentralStylesheet(html, `${base}${LINKED_CSS_URL.slice(1)}`)) return html;
        const tags: HtmlTagDescriptor[] = [{
          tag: 'link',
          attrs: { rel: 'stylesheet', href: centralCssHref, 'data-gss-dev': '' },
          injectTo: 'head'
        }];
        if (devServer?.config.server.hmr !== false) tags.push({ tag: 'script',
          attrs: { type: 'module', src: base + HANDOFF_URL.slice(1) }, injectTo: 'head' });
        return tags;
      }
    },
    async resolveId(source, importer) {
      if (development && source === HANDOFF_URL) return HANDOFF_URL;
      if (source === STYLESHEET_URL_IMPORT || source === STYLESHEET_URL_ID) return STYLESHEET_URL_ID;
      if (development && resolveCentralCssId(source)) return resolveCentralCssId(source);
      if (fromVirtualGssId(source)) return source;
      if (!source.endsWith('.gss') || source.startsWith('\0')) return null;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (!resolved || resolved.external) return null;
      return toVirtualGssId(normalizePath(await realpath(resolved.id)));
    },
    async load(id) {
      if (id === STYLESHEET_URL_ID) return stylesheetUrlModule(this);
      if (development && id === HANDOFF_URL) return readFile(new URL('./dev-handoff-client.js', import.meta.url), 'utf8');
      if (development && resolveCentralCssId(id)) return readDevSnapshot().css;
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
      if (id === STYLESHEET_URL_ID) return { code: stylesheetUrlModule(this), map: null };
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
      const clientSource = development && this.environment.name === 'client';
      if (imports.length === 0) {
        if (clientSource) finishSourceImports(id, new Set());
        return null;
      }
      const dependencies = new Map<string, string>();
      for (const importId of new Set(imports)) {
        const resolved = await this.resolve(importId, id, { skipSelf: false });
        const physicalId = resolved && !resolved.external ? fromVirtualGssId(resolved.id) : undefined;
        if (!physicalId) this.error(`Cannot resolve GSS dependency ${importId} from ${id}.`);
        this.addWatchFile(physicalId);
        if (clientSource) {
          const watched = sourceDependencies.get(id) ?? new Set<string>();
          watched.add(physicalId);
          sourceDependencies.set(id, watched);
        }
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
      reportDiagnostics(this, result.diagnostics, { id, source });
      if (clientSource) finishSourceImports(id, new Set(dependencies.values()));
      return { code: result.code, ...(result.map ? { map: JSON.stringify(result.map) } : {}) };
    }
  };
  return [plugin, {
    name: 'gss-l:stylesheet-url-output',
    generateBundle: {
      order: 'pre',
      handler(_options, bundle) {
        if (!explicitSnapshot) return;
        // Remove speculative outputs before native manifests inspect the asset graph.
        if (stylesheetReference) {
          const placeholder = this.getFileName(stylesheetReference);
          const referenceAsset = bundle[placeholder];
          if (referenceAsset?.type === 'asset' && referenceAsset.names.every((name) => name === 'gss-url-placeholder') &&
            referenceAsset.originalFileNames.length === 0) delete bundle[placeholder];
          for (const entry of Object.values(bundle)) {
            if (entry.type === 'chunk' && entry.referencedFiles) {
              entry.referencedFiles = [...new Set(entry.referencedFiles.flatMap((file) =>
                file !== placeholder ? [file] : bundle[placeholder]
                  ? [file, explicitSnapshot!.cssAsset] : [explicitSnapshot!.cssAsset]))];
            }
          }
        }
        for (const file of explicitSnapshot.discarded) {
          const entry = bundle[file];
          if (file !== explicitSnapshot.cssAsset && entry?.type === 'asset' &&
            entry.names.every((name) => name === 'gss.css') && entry.originalFileNames.length === 0) delete bundle[file];
        }
      }
    }
  }];
}
