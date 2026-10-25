import { expect, it } from 'vitest';
import type { Rollup } from 'vite';
import { reachableModuleIds } from '../src/production-census.js';

it.each([false, true])('censuses static/lazy dependencies with implicit-load metadata present=%s', (implicit) => {
  const graph = new Map([
    ['entry', { isEntry: true, importedIds: ['static', 'external'], dynamicallyImportedIds: ['lazy'],
      ...(implicit ? { implicitlyLoadedBefore: ['implicit'] } : {}) }],
    ['static', { importedIds: ['entry'], dynamicallyImportedIds: [] }],
    ['lazy', { importedIds: [], dynamicallyImportedIds: [] }],
    ['implicit', { importedIds: [], dynamicallyImportedIds: [] }],
    ['external', { isExternal: true, importedIds: [], dynamicallyImportedIds: [] }],
    ['unreachable', { importedIds: [], dynamicallyImportedIds: [] }]
  ]);
  const context = {
    getModuleIds: () => graph.keys(),
    getModuleInfo: (id: string) => graph.get(id) ?? null
  } as unknown as Rollup.PluginContext;
  expect(reachableModuleIds(context)).toEqual(implicit ? ['entry', 'implicit', 'lazy', 'static'] : ['entry', 'lazy', 'static']);
});
