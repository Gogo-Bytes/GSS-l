/* global document */
import assert from 'node:assert/strict';
import console from 'node:console';
import { URL } from 'node:url';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { classifyPropertyEffect } from '../../compiler/dist/domain/property-effects.js';

const require = createRequire(import.meta.url);
const catalog = require('mdn-data').css.properties;
const properties = Object.keys(catalog).filter(name => catalog[name].status === 'standard' && !name.startsWith('-')).sort();
const browser = await chromium.launch();
let observations;
const engine = browser.version();
try {
  const page = await browser.newPage();
  observations = await page.evaluate(names => names.map(property => {
    const style = document.createElement('i').style;
    style.setProperty(property, 'initial');
    return { property, observed: Array.from(style).sort() };
  }), properties);
} finally {
  await browser.close();
}

function compare({ property, observed }, { kind, effects }) {
  const missing = observed.filter(name => !effects.includes(name));
  const unobserved = effects.filter(name => !observed.includes(name)).sort();
  const prefixed = missing.filter(name => name.startsWith('-'));
  let status = 'same-names';
  if (!observed.length) status = 'not-observed';
  else if (kind === 'unknown') status = 'unregistered';
  else if (missing.length) status = missing.length === prefixed.length ? 'engine-prefixed-names' : 'review-missing';
  else if (unobserved.length) status = 'registry-only-names';
  return { property, status, kind, observed, missing, unobserved, prefixed };
}
const rows = observations.map(row => compare(row, classifyPropertyEffect(row.property)));

// Fault injection changes only the registry input, never the independent CSSOM observations.
const controls = [
  { property: 'white-space', faulty: { kind: 'longhand', effects: ['white-space'] }, expected: ['text-wrap-mode', 'white-space-collapse'] },
  { property: 'border', faulty: { kind: 'shorthand', effects: classifyPropertyEffect('border').effects.filter(name => !name.startsWith('border-image-')) },
    expected: ['border-image-outset', 'border-image-repeat', 'border-image-slice', 'border-image-source', 'border-image-width'] }
].map(({ property, faulty, expected }) => {
  const row = rows.find(item => item.property === property);
  const injected = compare(row, faulty);
  assert.equal(injected.status, 'review-missing');
  for (const effect of expected) {
    assert(injected.missing.includes(effect), `Control failed to detect ${property} → ${effect}`);
    assert(!row.missing.includes(effect), `Registry no longer covers ${property} → ${effect}`);
  }
  return { property, injected };
});

const report = { catalog: `mdn-data@${require('mdn-data/package.json').version}`, chromium: engine,
  playwright: require('playwright/package.json').version, value: 'initial', rows, controls };
const dir = new URL('../../artifacts/property-effects-audit/', import.meta.url);
await mkdir(dir, { recursive: true });
await writeFile(new URL('report.json', dir), JSON.stringify(report, null, 2) + '\n');
const expanded = rows.filter(row => row.observed.length > 1);
const candidates = expanded.filter(row => row.missing.length);
console.log(`${report.catalog}; Chromium ${engine}; ${rows.length} properties, ${expanded.length} enumerate multiple names, ${candidates.length} with missing names. Both fault controls detected. See artifacts/property-effects-audit/report.json`);
for (const row of candidates) console.log(`${row.property} (${row.kind}, ${row.status}): ${row.missing.join(', ')}`);
