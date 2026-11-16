import type { CompatibilityTransformer } from './compatibility-transformer.js';
import type { GssCompilerConfig, GssCompilerSession } from '../public-types.js';
import type { CssParserPort } from './css-parser-port.js';
import { createDefaultNameAllocator, type NameAllocator } from './name-allocator.js';
import { prepareContribution, type ModuleContribution } from './module-contribution.js';
import { findConflictingResource } from './resource-planning.js';
import { finalizeSnapshot } from './finalize-snapshot.js';

export function createCompilerSession(
  config: GssCompilerConfig,
  cssParser: CssParserPort,
  createNameAllocator: () => NameAllocator = () => createDefaultNameAllocator(config.namingMode),
  compatibility?: CompatibilityTransformer
): GssCompilerSession {
  const modules = new Map<string, ModuleContribution & { names: ReadonlyMap<string, string> }>();
  const names = new Map<string, { identity: string; owners: Set<string> }>();
  let generation = 0;
  const releaseNames = (id: string) => {
    for (const name of modules.get(id)?.names.keys() ?? []) {
      const entry = names.get(name)!;
      entry.owners.delete(id);
      if (!entry.owners.size) names.delete(name);
    }
  };

  return {
    replaceStylesheet(input) {
      const nameAllocator = createNameAllocator();
      const prepared = prepareContribution(config, input, cssParser, nameAllocator, compatibility);
      let collision = nameAllocator.collision;
      for (const [name, identity] of nameAllocator.identities) {
        const previous = names.get(name);
        if (previous !== undefined && previous.identity !== identity) collision = name;
      }
      if (collision !== undefined) return {
        id: input.id, committed: false, generation,
        diagnostics: [{ code: 'GSS1402', severity: 'error', phase: 'registry', id: input.id,
          reason: 'generated-name-collision', message: `Generated GSS name ${collision} represents different identities.` }]
      };
      if (!('artifact' in prepared)) {
        return {
          id: input.id,
          committed: false,
          generation,
          diagnostics: prepared.diagnostics
        };
      }

      const conflictingResource = findConflictingResource(modules, input.id, prepared.resources);
      if (conflictingResource) {
        return {
          id: input.id,
          committed: false,
          generation,
          diagnostics: [{
            code: 'GSS1301',
            severity: 'error',
            phase: 'registry',
            message: `Global resource ${conflictingResource} has incompatible registrations.`,
            id: input.id,
            reason: 'conflicting-global-resource',
            suggestion: 'Keep one project-wide registration with identical descriptors.'
          }]
        };
      }

      releaseNames(input.id);
      for (const [name, identity] of nameAllocator.identities) {
        const entry = names.get(name) ?? { identity, owners: new Set<string>() };
        entry.owners.add(input.id);
        names.set(name, entry);
      }
      modules.set(input.id, { ...prepared, names: new Map(nameAllocator.identities),
        rules: prepared.rules.map(rule => ({ ...rule,
          orderKey: nameAllocator.identities.get(rule.className) ?? rule.className })) });
      generation += 1;
      return {
        id: input.id,
        committed: true,
        generation,
        module: prepared.artifact,
        diagnostics: prepared.diagnostics
      };
    },

    invalidate(moduleId) {
      releaseNames(moduleId);
      const changed = modules.delete(moduleId);
      if (changed) generation += 1;
      return { id: moduleId, changed, generation };
    },

    getScopeSchema(moduleId) {
      return modules.get(moduleId)?.artifact.scopeSchema;
    },

    finalize(options) {
      return finalizeSnapshot(modules, generation, config, options);
    }
  };
}
