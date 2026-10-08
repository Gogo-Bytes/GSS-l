/* global URL, fetch, setTimeout, window, console */

import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const url = 'http://127.0.0.1:4178/';
const artifact = path.join(root, 'artifacts/browser-reference.json');
const controls = [
  'negativeControl', 'pseudoNegativeControl', 'conditionNegativeControl',
  'layerNegativeControl', 'nestedLayerNegativeControl', 'assetNegativeControl',
  'keyframesNegativeControl', 'fontResetNegativeControl', 'relationNegativeControl',
  'interleavedChainNegativeControl', 'interleavedDepthNegativeControl',
  'interleavedPrefixNegativeControl', 'interleavedGeneralPrefixNegativeControl',
  'interleavedGeneralRootNegativeControl', 'interleavedChildRootNegativeControl',
  'interleavedChildPrefixNegativeControl', 'crossLayerSpecificityNegativeControl',
  'hasSpecificityNegativeControl'
];
const server = spawn('corepack', ['pnpm', '--filter', '@gss-l/testing', 'browser:reference'], {
  cwd: root, stdio: ['ignore', 'pipe', 'pipe']
});
let serverOutput = '';
for (const stream of [server.stdout, server.stderr]) {
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => { serverOutput += chunk; });
}
let browser;
try {
  const deadline = Date.now() + 30_000;
  while (true) {
    if (server.exitCode !== null) throw new Error(`Browser host exited early: ${serverOutput}`);
    try {
      const response = await fetch(url);
      if (response.ok) break;
    } catch { /* Wait for the owned strict-port host. */ }
    if (Date.now() > deadline) throw new Error(`Browser host did not start: ${serverOutput}`);
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });
  await page.waitForFunction(
    () => window.__GSS_REFERENCE_RESULT__?.status !== undefined && window.__GSS_REFERENCE_RESULT__.status !== 'running',
    undefined,
    { timeout: 120_000 }
  );
  const result = await page.evaluate(() => window.__GSS_REFERENCE_RESULT__);
  await mkdir(path.dirname(artifact), { recursive: true });
  await writeFile(artifact, JSON.stringify({ result, errors }, null, 2));
  const comparisons = result.results?.reduce((sum, fixture) => sum + fixture.comparisons, 0);
  const failed = result.status !== 'passed' || result.results?.length !== 100 || comparisons !== 1055 ||
    result.results.some((fixture) => fixture.comparisons <= 0 || fixture.differences.length || fixture.expectedFailures.length) ||
    controls.some((key) => result[key]?.detected !== true) ||
    result.hasSpecificityDedup?.negativeControl?.detected !== true ||
    result.hasSpecificityDedup?.fixtures?.some((fixture) => fixture.differences.length) || errors.length;
  if (failed) throw new Error(`Browser oracle gate failed: status=${result.status}, fixtures=${result.results?.length}, comparisons=${comparisons}, errors=${errors.length}. See ${artifact}`);
  console.log(`Browser oracle passed: ${result.results.length} fixtures, ${comparisons} comparisons, ${controls.length} controls. ${artifact}`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
