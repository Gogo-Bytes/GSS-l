import payload from 'virtual:reference-fixtures';
import type { ScopeNodeSchema } from '@gss-l/compiler';
import type { CompiledReferenceFixture } from './fixtures.js';

// The Vite host typechecks this exact JSON payload before serialization.
const fixtures = payload as readonly CompiledReferenceFixture[];
type Fixture = CompiledReferenceFixture;
type Reading = { node: string; moduleId: string; path: readonly string[]; property: string; value: string; expected: string };

async function readDocument(fixture: Fixture, side: 'reference' | 'atomic', corrupt = false): Promise<Reading[]> {
  const frame = document.createElement('iframe');
  frame.title = `${fixture.name}: ${side}${corrupt ? ' negative control' : ''}`;
  frame.width = '640';
  frame.height = '360';
  const loaded = new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`Timed out loading ${frame.title}`)), 5000);
    frame.onload = () => { window.clearTimeout(timer); resolve(); };
  });
  frame.srcdoc = '<!doctype html><html><head><meta charset="UTF-8"></head><body></body></html>';
  document.querySelector('#documents')!.append(frame);
  await loaded;
  const doc = frame.contentDocument!;
  const style = doc.createElement('style');
  style.textContent = fixture[side].css;
  if (corrupt) style.textContent += '\n#forward { margin-left: 123px !important; }';
  doc.head.append(style);
  for (const node of fixture.nodes) {
    let targets = fixture[side].scopeSchemas[node.moduleId]!.exports;
    let scope: ScopeNodeSchema | undefined;
    for (const segment of node.path) {
      scope = targets[segment];
      if (!scope) throw new Error(`Missing ${side} mapping: ${node.moduleId}:${node.path.join('.')}`);
      targets = scope.targets;
    }
    const element = doc.createElement('div');
    element.id = node.id;
    element.className = scope!.selfClassName;
    element.textContent = node.id;
    const parent = node.parent ? doc.getElementById(node.parent) : doc.body;
    if (!parent) throw new Error(`Missing fixture parent: ${node.parent}`);
    parent.append(element);
  }
  return fixture.nodes.flatMap((node) => {
    const computed = frame.contentWindow!.getComputedStyle(doc.getElementById(node.id)!);
    return Object.entries(node.expected).map(([property, expected]) => ({
      node: node.id, moduleId: node.moduleId, path: node.path, property,
      value: computed.getPropertyValue(property), expected
    }));
  });
}

function compare(reference: readonly Reading[], atomic: readonly Reading[]) {
  return reference.flatMap((reading, index) => {
    const actual = atomic[index];
    if (!actual || actual.node !== reading.node || actual.property !== reading.property) {
      throw new Error('Fixture readings are not aligned');
    }
    return reading.value === actual.value ? [] : [{
      moduleId: reading.moduleId, path: reading.path, node: reading.node,
      property: reading.property, reference: reading.value, atomic: actual.value
    }];
  });
}

function publish(result: object) {
  Object.assign(window, { __GSS_REFERENCE_RESULT__: result });
  document.querySelector('#result')!.textContent = JSON.stringify(result, null, 2);
}

async function run() {
  const results = [];
  for (const fixture of fixtures) {
    const reference = await readDocument(fixture, 'reference');
    const atomic = await readDocument(fixture, 'atomic');
    const differences = compare(reference, atomic);
    const expectedFailures = [
      ...reference.filter((reading) => reading.value !== reading.expected).map((reading) => ({ side: 'reference', ...reading })),
      ...atomic.filter((reading) => reading.value !== reading.expected).map((reading) => ({ side: 'atomic', ...reading }))
    ];
    results.push({ name: fixture.name, comparisons: reference.length, differences, expectedFailures, reference, atomic });
  }
  const controlFixture = fixtures.find((fixture) => fixture.name === 'shorthand-longhand')!;
  const controlReference = await readDocument(controlFixture, 'reference');
  const corrupted = await readDocument(controlFixture, 'atomic', true);
  const differences = compare(controlReference, corrupted);
  const detected = differences.some((difference) => difference.node === 'forward' &&
    difference.property === 'margin-left' && difference.reference === '9px' && difference.atomic === '123px');
  publish({
    status: results.every((result) => result.comparisons > 0 && !result.differences.length && !result.expectedFailures.length) && detected
      ? 'passed' : 'failed',
    results,
    negativeControl: { detected, differences }
  });
}

publish({ status: 'running' });
void run().catch((error: unknown) => publish({ status: 'failed', error: String(error) }));
