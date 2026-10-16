import assert from 'node:assert/strict';
import process from 'node:process';
import console from 'node:console';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { fileURLToPath, URL } from 'node:url';
import { join } from 'node:path';

assert.ok(process.argv.slice(2).every((argument) => argument === '--computed-only'), 'Only --computed-only is supported; omit it for full rendering coverage');
const root = fileURLToPath(new URL('../../../../artifacts/cross-browser-rendering/task-board/', import.meta.url));
const run = join(root, new Date().toISOString().replaceAll(':', '-'));
await mkdir(run, { recursive: true });
const results = [];
for (const engine of ['chromium', 'firefox', 'webkit']) {
  const artifacts = join(run, engine);
  await mkdir(artifacts);
  const log = createWriteStream(join(artifacts, 'check.log'));
  const child = spawn(process.execPath, [fileURLToPath(new URL('./check-engine.mjs', import.meta.url)), engine, ...process.argv.slice(2)], {
    env: { ...process.env, TASK_BOARD_ARTIFACTS: artifacts }, stdio: ['ignore', 'pipe', 'pipe']
  });
  for (const stream of [child.stdout, child.stderr]) stream.on('data', (data) => { log.write(data); process.stdout.write(data); });
  const exit = await new Promise((resolve) => {
    child.on('error', (error) => { log.write(String(error)); resolve(1); });
    child.on('close', (code) => resolve(code ?? 1));
  });
  log.end(); await finished(log);
  let result;
  try { result = JSON.parse(await readFile(join(artifacts, 'result.json'), 'utf8')); }
  catch (error) { result = { passed: false, error: String(error) }; }
  results.push({ engine, exit, artifacts, ...result });
}
const summary = { run, comparison: 'GSS versus independent native CSS within each engine; never across engines',
  passed: results.every((result) => result.exit === 0 && result.passed), results };
await writeFile(join(run, 'result.json'), JSON.stringify(summary, null, 2));
await writeFile(join(root, 'latest.json'), JSON.stringify({ run, passed: summary.passed }, null, 2));
console.log(`Task board evidence: ${run}`);
if (!summary.passed) process.exitCode = 1;
