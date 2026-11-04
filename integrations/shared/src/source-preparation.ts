import {
  createGssCompilerSession,
  type GssCompilerConfig,
  type GssDiagnostic,
  type GssSourceAdapter,
  type ReplaceStylesheetInput,
  type StyleModuleArtifact
} from '@gss-l/compiler';

export type PreparedStylesheet = {
  readonly input: Readonly<ReplaceStylesheetInput>;
  readonly module: StyleModuleArtifact;
  readonly diagnostics: readonly GssDiagnostic[];
};

/** Internal error carrier: the loader must report these original diagnostics, not replace their ranges. */
export class StylesheetPreparationError extends Error {
  constructor(readonly diagnostics: readonly GssDiagnostic[]) {
    super(diagnostics.map(({ message }) => message).join('\n'));
    this.name = 'StylesheetPreparationError';
  }
}

/**
 * One instance per stable input batch, scoped by the caller (a compilation in webpack/Rspack).
 * Canonical IDs and config must stay stable for its lifetime. Successes AND failures are cached;
 * changed inputs require a new instance. This module never observes or invalidates host state.
 * See ../README.md for the host/preparation boundary.
 */
export function createStylesheetPreparation(
  config: GssCompilerConfig,
  read: (id: string) => Promise<Omit<ReplaceStylesheetInput, 'id'>>
): (id: string) => Promise<PreparedStylesheet> {
  const inputs = new Map<string, Promise<PreparedStylesheet>>();
  return (id) => {
    const existing = inputs.get(id);
    if (existing) return existing;
    // Store before invoking host IO so aliases and concurrent loaders share one input snapshot.
    const pending = Promise.resolve().then(async () => {
      const loaded = await read(id);
      const input: ReplaceStylesheetInput = {
        id,
        source: loaded.source,
        ...(loaded.assetReferences ? {
          assetReferences: loaded.assetReferences.map((reference) => Object.freeze({ ...reference }))
        } : {})
      };
      if (input.assetReferences) Object.freeze(input.assetReferences);
      Object.freeze(input);
      const result = createGssCompilerSession(config).replaceStylesheet(input);
      if (!result.committed) throw new StylesheetPreparationError(result.diagnostics);
      if (!result.module) throw new Error(`Committed GSS input has no module artifact: ${id}.`);
      return { input, module: result.module, diagnostics: result.diagnostics };
    });
    // Rejections belong to this input batch too. Recovery starts with a new instance.
    inputs.set(id, pending);
    return pending;
  };
}

export type SourcePreparationHost = {
  /** Resolve the raw specifier to a canonical stylesheet ID, or throw a host resolution error. */
  resolve(specifier: string, importer: string): Promise<string>;
  /** Register before reading/compiling, including dependencies whose preparation fails. */
  watch(id: string): void;
  prepare(id: string): Promise<PreparedStylesheet>;
};

export type PreparedSource = {
  readonly dependencies: readonly string[];
  readonly stylesheetDiagnostics: readonly GssDiagnostic[];
  readonly transformed: ReturnType<GssSourceAdapter['transform']> | null;
};

/** Undefined means unsupported; null transformed means supported source with no GSS imports. */
export async function prepareSource(
  adapter: GssSourceAdapter,
  input: { id: string; source: string },
  host: SourcePreparationHost
): Promise<PreparedSource | undefined> {
  if (!adapter.supports(input.id)) return undefined;
  const specifiers = [...new Set(adapter.discoverImports(input))];
  const dependencies = new Map<string, PreparedStylesheet>();
  const resolved = new Map<string, string>();
  for (const specifier of specifiers) {
    const id = await host.resolve(specifier, input.id);
    host.watch(id);
    dependencies.set(id, await host.prepare(id));
    resolved.set(specifier, id);
  }
  const stylesheetDiagnostics = [...dependencies.values()].flatMap(({ diagnostics }) => diagnostics);
  return {
    dependencies: [...dependencies.keys()],
    stylesheetDiagnostics,
    transformed: specifiers.length === 0 ? null : adapter.transform({
      ...input,
      resolveScopeSchema(specifier) {
        const id = resolved.get(specifier);
        return id === undefined ? undefined : dependencies.get(id)?.module.scopeSchema;
      }
    })
  };
}
