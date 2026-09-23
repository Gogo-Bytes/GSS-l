import { defineConfig } from 'vite';
import { createGssCompilerSession } from '@gss-l/compiler';
import { compileGssReference } from '../src/index.js';
import { fixtures, type CompiledReferenceFixture, type ReferenceFixture } from './fixtures.js';
import { contextualBoundaryFixtures } from './contextual-boundary-fixtures.js';
import { structuralRelationFixtures, structuralObservedFixtures } from './structural-relation-fixtures.js';
import { fontResetFixtures } from './font-reset-fixtures.js';
import { hasSpecificityDedupFixtures, hasSpecificityFixtures } from './has-specificity-fixtures.js';
import { nestedLayerFixtures } from './nested-layer-fixtures.js';

// Host-only compilation. The browser receives CSS/mappings, never either compiler.
export default defineConfig({
  plugins: [{
    name: 'gss-reference-fixture',
    configureServer(server) {
      // Exact owned routes only: no filesystem access, public-directory expansion or network.
      const sizes: Record<string, readonly [number, number]> = {
        'one-a.svg': [3, 2], 'two-a.svg': [3, 2], 'base.svg': [3, 2],
        'one-b.svg': [5, 4], 'two-b.svg': [5, 4], 'wide.svg': [5, 4],
        'disabled.svg': [7, 6], 'wrong.svg': [11, 7]
      };
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0] ?? '';
        if (!path.startsWith('/__reference_assets__/')) { next(); return; }
        const size = Object.hasOwn(sizes, path.slice('/__reference_assets__/'.length))
          ? sizes[path.slice('/__reference_assets__/'.length)] : undefined;
        if (!size || !['GET', 'HEAD'].includes(request.method ?? '')) { response.statusCode = 404; response.end(); return; }
        response.setHeader('Content-Type', 'image/svg+xml');
        response.setHeader('Cache-Control', 'no-store');
        response.end(request.method === 'HEAD' ? undefined : `<svg xmlns="http://www.w3.org/2000/svg" width="${size[0]}" height="${size[1]}"><path fill="red" d="M0 0h${size[0]}v${size[1]}H0z"/></svg>`);
      });
    },
    resolveId(id) {
      if (id === 'virtual:reference-fixtures') return '\0virtual:reference-fixtures';
    },
    load(id) {
      if (id !== '\0virtual:reference-fixtures') return;
      const compile = (fixture: ReferenceFixture, nativeReference?: CompiledReferenceFixture['reference']): CompiledReferenceFixture => {
        const config = { projectRoot: '/reference-fixture', atomizationFallback: 'error' as const, ...fixture.config };
        const ports = { resolveAssetUrl(identity: string) {
          const url = fixture.assetUrls?.[identity];
          if (!url) throw new Error(`Missing fixture Asset: ${identity}`);
          return url;
        } };
        const reference = nativeReference ?? (() => {
          const result = compileGssReference({ config, modules: fixture.modules }, ports);
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
        return { ...fixture, reference, atomic: { css: session.finalize(ports).css, scopeSchemas } };
      };
      const compiled = [
        ...fixtures.map((fixture) => compile(fixture)),
        ...contextualBoundaryFixtures.map((fixture) => compile(fixture, fixture.reference)),
        ...[...structuralRelationFixtures, ...structuralObservedFixtures].map((fixture) => compile(fixture, fixture.reference)),
        ...fontResetFixtures.map((fixture) => compile(fixture, fixture.reference)),
        ...hasSpecificityFixtures.map((fixture) => compile(fixture, fixture.reference)),
        ...hasSpecificityDedupFixtures.map((fixture) => compile(fixture, fixture.reference)),
        ...nestedLayerFixtures.map((fixture) => compile(fixture, fixture.reference))
      ];
      const first = compiled.find((fixture) => fixture.name === 'asset-module-isolation-one')!;
      const second = compiled.find((fixture) => fixture.name === 'asset-module-isolation-two')!;
      for (const side of ['reference', 'atomic'] as const) {
        if (JSON.stringify(first[side].scopeSchemas) !== JSON.stringify(second[side].scopeSchemas)) {
          throw new Error(`${side} delivery URL changed mapping identity`);
        }
      }
      return `export default ${JSON.stringify(compiled)};`;
    }
  }]
});
