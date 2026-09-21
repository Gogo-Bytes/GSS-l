import { readFile, realpath } from 'node:fs/promises';
import {
  createGssCompilerSession,
  type GssCompilerSession,
  type GssSourceAdapter,
  type ReplaceStylesheetResult,
  type SourceAdapterDiagnostic
} from '@gss-l/compiler';
import { isFileServingAllowed, normalizePath, type Plugin, type Rollup, type ViteDevServer } from 'vite';
import { CENTRAL_CSS_URL, fromVirtualGssId, resolveCentralCssId, toVirtualGssId } from './virtual-id.js';
import { hasCentralStylesheet } from './central-html.js';
import { createDevCssOwner } from './dev-css.js';
import { emitProductionSnapshot } from './production-output.js';
import { reachableModuleIds } from './production-census.js';

export type GssOptions = { adapter: GssSourceAdapter };

const STYLESHEET_META = 'gss-l:stylesheet';

export function gss({ adapter }: GssOptions): Plugin {
  if (!adapter) throw new Error('gss({ adapter }) requires an explicit framework Adapter.');
  let session: GssCompilerSession;
  let projectRoot = '';
  let development = false;
  let devServer: ViteDevServer | undefined;
  let centralCssHref = CENTRAL_CSS_URL;
  let base = '/';
  let cssOwner: ReturnType<typeof createDevCssOwner> | undefined;
  const trackedStylesheets = new Set<string>();
  const sourceDependencies = new Map<string, Set<string>>();
  const cachedStylesheets = new Set<string>();
  type Replacement = { result: Promise<(ReplaceStylesheetResult & { source: string }) | undefined> };
  const latest = new Map<string, Replacement>();

  function startReplacement(physicalId: string, read: () => string | Promise<string>): Replacement {
    trackedStylesheets.add(physicalId);
    // The task identity is a per-physical-file generation, including deletion tombstones.
    const task: Replacement = { result: Promise.resolve(undefined) };
    latest.set(physicalId, task);
    task.result = (async () => {
      let source: string;
      try {
        if (devServer && !isFileServingAllowed(physicalId, devServer)) {
          throw new Error(`Vite denied GSS file access: ${physicalId}`);
        }
        source = await read();
      } catch (error) {
        if (latest.get(physicalId) === task) throw error;
        return undefined;
      }
      if (latest.get(physicalId) !== task) return undefined;
      const result = session.replaceStylesheet({ id: physicalId, source });
      if (result.committed) cssOwner?.publish();
      return { ...result, source };
    })();
    return task;
  }

  async function compile(context: Rollup.MinimalPluginContext, physicalId: string) {
    let task = startReplacement(physicalId, () => readFile(physicalId, 'utf8'));
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
    return { artifact: result.module, source: result.source };
  }

  return {
    name: 'gss-l',
    enforce: 'pre',
    async configResolved(config) {
      development = config.command === 'serve';
      base = config.base;
      centralCssHref = `${base}${CENTRAL_CSS_URL.slice(1)}`;
      projectRoot = normalizePath(await realpath(config.root));
      session = createGssCompilerSession({ projectRoot });
      trackedStylesheets.clear();
      sourceDependencies.clear();
      latest.clear();
      cachedStylesheets.clear();
      cssOwner?.dispose();
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
        for (const id of reachableModuleIds(this)) {
          const physicalId = fromVirtualGssId(id);
          const info = this.getModuleInfo(id);
          if (!physicalId || info?.isExternal) continue;
          const metadata: unknown = info?.meta[STYLESHEET_META];
          if (!metadata || typeof metadata !== 'object' || !('source' in metadata) ||
              typeof metadata.source !== 'string') this.error(`Missing GSS source snapshot for ${physicalId}.`);
          const result = session.replaceStylesheet({ id: physicalId, source: metadata.source });
          reportDiagnostics(this, result.diagnostics);
          if (!result.committed) this.error('GSS census compilation failed.');
          count += 1;
        }
        if (count === 0) return;
        emitProductionSnapshot(this, bundle, session.finalize(), base);
      }
    },
    configureServer(server) {
      devServer = server;
      cssOwner = createDevCssOwner(server, () => session.finalize().css);
    },
    closeBundle() {
      cssOwner?.dispose();
      latest.clear();
      trackedStylesheets.clear();
      sourceDependencies.clear();
      cachedStylesheets.clear();
    },
    async hotUpdate(context) {
      if (this.environment.name !== 'client') return;
      const physicalId = normalizePath(context.file);
      if (!trackedStylesheets.has(physicalId)) return;
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
      if (development && resolveCentralCssId(id)) return session.finalize().css;
      const physicalId = fromVirtualGssId(id);
      if (!physicalId) return null;
      this.addWatchFile(physicalId);
      const { artifact, source } = await compile(this, physicalId);
      return development ? artifact.moduleCode : {
        code: artifact.moduleCode,
        meta: { [STYLESHEET_META]: { source } }
      };
    },
    async transform(source, id) {
      const physicalId = fromVirtualGssId(id);
      if (physicalId && cachedStylesheets.delete(id)) {
        this.addWatchFile(physicalId);
        const compiled = await compile(this, physicalId);
        return {
          code: compiled.artifact.moduleCode,
          meta: { [STYLESHEET_META]: { source: compiled.source } }
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
