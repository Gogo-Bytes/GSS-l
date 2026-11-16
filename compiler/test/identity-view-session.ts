import { createCompilerSession } from '../src/application/compiler-session.js';
import { createDefaultNameAllocator } from '../src/application/name-allocator.js';
import { parseStylesheet } from '../src/infrastructure/postcss-stylesheet-parser.js';
import { createCompatibilityTransformer } from '../src/infrastructure/lightning-compatibility-transformer.js';
import type { GssCompilerConfig, GssCompilerSession, ScopeNodeSchema, ScopeSchema, StyleModuleArtifact } from '../src/index.js';

/** Compare historical semantic oracles in canonical identity notation, not opaque output names.
 * Source maps remain those of the real output: use the public session for position assertions. */
export function createIdentityViewSession(config: GssCompilerConfig): GssCompilerSession {
  const names = new Map<string, string>();
  let latest = createDefaultNameAllocator(config.namingMode);
  const session = createCompilerSession(config, { parseStylesheet }, () => {
    latest = createDefaultNameAllocator(config.namingMode);
    return latest;
  }, config.compatibilityTargetStages === undefined ? undefined : createCompatibilityTransformer(config.compatibilityTargetStages));
  const text = (value: string) => value.replace(/[A-Za-z0-9_-]+/g, token => names.get(token) ?? token);
  const node = (value: ScopeNodeSchema): ScopeNodeSchema => ({ selfClassName: text(value.selfClassName),
    targets: Object.fromEntries(Object.entries(value.targets).map(([key, child]) => [key, node(child)])) });
  const schema = (value: ScopeSchema): ScopeSchema => ({ ...value,
    exports: Object.fromEntries(Object.entries(value.exports).map(([key, child]) => [key, node(child)])) });
  const artifact = (value: StyleModuleArtifact): StyleModuleArtifact => ({ ...value,
    scopeSchema: schema(value.scopeSchema), moduleCode: text(value.moduleCode) });
  return {
    replaceStylesheet(input) {
      const result = session.replaceStylesheet(input);
      for (const [name, identity] of latest.identities) if (!identity.startsWith('external:')) names.set(name, identity);
      return { ...result, ...(result.module ? { module: artifact(result.module) } : {}) };
    },
    invalidate: session.invalidate,
    getScopeSchema(id) {
      const value = session.getScopeSchema(id);
      return value && schema(value);
    },
    finalize(options) {
      const result = session.finalize(options);
      return { ...result, css: text(result.css), manifest: { ...result.manifest,
        resources: result.manifest.resources.map(resource => ({ ...resource, name: text(resource.name) })),
        rules: result.manifest.rules.map(rule => ({ ...rule,
          className: text(rule.className), selector: text(rule.selector), value: text(rule.value) }))
      } };
    }
  };
}
