import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import process from 'node:process';
import { URL } from 'node:url';
import console from 'node:console';

// Maintenance only. Compare explicit upstream relationships, never infer a singleton from missing metadata.
const raw = await readFile(process.argv[2]);
assert.equal(createHash('sha256').update(raw).digest('hex'), 'cf198a6fe97c168c30226c9c55732e013d8b39997b7df764f50d6af4c3038cb7', 'Expected @webref/css@8.8.0 package/css.json');
const specs = new Map(JSON.parse(raw).properties.map(p => [p.name, p]));
function expand(name, parents = []) {
  const entry = specs.get(name);
  assert.ok(entry && !parents.includes(name), `Invalid Webref path: ${[...parents, name].join(' -> ')}`);
  const children = entry.legacyAliasOf ? [entry.legacyAliasOf] : [...(entry.longhands ?? []), ...(entry.resetLonghands ?? [])];
  return children.length ? [...new Set(children.flatMap(child => expand(child, [...parents, name])))].sort() : [name];
}
const dir = new URL('../../artifacts/property-effects-audit/', import.meta.url);
const { rows, chromium, catalog } = JSON.parse(await readFile(new URL('report.json', dir), 'utf8'));
const candidates = rows.flatMap(({ property, observed, missing, unobserved, kind }) => {
  const p = specs.get(property);
  if (!p || !(p.longhands?.length || p.resetLonghands?.length || p.legacyAliasOf)) return [];
  const writes = expand(property);
  const registered = new Set([...observed.filter(n => !missing.includes(n)), ...unobserved]);
  return [{ property, spec: p.href, kind, writes, directResetWrites: [...new Set((p.resetLonghands ?? []).flatMap(child => expand(child)))].sort(),
    registryOnly: [...registered].filter(n => !writes.includes(n)), missingFromRegistry: writes.filter(n => !registered.has(n)),
    browserOnly: observed.filter(n => !writes.includes(n)), specOnly: writes.filter(n => !observed.includes(n)) }];
});
const border = candidates.find(p => p.property === 'border');
assert.equal(border.writes.length, 17);
assert.deepEqual(border.directResetWrites, ['outset','repeat','slice','source','width'].map(s => `border-image-${s}`));
assert.ok(candidates.find(p => p.property === 'white-space').writes.includes('text-wrap-mode'));
assert.deepEqual(candidates.find(p => p.property === 'word-wrap').writes, ['overflow-wrap']);
assert.ok(!candidates.some(p => p.property === 'all'));
await writeFile(new URL('webref-candidates.json', dir), JSON.stringify({ webref: '8.8.0', chromium, catalog, candidates }, null, 2) + '\n');
console.log(`${candidates.length} explicit Webref relationship candidates across ${rows.length} catalog entries; ${candidates.filter(p => p.browserOnly.length || p.specOnly.length).length} differ from CSSOM.`);
