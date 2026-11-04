import type { Compilation, Compiler } from '@rspack/core';
import type { CandidateSnapshot } from '@gss-l/integration-preparation';

const dependencyKeys = ['fileDependencies', 'contextDependencies', 'missingDependencies'] as const;
export type ProcessingDependencies = Record<typeof dependencyKeys[number], Iterable<string>>;
const emptyDependencies = () => ({
  fileDependencies: new Set<string>(),
  contextDependencies: new Set<string>(),
  missingDependencies: new Set<string>()
});

/** Internal host lifecycle. Candidate preparation is not publication, even when CSS processing passed. */
export function installPublication(compiler: Compiler) {
  const name = 'GssPublication';
  let published: CandidateSnapshot | undefined;
  let retained = emptyDependencies();
  const rounds = new WeakMap<Compilation, {
    candidate?: CandidateSnapshot;
    emitted: boolean;
    dependencies: ReturnType<typeof emptyDependencies>;
  }>();
  new compiler.rspack.NoEmitOnErrorsPlugin().apply(compiler);
  compiler.hooks.thisCompilation.tap(name, (compilation) => {
    rounds.set(compilation, { emitted: false, dependencies: emptyDependencies() });
  });
  compiler.hooks.afterEmit.tap(name, (compilation) => {
    const round = rounds.get(compilation);
    if (round) round.emitted = true;
  });
  compiler.hooks.done.tap(name, ({ compilation }) => {
    const round = rounds.get(compilation);
    if (!round) return;
    if (round.emitted && !compilation.errors.length && round.candidate) {
      published = round.candidate;
      retained = round.dependencies;
    } else {
      // A processor may throw before returning its dependency messages. Keep recovery inputs,
      // including newly discovered failed inputs, until a complete successful build replaces them.
      for (const key of dependencyKeys) {
        for (const id of round.dependencies[key]) retained[key].add(id);
        for (const id of retained[key]) compilation[key].add(id);
      }
    }
    rounds.delete(compilation);
  });
  return {
    get published() { return published; },
    stage(compilation: Compilation, candidate: CandidateSnapshot) {
      const round = rounds.get(compilation);
      if (!round) throw new Error('GSS candidate belongs to an inactive compilation.');
      round.candidate = candidate;
    },
    registerDependencies(compilation: Compilation, dependencies: ProcessingDependencies) {
      const round = rounds.get(compilation);
      if (!round) throw new Error('GSS dependencies belong to an inactive compilation.');
      for (const key of dependencyKeys) {
        for (const id of dependencies[key]) {
          round.dependencies[key].add(id);
          compilation[key].add(id);
        }
      }
    }
  };
}
