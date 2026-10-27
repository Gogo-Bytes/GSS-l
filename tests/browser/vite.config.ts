import { defineConfig } from 'vite';

import { createGssCompilerSession } from '@gss-l/compiler';
import { compileGssReference } from '../src/index.js';
import { fixtures, type CompiledReferenceFixture, type ReferenceFixture } from './fixtures.js';
import { contextualBoundaryFixtures } from './contextual-boundary-fixtures.js';
import { structuralRelationFixtures, structuralObservedFixtures } from './structural-relation-fixtures.js';
import { fontResetFixtures } from './font-reset-fixtures.js';
import { hasSpecificityDedupFixtures, hasSpecificityFixtures, hasTypeListFixtures } from './has-specificity-fixtures.js';
import { conditionalKeyframeFixtures } from './conditional-keyframe-fixtures.js';
import { nestedLayerFixtures } from './nested-layer-fixtures.js';
import { interleavedChainFixtures } from './interleaved-chain-fixtures.js';
import { crossLayerSpecificityFixtures } from './cross-layer-specificity-fixtures.js';
import { externalAnchorFixtures } from './external-anchor-fixtures.js';
import { sameNodeRefinementFixtures } from './same-node-refinement-fixtures.js';
import { externalObservationFixtures } from './external-observation-fixtures.js';
import { compatibilityFixtures } from './compatibility-fixtures.js';
import { propertyInheritanceFixtures } from './property-inheritance-fixtures.js';
import { keywordKeyframeFixtures } from './keyword-keyframe-fixtures.js';
import { scopeSourceAliasFixtures } from './scope-source-alias-fixtures.js';
import { externalTagAttributeFixtures } from './external-tag-attribute-fixtures.js';

const assetSizes: Record<string, readonly [number, number]> = {
  'one-a.svg': [3, 2], 'two-a.svg': [3, 2], 'base.svg': [3, 2],
  'one-b.svg': [5, 4], 'two-b.svg': [5, 4], 'wide.svg': [5, 4],
  'disabled.svg': [7, 6], 'wrong.svg': [11, 7]
};
const assetSvg = ([width, height]: readonly [number, number]) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><path fill="red" d="M0 0h${width}v${height}H0z"/></svg>`;

// Host-only compilation. The browser receives CSS/mappings, never either compiler.
export default defineConfig({
  plugins: [{
    name: 'gss-reference-fixture',
    configureServer(server) {
      // Exact owned routes only: no filesystem access, public-directory expansion or network.
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0] ?? '';
        if (!path.startsWith('/__reference_assets__/')) { next(); return; }
        const size = Object.hasOwn(assetSizes, path.slice('/__reference_assets__/'.length))
          ? assetSizes[path.slice('/__reference_assets__/'.length)] : undefined;
        if (!size || !['GET', 'HEAD'].includes(request.method ?? '')) { response.statusCode = 404; response.end(); return; }
        response.setHeader('Content-Type', 'image/svg+xml');
        response.setHeader('Cache-Control', 'no-store');
        response.end(request.method === 'HEAD' ? undefined : assetSvg(size));
      });
    },
    generateBundle() {
      for (const [name, size] of Object.entries(assetSizes)) {
        this.emitFile({ type: 'asset', fileName: `__reference_assets__/${name}`, source: assetSvg(size) });
      }
    },
    resolveId(id) {
      if (id === 'virtual:reference-fixtures') return '\0virtual:reference-fixtures';
    },
    load(id) {
      if (id !== '\0virtual:reference-fixtures') return;
      const compile = (fixture: ReferenceFixture, nativeReference?: CompiledReferenceFixture['reference'], family = 'ownership, states, conditions, assets and animations'): CompiledReferenceFixture & { family: string; referenceKind: string } => {
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
          const expectedMode = fixture.preservedModuleIds?.includes(module.id) ? 'preserved' : 'atomic';
          if (expectedMode === 'preserved' && fixture.config?.atomizationFallback !== 'preserve-module') {
            throw new Error(`Preserved fixture ${module.id} requires explicit fallback policy`);
          }
          if (!result.committed || result.module?.compilationMode !== expectedMode ||
            (expectedMode === 'atomic' && result.diagnostics.length) ||
            (expectedMode === 'preserved' && !result.module.fallbackReasons.some((reason) =>
              reason.reason === 'compatibility-sequence-unatomizable'))) {
            throw new Error(`Expected ${expectedMode} fixture: ${JSON.stringify(result)}`);
          }
          return [module.id, result.module.scopeSchema];
        }));
        return { ...fixture, family, referenceKind: nativeReference ? 'hand-authored' : 'independent-reference', reference, atomic: { css: session.finalize(ports).css, scopeSchemas } };
      };
      const compiled = [
        ...fixtures.map((fixture) => compile(fixture)),
        ...contextualBoundaryFixtures.map((fixture) => compile(fixture, fixture.reference, 'contextual boundary')),
        ...[...structuralRelationFixtures, ...structuralObservedFixtures].map((fixture) => compile(fixture, fixture.reference, 'structural relations')),
        ...fontResetFixtures.map((fixture) => compile(fixture, fixture.reference, 'property-effect resets')),
        ...hasSpecificityFixtures.map((fixture) => compile(fixture, fixture.reference, 'has specificity')),
        ...hasTypeListFixtures.map((fixture) => compile(fixture, fixture.reference, 'type-only has lists')),
        ...conditionalKeyframeFixtures.map((fixture) => compile(fixture, fixture.reference, 'Compiler registered conditional keyframes')),
        ...hasSpecificityDedupFixtures.map((fixture) => compile(fixture, fixture.reference, 'has list identity')),
        ...nestedLayerFixtures.map((fixture) => compile(fixture, fixture.reference, 'Compiler nested layers')),
        ...interleavedChainFixtures.map((fixture) => compile(fixture, fixture.reference, 'interleaved ownership and runtime edges')),
        ...crossLayerSpecificityFixtures.map((fixture) => compile(fixture, fixture.reference, 'Compiler layer specificity')),
        ...externalAnchorFixtures.map((fixture) => compile(fixture, fixture.reference, 'external targets')),
        ...sameNodeRefinementFixtures.map((fixture) => compile(fixture, fixture.reference, 'owned external conditions')),
        ...externalObservationFixtures.map((fixture) => compile(fixture, fixture.reference, 'external observations and functional conditions')),
        ...compatibilityFixtures.map((fixture) => compile(fixture, fixture.reference, 'Compiler compatibility stages')),
        ...propertyInheritanceFixtures.map((fixture) => compile(fixture, fixture.reference, 'custom-property inheritance')),
        ...keywordKeyframeFixtures.map((fixture) => compile(fixture, fixture.reference, 'keyword animation names')),
        ...scopeSourceAliasFixtures.map((fixture) => compile(fixture, fixture.reference, 'readable identity isolation')),
        ...externalTagAttributeFixtures.map((fixture) => compile(fixture, fixture.reference, 'external tag and attribute targets'))
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
