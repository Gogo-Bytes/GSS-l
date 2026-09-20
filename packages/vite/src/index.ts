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

export type GssOptions = { adapter: GssSourceAdapter };

export function gss({ adapter }: GssOptions): Plugin {
  if (!adapter) throw new Error('gss({ adapter }) requires an explicit framework Adapter.');
  let session: GssCompilerSession;
  let development = false;
  let devServer: ViteDevServer | undefined;
  let centralCssHref = CENTRAL_CSS_URL;
  let cssOwner: ReturnType<typeof createDevCssOwner> | undefined;
  const trackedStylesheets = new Set<string>();
  const sourceDependencies = new Map<string, Set<string>>();
  type Replacement = { result: Promise<ReplaceStylesheetResult | undefined> };
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
      return result;
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
    reportDiagnostics(context, result.diagnostics);
    if (!result.committed || !result.module) context.error('GSS compilation failed.');
    return result.module;
  }

  return {
    name: 'gss-l',
    enforce: 'pre',
    async configResolved(config) {
      development = config.command === 'serve';
      centralCssHref = `${config.base}${CENTRAL_CSS_URL.slice(1)}`;
      session = createGssCompilerSession({ projectRoot: normalizePath(await realpath(config.root)) });
      trackedStylesheets.clear();
      sourceDependencies.clear();
      latest.clear();
      cssOwner?.dispose();
      cssOwner = undefined;
      devServer = undefined;
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
      return (await compile(this, physicalId)).moduleCode;
    },
    async transform(source, id) {
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
