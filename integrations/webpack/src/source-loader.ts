import { dirname } from 'node:path';
import type { GssSourceAdapter, SourceAdapterDiagnostic, ReplaceStylesheetInput } from '@gss-l/compiler';
import type { LoaderContext, LoaderDefinition } from 'webpack';
import { formatDiagnosticMessages, prepareSource, StylesheetPreparationError, type PreparedStylesheet } from '@gss-l/integration-preparation';

export class SourceDiagnosticError extends Error {
  constructor(readonly diagnostics: readonly SourceAdapterDiagnostic[], input?: Readonly<ReplaceStylesheetInput>) {
    super(formatDiagnosticMessages(diagnostics, input));
    this.name = 'GssSourceDiagnosticError';
  }
}

/** Installed on the native loader context for this compilation, never shared across builds. */
export type GssLoaderContext = LoaderContext<object> & {
  gssPrepareSource?: ReturnType<typeof createSourceLoaderPreparation>;
};

export function createSourceLoaderPreparation(
  adapter: GssSourceAdapter,
  prepare: (id: string) => Promise<PreparedStylesheet>
) {
  return async (loader: LoaderContext<object>, source: string) => {
    const report = (diagnostics: readonly SourceAdapterDiagnostic[], input?: Readonly<ReplaceStylesheetInput>) => {
      for (const diagnostic of diagnostics) {
        if (diagnostic.severity === 'warning') loader.emitWarning(new SourceDiagnosticError([diagnostic], input));
        else if (diagnostic.severity === 'info') loader.getLogger('gss').info(diagnostic.message);
      }
      const errors = diagnostics.filter(d => d.severity === 'error');
      if (errors.length) throw new SourceDiagnosticError(errors, input);
    };
    try {
      if (loader.resourcePath.endsWith('.gss')) {
        loader.addDependency(loader.resourcePath);
        const prepared = await prepare(loader.resourcePath);
        report(prepared.diagnostics);
        return { code: prepared.module.moduleCode };
      }
      const input = { id: loader.resourcePath, source };
      const output = await prepareSource(adapter, input, {
        resolve: (specifier) => new Promise((resolve, reject) => {
          loader.resolve(loader.context ?? dirname(loader.resourcePath), specifier, (error, id) => {
            if (error) reject(error);
            else if (typeof id !== 'string') reject(new Error(`Cannot resolve GSS import: ${specifier}.`));
            else resolve(id);
          });
        }),
        watch: id => loader.addDependency(id),
        prepare
      });
      if (!output) return null;
      report(output.stylesheetDiagnostics);
      if (output.transformed) report(output.transformed.diagnostics, input);
      return output.transformed;
    } catch (error) {
      if (error instanceof StylesheetPreparationError) throw new SourceDiagnosticError(error.diagnostics, error.input);
      throw error;
    }
  };
}

const sourceLoader: LoaderDefinition<object, GssLoaderContext> = function (source, map, data) {
  const done = this.async();
  if (!this.gssPrepareSource) {
    done(new Error('GSS source loader requires its compilation preparation hook.'));
    return;
  }
  this.gssPrepareSource(this, source).then(
    result => result ? done(null, result.code, 'map' in result && result.map ? JSON.stringify(result.map) : undefined, data) : done(null, source, map, data),
    error => done(error instanceof Error ? error : new Error(String(error)))
  );
};
export default sourceLoader;
