import type { CompatibilityTransformer } from '../infrastructure/lightning-compatibility-transformer.js';
import type { GssCompilerConfig, GssCompilerSession } from '../public-types.js';
import type { CssParserPort } from './css-parser-port.js';
import { createDefaultNameAllocator, type NameAllocatorPort } from './name-allocator.js';
import { prepareContribution, type ModuleContribution } from './module-contribution.js';
import { findConflictingResource } from './resource-planning.js';
import { finalizeSnapshot } from './finalize-snapshot.js';

export function createCompilerSession(
  config: GssCompilerConfig,
  cssParser: CssParserPort,
  nameAllocator: NameAllocatorPort = createDefaultNameAllocator(),
  compatibility?: CompatibilityTransformer
): GssCompilerSession {
  const modules = new Map<string, ModuleContribution>();
  let generation = 0;

  return {
    replaceStylesheet(input) {
      const prepared = prepareContribution(config, input, cssParser, nameAllocator, compatibility);
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

      modules.set(input.id, prepared);
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
