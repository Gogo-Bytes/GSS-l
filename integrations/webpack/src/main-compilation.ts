import VirtualModulesPlugin from 'webpack-virtual-modules';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { GssCompilerConfig, GssSourceAdapter, ReplaceStylesheetInput, FinalizeGssOptions } from '@gss-l/compiler';
import type { Compilation, Compiler, Module } from 'webpack';
import { prepareCandidateSnapshot } from '@gss-l/integration-preparation';
import { createStylesheetPreparation, StylesheetPreparationError } from '@gss-l/integration-preparation';
import { createSourceLoaderPreparation, SourceDiagnosticError, type GssLoaderContext } from './source-loader.js';
import { installPublication } from './publication.js';

/** Internal wiring only; public plugin configuration and stylesheet asset IO are not defined here. */
export function installMainCompilation(compiler: Compiler, options: {
  config: GssCompilerConfig;
  adapter: GssSourceAdapter;
  read(id: string, compilation: Compilation): Promise<Omit<ReplaceStylesheetInput, 'id'>>;
  finalize?: FinalizeGssOptions;
}) {
  const name = 'GssMainCompilation';
  const aggregateId = path.join(compiler.context, '.gss-internal', 'aggregate.css');
  const sourceLoader = fileURLToPath(new URL('./source-loader.js', import.meta.url));
  const aggregateLoader = fileURLToPath(new URL('./aggregate-loader.js', import.meta.url));
  new VirtualModulesPlugin({ [aggregateId]: '' }).apply(compiler);
  compiler.options.module.rules.push(
    { test: /\.gss$/, type: 'javascript/auto', use: [sourceLoader] },
    { test: (id: string) => !id.startsWith(aggregateId) && !id.startsWith('data:') && options.adapter.supports(id), enforce: 'pre', use: [sourceLoader] },
    { test: (id: string) => id === aggregateId, enforce: 'pre', sideEffects: true, use: [aggregateLoader] }
  );
  const publication = installPublication(compiler);
  const rounds = new WeakMap<Compilation, { prepare: ReturnType<typeof createStylesheetPreparation>; request?: string }>();
  compiler.hooks.thisCompilation.tap(name, compilation => {
    const prepare = createStylesheetPreparation(options.config, id => options.read(id, compilation));
    rounds.set(compilation, { prepare });
    const prepareSource = createSourceLoaderPreparation(options.adapter, prepare);
    compiler.webpack.NormalModule.getCompilationHooks(compilation).loader.tap(name, context => {
      (context as GssLoaderContext).gssPrepareSource = prepareSource;
    });
  });
  compiler.hooks.finishMake.tapPromise(name, async compilation => {
    const round = rounds.get(compilation);
    if (!round) return;
    try {
      const queue: Module[] = [];
      for (const entry of compilation.entries.values()) {
        for (const dependency of entry.dependencies) {
          const module = compilation.moduleGraph.getModule(dependency);
          if (module) queue.push(module);
        }
      }
      const seen = new Set<string>();
      const ids = new Set<string>();
      while (queue.length) {
        const module = queue.pop()!;
        if (seen.has(module.identifier())) continue;
        seen.add(module.identifier());
        if ('resource' in module && typeof module.resource === 'string' && module.resource.endsWith('.gss')) ids.add(module.resource);
        for (const connection of compilation.moduleGraph.getOutgoingConnections(module)) {
          if (connection.module) queue.push(connection.module);
        }
      }
      const candidate = await prepareCandidateSnapshot(options.config, ids, round.prepare, options.finalize);
      publication.stage(compilation, candidate);
      const { css, sourceMap } = candidate.snapshot;
      const payload = JSON.stringify({ css, sourceMap: { ...structuredClone(sourceMap),
        sources: sourceMap.sources.map(id => path.resolve(options.config.projectRoot, id)) } });
      const request = `${aggregateId}?gss=${Buffer.from(payload).toString('base64url')}`;
      round.request = request;
      // Attach the same aggregate to every current entry; do not partition global ordering by lazy chunk.
      for (const entryName of [...compilation.entries.keys()]) {
        const dependency = compiler.webpack.EntryPlugin.createDependency(request, { name: entryName });
        await new Promise<void>((resolve, reject) => compilation.addEntry(
          compiler.context, dependency, { name: entryName }, error => error ? reject(error) : resolve()
        ));
      }
    } catch (error) {
      compilation.errors.push(error instanceof StylesheetPreparationError
        ? new SourceDiagnosticError(error.diagnostics)
        : error instanceof Error ? error : new Error(String(error)));
    }
  });
  compiler.hooks.afterCompile.tap(name, compilation => {
    const request = rounds.get(compilation)?.request;
    if (!request) return;
    for (const module of compilation.modules) {
      if (!('resource' in module) || module.resource !== request) continue;
      // webpack moves successful buildInfo dependencies into its filesystem snapshot.
      // The native API covers both snapshots and incomplete failed builds; reading only
      // buildInfo loses recovery dependencies after MiniCssExtractPlugin processing.
      const fileDependencies = new compiler.webpack.util.LazySet<string>();
      const contextDependencies = new compiler.webpack.util.LazySet<string>();
      const missingDependencies = new compiler.webpack.util.LazySet<string>();
      module.addCacheDependencies(fileDependencies, contextDependencies, missingDependencies, compilation.buildDependencies);
      publication.registerDependencies(compilation, { fileDependencies, contextDependencies, missingDependencies });
    }
  });
  return publication;
}
