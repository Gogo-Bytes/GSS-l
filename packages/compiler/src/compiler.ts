import { createCompilerSession } from './application/compiler-session.js';
import { discoverAssets } from './application/stylesheet-assets.js';
import { parseStylesheet } from './infrastructure/postcss-stylesheet-parser.js';
import type { GssCompilerConfig, GssCompilerSession, ReplaceStylesheetInput } from './public-types.js';

const cssParser = { parseStylesheet };

export function createGssCompilerSession(config: GssCompilerConfig): GssCompilerSession {
  return createCompilerSession(config, cssParser);
}

export function discoverStylesheetAssets(input: Pick<ReplaceStylesheetInput, 'id' | 'source'>) {
  return discoverAssets(input, cssParser);
}
