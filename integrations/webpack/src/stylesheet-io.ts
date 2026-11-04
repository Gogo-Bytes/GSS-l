import { dirname, relative, resolve } from 'node:path';
import { discoverStylesheetAssets, type ReplaceStylesheetInput } from '@gss-l/compiler';
import type { Compilation, Compiler } from 'webpack';

/** Resolve relative URLs before moving declarations into the aggregate CSS's directory. */
export async function readStylesheetInput(compiler: Compiler, compilation: Compilation, id: string): Promise<Omit<ReplaceStylesheetInput, 'id'>> {
  const fs = compiler.inputFileSystem;
  if (!fs) throw new Error('GSS requires the host input filesystem.');
  compilation.fileDependencies.add(id);
  const source = await new Promise<string>((accept, reject) => {
    fs.readFile(id, (error, bytes) => {
      if (error) { compilation.missingDependencies.add(id); reject(error); }
      else if (bytes === undefined) reject(new Error(`Cannot read GSS stylesheet: ${id}.`));
      else accept(bytes.toString());
    });
  });
  const discovery = discoverStylesheetAssets({ id, source });
  if (discovery.diagnostics.some(d => d.severity === 'error')) return { source };
  const resolver = compiler.resolverFactory.get('normal', { dependencyType: 'url', preferRelative: true });
  const assetReferences = [];
  for (const url of discovery.urls) {
    // Root URLs, remote/data URLs and local fragments already have a directory-independent meaning.
    if (/^(?:[a-z][a-z\d+.-]*:|\/|#)/i.test(url)) continue;
    const split = url.search(/[?#]/);
    const pathname = split < 0 ? url : url.slice(0, split);
    const suffix = split < 0 ? '' : url.slice(split);
    const file = await new Promise<string>((accept, reject) => resolver.resolve({}, dirname(id), decodeURIComponent(pathname), compilation, (error, result) => {
      if (error) reject(error);
      else if (typeof result !== 'string') reject(new Error(`Cannot resolve GSS asset ${url} from ${id}.`));
      else accept(result);
    }));
    assetReferences.push({ url, identity: JSON.stringify(['file', relative(compiler.context, file), suffix]) });
  }
  return { source, assetReferences };
}

/** The native CSS pipeline owns bytes, hashes, emission and asset updates. */
export function stylesheetAssetUrl(projectRoot: string, identity: string): string {
  const [, file, suffix] = JSON.parse(identity) as [string, string, string];
  // The host CSS loader decodes URL paths again. Preserve literal percent sequences
  // in the resolved filename; the authored query/fragment is already URL text.
  return resolve(projectRoot, file).replaceAll('%', '%25') + suffix;
}
