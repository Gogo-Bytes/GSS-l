import { createCompilerSession } from './application/compiler-session.js';
import { createDefaultNameAllocator } from './application/name-allocator.js';
import { discoverAssets } from './application/stylesheet-assets.js';
import { parseStylesheet } from './infrastructure/postcss-stylesheet-parser.js';
import { createCompatibilityTransformer } from './infrastructure/lightning-compatibility-transformer.js';
import type { GssCompilerConfig, GssCompilerSession, ReplaceStylesheetInput } from './public-types.js';

const cssParser = { parseStylesheet };

export function createGssCompilerSession(config: GssCompilerConfig): GssCompilerSession {
  const supplied = config.compatibilityTargetStages;
  const stages = Array.isArray(supplied) ? supplied.map((targets) =>
    targets && typeof targets === 'object' && !Array.isArray(targets) ? { ...targets } : targets) : supplied;
  return createCompilerSession(stages === undefined ? config : { ...config, compatibilityTargetStages: stages },
    cssParser, createDefaultNameAllocator(),
    stages === undefined ? undefined : createCompatibilityTransformer(stages));
}

export function discoverStylesheetAssets(input: Pick<ReplaceStylesheetInput, 'id' | 'source'>) {
  return discoverAssets(input, cssParser);
}
