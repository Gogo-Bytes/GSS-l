import { defineConfig } from 'vite';
import { createGssCompilerSession } from '@gss-l/compiler';
import { compileGssReference } from '../src/index.js';
import { fixtures, type CompiledReferenceFixture, type ReferenceFixture } from './fixtures.js';
import { contextualBoundaryFixtures } from './contextual-boundary-fixtures.js';

// Host-only compilation. The browser receives CSS/mappings, never either compiler.
export default defineConfig({
  plugins: [{
    name: 'gss-reference-fixture',
    resolveId(id) {
      if (id === 'virtual:reference-fixtures') return '\0virtual:reference-fixtures';
    },
    load(id) {
      if (id !== '\0virtual:reference-fixtures') return;
      const compile = (fixture: ReferenceFixture, nativeReference?: CompiledReferenceFixture['reference']): CompiledReferenceFixture => {
        const config = { projectRoot: '/reference-fixture', atomizationFallback: 'error' as const };
        const reference = nativeReference ?? (() => {
          const result = compileGssReference({ config, modules: fixture.modules });
          if (!result.success) throw new Error(JSON.stringify(result.diagnostics));
          return result;
        })();
        const session = createGssCompilerSession(config);
        const scopeSchemas = Object.fromEntries(fixture.modules.map((module) => {
          const result = session.replaceStylesheet(module);
          if (!result.committed || result.module?.compilationMode !== 'atomic' || result.diagnostics.length) {
            throw new Error(`Expected clean atomic fixture: ${JSON.stringify(result)}`);
          }
          return [module.id, result.module.scopeSchema];
        }));
        return { ...fixture, reference, atomic: { css: session.finalize().css, scopeSchemas } };
      };
      const compiled = [
        ...fixtures.map((fixture) => compile(fixture)),
        ...contextualBoundaryFixtures.map((fixture) => compile(fixture, fixture.reference))
      ];
      return `export default ${JSON.stringify(compiled)};`;
    }
  }]
});
