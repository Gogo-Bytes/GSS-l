import {
  createGssCompilerSession,
  type FinalizedGssSnapshot,
  type FinalizeGssOptions,
  type GssCompilerConfig,
  type GssDiagnostic
} from '@gss-l/compiler';
import { StylesheetPreparationError, type PreparedStylesheet } from './source-preparation.js';

export type CandidateSnapshot = {
  readonly stylesheets: readonly PreparedStylesheet[];
  readonly diagnostics: readonly GssDiagnostic[];
  readonly snapshot: FinalizedGssSnapshot;
};

/** The host supplies this compilation's reachable IDs, including lazy imports, not a loader history. */
export async function prepareCandidateSnapshot(
  config: GssCompilerConfig,
  reachableIds: Iterable<string>,
  prepare: (id: string) => Promise<PreparedStylesheet>,
  options?: FinalizeGssOptions
): Promise<CandidateSnapshot> {
  const ids = [...new Set(reachableIds)].sort();
  const stylesheets = await Promise.all(ids.map(prepare));
  const session = createGssCompilerSession(config);
  const diagnostics: GssDiagnostic[] = [];
  for (const [index, prepared] of stylesheets.entries()) {
    if (prepared.input.id !== ids[index]) throw new Error(`GSS prepared input ID differs from its reachable ID: ${ids[index]}.`);
    const result = session.replaceStylesheet(prepared.input);
    if (!result.committed) throw new StylesheetPreparationError(result.diagnostics);
    // The JS modules already built by loaders and this CSS candidate must describe the same inputs/config.
    if (JSON.stringify(result.module) !== JSON.stringify(prepared.module)) {
      throw new Error(`GSS module artifact changed during candidate replay: ${prepared.input.id}.`);
    }
    diagnostics.push(...result.diagnostics);
  }
  return { stylesheets: Object.freeze(stylesheets), diagnostics, snapshot: session.finalize(options) };
}
