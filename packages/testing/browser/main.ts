import payload from 'virtual:reference-fixtures';
import type { ScopeNodeSchema } from '@gss-l/compiler';
import type { CompiledReferenceFixture } from './fixtures.js';

// The Vite host typechecks this exact JSON payload before serialization.
const fixtures = payload as readonly CompiledReferenceFixture[];
type Fixture = CompiledReferenceFixture;
type Reading = {
  phase: string; state: string; node: string; moduleId: string; path: readonly string[];
  property: string; value: string; expected: string;
};

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
    const element = doc.createElement(node.tag ?? 'div');
    if (element.tagName === 'INPUT') (element as HTMLInputElement).type = 'checkbox';
    element.id = node.id;
    element.className = scope!.selfClassName;
    if (element.tagName !== 'INPUT') element.textContent = node.id;
    const parent = node.parent ? doc.getElementById(node.parent) : doc.body;
    if (!parent) throw new Error(`Missing fixture parent: ${node.parent}`);
    parent.append(element);
  }
  const readings: Reading[] = [];
  const phases = [
    { name: 'baseline', changes: [], expected: Object.fromEntries(fixture.nodes.map((node) => [node.id, node.expected])) },
    ...fixture.phases ?? []
  ];
  for (const phase of phases) {
    for (const change of phase.changes) {
      const element = doc.getElementById(change.node);
      if (!element) throw new Error(`Missing phase node: ${change.node}`);
      if (change.checked !== undefined) {
        if (element.tagName !== 'INPUT') throw new Error('Checked requires a native input');
        (element as HTMLInputElement).checked = change.checked;
      }
      if (change.disabled !== undefined) {
        if (!['INPUT', 'FIELDSET'].includes(element.tagName)) throw new Error('Disabled requires a native input or fieldset');
        (element as HTMLInputElement | HTMLFieldSetElement).disabled = change.disabled;
      }
      for (const [name, value] of Object.entries(change.attributes ?? {})) {
        if (!/^(data|aria)-/.test(name)) throw new Error(`Not a fixture state attribute: ${name}`);
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    }
    // Include ancestor conditions and actual native pseudo matches in every difference report.
    const state = JSON.stringify(fixture.nodes.map((node) => {
      const element = doc.getElementById(node.id)!;
      return { node: node.id, checked: element.matches(':checked'), disabled: element.matches(':disabled'),
        attributes: Object.fromEntries([...element.attributes].filter((attribute) => /^(data|aria)-/.test(attribute.name))
          .map((attribute) => [attribute.name, attribute.value])) };
    }));
    for (const node of fixture.nodes) {
      const expected = phase.expected[node.id] ?? {};
      if (Object.keys(expected).sort().join() !== Object.keys(node.expected).sort().join()) {
        throw new Error(`Incomplete touched expectations: ${fixture.name}/${phase.name}/${node.id}`);
      }
      const computed = frame.contentWindow!.getComputedStyle(doc.getElementById(node.id)!);
      for (const [property, value] of Object.entries(expected)) {
        readings.push({ phase: phase.name, state, node: node.id, moduleId: node.moduleId,
          path: node.path, property, value: computed.getPropertyValue(property), expected: value });
      }
    }
  }
  return readings;
}

function compare(reference: readonly Reading[], atomic: readonly Reading[]) {
  return reference.flatMap((reading, index) => {
    const actual = atomic[index];
    if (!actual || actual.node !== reading.node || actual.property !== reading.property ||
      actual.phase !== reading.phase || actual.state !== reading.state) {
      throw new Error('Fixture readings are not aligned');
    }
    return reading.value === actual.value ? [] : [{
      phase: reading.phase, state: reading.state, moduleId: reading.moduleId, path: reading.path, node: reading.node,
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
    results.push({ name: fixture.name, phases: [...new Set(reference.map((reading) => reading.phase))],
      comparisons: reference.length, differences, expectedFailures, reference, atomic });
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
