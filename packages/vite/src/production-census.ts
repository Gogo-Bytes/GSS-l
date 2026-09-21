import type { Rollup } from 'vite';

/** Include static, lazy and implicitly emitted dependencies, but not speculative loads. */
export function reachableModuleIds(context: Rollup.PluginContext): string[] {
  const pending = [...context.getModuleIds()].filter((id) => context.getModuleInfo(id)?.isEntry);
  const visited = new Set<string>();
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (visited.has(id)) continue;
    const info = context.getModuleInfo(id);
    if (!info || info.isExternal) continue;
    visited.add(id);
    pending.push(...info.importedIds, ...info.dynamicallyImportedIds, ...info.implicitlyLoadedBefore);
  }
  return [...visited].sort();
}
