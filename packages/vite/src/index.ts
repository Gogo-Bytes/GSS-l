import { readFile, realpath } from 'node:fs/promises';
import {
  createGssCompilerSession,
  type GssCompilerSession,
  type GssSourceAdapter,
  type SourceAdapterDiagnostic
} from '@gss-l/compiler';
import { normalizePath, type Plugin, type Rollup } from 'vite';
import { fromVirtualGssId, toVirtualGssId } from './virtual-id.js';

export type GssOptions = { adapter: GssSourceAdapter };

export function gss({ adapter }: GssOptions): Plugin {
  if (!adapter) throw new Error('gss({ adapter }) requires an explicit framework Adapter.');
  let session: GssCompilerSession;

  async function compile(context: Rollup.PluginContext, physicalId: string) {
    context.addWatchFile(physicalId);
    const result = session.replaceStylesheet({
      id: physicalId,
      source: await readFile(physicalId, 'utf8')
    });
    reportDiagnostics(context, result.diagnostics);
    if (!result.committed || !result.module) context.error('GSS compilation failed.');
    return result.module;
  }

  return {
    name: 'gss-l',
    enforce: 'pre',
    async configResolved(config) {
      session = createGssCompilerSession({ projectRoot: normalizePath(await realpath(config.root)) });
    },
    async resolveId(source, importer) {
      if (fromVirtualGssId(source)) return source;
      if (!source.endsWith('.gss') || source.startsWith('\0')) return null;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      if (!resolved || resolved.external) return null;
      return toVirtualGssId(normalizePath(await realpath(resolved.id)));
    },
    async load(id) {
      const physicalId = fromVirtualGssId(id);
      if (!physicalId) return null;
      return (await compile(this, physicalId)).moduleCode;
    },
    async transform(source, id) {
      if (!adapter.supports(id)) return null;
      const imports = adapter.discoverImports({ id, source });
      if (imports.length === 0) return null;
      const dependencies = new Map<string, string>();
      for (const importId of new Set(imports)) {
        const resolved = await this.resolve(importId, id, { skipSelf: false });
        const physicalId = resolved && !resolved.external ? fromVirtualGssId(resolved.id) : undefined;
        if (!physicalId) this.error(`Cannot resolve GSS dependency ${importId} from ${id}.`);
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
      return { code: result.code, ...(result.map ? { map: JSON.stringify(result.map) } : {}) };
    }
  };
}

function reportDiagnostics(
  context: Rollup.PluginContext,
  diagnostics: readonly SourceAdapterDiagnostic[]
): void {
  for (const diagnostic of diagnostics) {
    const log = { ...diagnostic, message: `[${diagnostic.code}] ${diagnostic.message}` };
    if (diagnostic.severity === 'error') context.error(log);
    else if (diagnostic.severity === 'warning') context.warn(log);
    else context.info(log);
  }
}
