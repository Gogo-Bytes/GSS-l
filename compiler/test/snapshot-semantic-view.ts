import type { FinalizedGssSnapshot } from '../src/index.js';

/** Historical output-equivalence checks exclude the newly exposed original-source coordinates. */
export function snapshotSemanticView(snapshot: FinalizedGssSnapshot) {
  return {
    generation: snapshot.generation,
    css: snapshot.css,
    manifest: {
      modules: snapshot.manifest.modules,
      moduleDetails: snapshot.manifest.moduleDetails,
      resources: snapshot.manifest.resources.map(({ kind, name, sources }) => ({ kind, name, sources })),
      rules: snapshot.manifest.rules.map(({ kind, className, selector, property, value, important, sources }) =>
        ({ kind, className, selector, property, value, important, sources }))
    },
    report: snapshot.report
  };
}
