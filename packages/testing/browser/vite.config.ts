import { defineConfig } from 'vite';
import { createGssCompilerSession } from '@gss-l/compiler';
import { compileGssReference } from '../src/index.js';
import { fixtures, type CompiledReferenceFixture } from './fixtures.js';

// Host-only compilation. The browser receives CSS/mappings, never either compiler.
export default defineConfig({
  plugins: [{
    name: 'gss-reference-fixture',
    resolveId(id) {
      if (id === 'virtual:reference-fixtures') return '\0virtual:reference-fixtures';
    },
    load(id) {
      if (id !== '\0virtual:reference-fixtures') return;
      const compiled: readonly CompiledReferenceFixture[] = fixtures.map((fixture) => {
        const config = { projectRoot: '/reference-fixture', atomizationFallback: 'error' as const };
        const reference = compileGssReference({ config, modules: fixture.modules });
        if (!reference.success) throw new Error(JSON.stringify(reference.diagnostics));
        const session = createGssCompilerSession(config);
        const scopeSchemas = Object.fromEntries(fixture.modules.map((module) => {
          const result = session.replaceStylesheet(module);
          if (!result.committed || result.module?.compilationMode !== 'atomic' || result.diagnostics.length) {
            throw new Error(`Expected clean atomic fixture: ${JSON.stringify(result)}`);
          }
          return [module.id, result.module.scopeSchema];
        }));
        return { ...fixture, reference, atomic: { css: session.finalize().css, scopeSchemas } };
      });
      return `export default ${JSON.stringify(compiled)};`;
    }
  }]
});
