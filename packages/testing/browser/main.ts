import payload from 'virtual:reference-fixtures';
import { animationMetadata, animationProbeNames, removeKeyframeDefinition } from './animation-metadata.js';
import type { ScopeNodeSchema } from '@gss-l/compiler';
import type { CompiledReferenceFixture } from './fixtures.js';

// The Vite host typechecks this exact JSON payload before serialization.
const fixtures = payload as readonly CompiledReferenceFixture[];
type Fixture = CompiledReferenceFixture;
type Reading = {
  phase: string; state: string; node: string; moduleId: string; path: readonly string[];
  subject: 'element' | '::before' | '::after'; property: string; value: string; expected: string;
};

async function readDocument(fixture: Fixture, side: 'reference' | 'atomic', corrupt?: 'element' | 'pseudo' | 'condition' | 'layer' | 'asset' | 'keyframes' | 'relation'): Promise<Reading[]> {
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
  const setup = doc.createElement('style');
  setup.dataset.role = 'identical-fixture-setup';
  setup.textContent = fixture.setupCss ?? '';
  doc.head.append(setup);
  const style = doc.createElement('style');
  style.textContent = fixture[side].css;
  if (corrupt === 'element') style.textContent += '\n#forward { margin-left: 123px !important; }';
  if (corrupt === 'asset') style.textContent += '\n#asset-a { background-image: url("/__reference_assets__/wrong.svg") !important; }';
  if (corrupt === 'pseudo') style.textContent += '\n#pseudo-a::before { color: rgb(1, 2, 3) !important; }';
  if (corrupt === 'condition') style.textContent += '\n@media (min-width: 400px) { #target { padding-left: 123px !important; } }';
  if (corrupt === 'layer') {
    const changed = style.textContent.replace(/@layer early,\s*late;/, '@layer late, early;');
    if (changed === style.textContent) throw new Error('Layer corruption did not change the prelude');
    style.textContent = changed;
  }
  doc.head.append(style);
  if (corrupt === 'relation') {
    // Move only the general-sibling color rule after adjacent, preserving specificity.
    const sheet = style.sheet!;
    const index = [...sheet.cssRules].findIndex((rule) => rule instanceof (frame.contentWindow as Window & typeof globalThis).CSSStyleRule &&
      (rule as CSSStyleRule).selectorText.includes(' ~ ') && (rule as CSSStyleRule).style.color === 'blue');
    if (index < 0 || index === sheet.cssRules.length - 1) throw new Error('Relation control must actually change rule order');
    const text = sheet.cssRules[index]!.cssText;
    sheet.deleteRule(index);
    sheet.insertRule(text, sheet.cssRules.length);
  }
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
  const probeNames = animationProbeNames(doc, fixture);
  if (corrupt === 'keyframes') {
    const name = probeNames.get('MotionA.gss/pulse');
    if (!name) throw new Error('Missing intended keyframe control probe');
    removeKeyframeDefinition(style, name);
  }
  const readings: Reading[] = [];
  const phases: NonNullable<Fixture['phases']> = [
    { name: 'baseline', changes: [], expected: Object.fromEntries(fixture.nodes.map((node) => [node.id, node.expected])),
      pseudoExpected: Object.fromEntries(fixture.nodes.map((node) => [node.id, node.pseudoExpected ?? {}])) },
    ...fixture.phases ?? []
  ];
  for (const phase of phases) {
    if (phase.viewportWidth !== undefined) frame.width = String(phase.viewportWidth);
    if (phase.containerWidth !== undefined) {
      const provider = doc.getElementById(fixture.conditionProbes?.container ?? '');
      if (!provider) throw new Error('Missing size query provider');
      provider.style.width = `${phase.containerWidth}px`;
    }
    // Viewport/container query changes settle in the native frame before sampling.
    await new Promise<void>((resolve) => frame.contentWindow!.requestAnimationFrame(() =>
      frame.contentWindow!.requestAnimationFrame(() => resolve())));

    for (const change of phase.changes) {
      const element = doc.getElementById(change.node);
      if (!element) throw new Error(`Missing phase node: ${change.node}`);
      if (change.checked !== undefined) {
        if (element.tagName !== 'INPUT') throw new Error('Checked requires a native input');
        (element as HTMLInputElement).checked = change.checked;
      }
      if (change.disabled !== undefined) {
        if (!['INPUT', 'FIELDSET', 'BUTTON'].includes(element.tagName)) throw new Error('Disabled requires a native input, fieldset or button');
        (element as HTMLInputElement | HTMLFieldSetElement | HTMLButtonElement).disabled = change.disabled;
      }
      for (const [name, value] of Object.entries(change.attributes ?? {})) {
        if (!/^(data|aria)-/.test(name)) throw new Error(`Not a fixture state attribute: ${name}`);
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    }
    // Include ancestor conditions and actual native pseudo matches in every difference report.
    const win = frame.contentWindow as Window & typeof globalThis;
    const conditionState = {
      viewportWidth: win.innerWidth,
      media: Object.fromEntries((fixture.conditionProbes?.media ?? []).map((query) => [query, win.matchMedia(query).matches])),
      supports: Object.fromEntries((fixture.conditionProbes?.supports ?? []).map((query) => [query, win.CSS.supports(query)])),
      containerWidth: fixture.conditionProbes?.container
        ? win.getComputedStyle(doc.getElementById(fixture.conditionProbes.container)!).width : null
    };
    if (fixture.conditionProbes?.supports && (conditionState.supports['(display: block)'] !== true ||
      conditionState.supports['(display: grid)'] !== true || conditionState.supports['(display: gss-unsupported)'] !== false)) {
      throw new Error('Native CSS.supports probes differ from fixture requirements');
    }
    const state = JSON.stringify({ conditions: conditionState, nodes: fixture.nodes.map((node) => {
      const element = doc.getElementById(node.id)!;
      return { node: node.id, checked: element.matches(':checked'), disabled: element.matches(':disabled'),
        attributes: Object.fromEntries([...element.attributes].filter((attribute) => /^(data|aria)-/.test(attribute.name))
          .map((attribute) => [attribute.name, attribute.value])) };
    }) });
    for (const node of fixture.nodes) {
      if (node.animationExpected) {
        const label = `${node.moduleId}/${node.animationExpected.symbol}`;
        for (const reading of await animationMetadata(doc.getElementById(node.id)!, node.animationExpected, probeNames.get(label), label)) {
          readings.push({ phase: phase.name, state, node: node.id, moduleId: node.moduleId,
            path: node.path, subject: 'element', ...reading });
        }
      }
      for (const subject of ['element', '::before', '::after'] as const) {
        const expected = (subject === 'element' ? phase.expected[node.id] : phase.pseudoExpected?.[node.id]?.[subject]) ?? {};
        const baseline = (subject === 'element' ? node.expected : node.pseudoExpected?.[subject]) ?? {};
        if (Object.keys(expected).sort().join() !== Object.keys(baseline).sort().join()) {
          throw new Error(`Incomplete touched expectations: ${fixture.name}/${phase.name}/${node.id}/${subject}`);
        }
        const computed = frame.contentWindow!.getComputedStyle(doc.getElementById(node.id)!, subject === 'element' ? null : subject);
        for (const [property, value] of Object.entries(expected)) {
          const actual = computed.getPropertyValue(property);
          // URL expectations are authored literals resolved against this owned host, never atomic CSS.
          const expectedUrl = property === 'background-image' ? /^url\("([^"]+)"\)$/.exec(value)?.[1] : undefined;
          readings.push({ phase: phase.name, state, node: node.id, moduleId: node.moduleId,
            path: node.path, subject, property, value: actual,
            expected: expectedUrl ? `url("${new URL(expectedUrl, window.location.href).href}")` : value });
          if (expectedUrl && fixture.assetDimensions) {
            const expectedSize = fixture.assetDimensions[expectedUrl];
            const actualUrl = /^url\("([^"]+)"\)$/.exec(actual)?.[1];
            if (!expectedSize || !actualUrl) throw new Error('Missing literal Asset dimensions or computed URL');
            const size = await decodedImageSize(win, actualUrl);
            readings.push({ phase: phase.name, state, node: node.id, moduleId: node.moduleId,
              path: node.path, subject, property: 'background-image:decoded-dimensions', value: size, expected: expectedSize });
          }
        }
      }
    }
  }
  return readings;
}

// Decode the bytes selected by each side's computed background URL. This proves
// load/content dimensions, not background painting or platform-dependent pixels.
async function decodedImageSize(win: Window & typeof globalThis, url: string): Promise<string> {
  const parsed = new URL(url);
  if (parsed.origin !== window.location.origin || !parsed.pathname.startsWith('/__reference_assets__/')) {
    throw new Error(`Unexpected non-owned Asset URL: ${url}`);
  }
  const image = new win.Image();
  image.src = url;
  let timer: number | undefined;
  try {
    await Promise.race([image.decode(), new Promise<never>((_, reject) => {
      timer = window.setTimeout(() => reject(new Error(`Asset decode timed out: ${url}`)), 5000);
    })]);
    if (!image.naturalWidth || !image.naturalHeight) throw new Error(`Empty decoded Asset: ${url}`);
    return `${image.naturalWidth}x${image.naturalHeight}`;
  } finally { window.clearTimeout(timer); }
}

function compare(reference: readonly Reading[], atomic: readonly Reading[]) {
  return reference.flatMap((reading, index) => {
    const actual = atomic[index];
    if (!actual || actual.node !== reading.node || actual.property !== reading.property ||
      actual.phase !== reading.phase || actual.state !== reading.state || actual.subject !== reading.subject) {
      throw new Error('Fixture readings are not aligned');
    }
    return reading.value === actual.value ? [] : [{
      phase: reading.phase, state: reading.state, moduleId: reading.moduleId, path: reading.path, node: reading.node,
      subject: reading.subject, property: reading.property, reference: reading.value, atomic: actual.value
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
  const corrupted = await readDocument(controlFixture, 'atomic', 'element');
  const differences = compare(controlReference, corrupted);
  const detected = differences.some((difference) => difference.node === 'forward' &&
    difference.property === 'margin-left' && difference.reference === '9px' && difference.atomic === '123px');
  const pseudoFixture = fixtures.find((fixture) => fixture.name === 'pseudo-module-isolation')!;
  const pseudoReference = await readDocument(pseudoFixture, 'reference');
  const pseudoAtomic = await readDocument(pseudoFixture, 'atomic');
  const pseudoCorrupted = await readDocument(pseudoFixture, 'atomic', 'pseudo');
  const pseudoDifferences = compare(pseudoReference, pseudoCorrupted);
  const corruptionDifferences = compare(pseudoAtomic, pseudoCorrupted);
  const controlsUnchanged = corruptionDifferences.length === 1 && corruptionDifferences[0]!.node === 'pseudo-a' &&
    corruptionDifferences[0]!.subject === '::before' && corruptionDifferences[0]!.property === 'color';
  const pseudoDetected = controlsUnchanged && pseudoDifferences.length === 1 && pseudoDifferences.some((difference) =>
    difference.node === 'pseudo-a' && difference.subject === '::before' && difference.property === 'color' &&
    difference.reference === 'rgb(255, 0, 0)' && difference.atomic === 'rgb(1, 2, 3)');
  const conditionFixture = fixtures.find((fixture) => fixture.name === 'registered-media-forward-source-forward-config')!;
  const conditionReference = await readDocument(conditionFixture, 'reference');
  const conditionAtomic = await readDocument(conditionFixture, 'atomic');
  const conditionCorrupted = await readDocument(conditionFixture, 'atomic', 'condition');
  const conditionDifferences = compare(conditionReference, conditionCorrupted);
  const conditionDetected = conditionDifferences.length === 2 && conditionDifferences.every((difference) =>
    ['baseline', 'restored-both'].includes(difference.phase) && difference.node === 'target' &&
    difference.property === 'padding-left' && difference.reference === '7px' && difference.atomic === '123px') &&
    compare(conditionAtomic, conditionCorrupted).length === 2;
  const layerFixture = fixtures.find((fixture) => fixture.name === 'native-layers-forward-source-forward-config')!;
  const layerReference = await readDocument(layerFixture, 'reference');
  const layerCorrupted = await readDocument(layerFixture, 'atomic', 'layer');
  const layerDifferences = compare(layerReference, layerCorrupted);
  const layerDetected = layerDifferences.length === 3 && layerDifferences.every((difference) =>
    difference.property === 'color' && (difference.node === 'layer-normal'
      ? difference.reference === 'rgb(0, 0, 255)' && difference.atomic === 'rgb(255, 0, 0)'
      : ['layer-important', 'unlayered-important'].includes(difference.node) &&
        difference.reference === 'rgb(255, 0, 0)' && difference.atomic === 'rgb(0, 0, 255)'));
  const assetFixture = fixtures.find((fixture) => fixture.name === 'asset-module-isolation-one')!;
  const assetReference = await readDocument(assetFixture, 'reference');
  const assetAtomic = await readDocument(assetFixture, 'atomic');
  const assetCorrupted = await readDocument(assetFixture, 'atomic', 'asset');
  const assetDifferences = compare(assetReference, assetCorrupted);
  const assetControlsUnchanged = compare(assetAtomic, assetCorrupted).length === 2 &&
    assetDifferences.length === 2 && assetDifferences.every((difference) => difference.node === 'asset-a');
  const assetDetected = assetControlsUnchanged && assetDifferences.some((difference) =>
    difference.property === 'background-image:decoded-dimensions' && difference.reference === '3x2' && difference.atomic === '11x7');
  const keyframesFixture = fixtures.find((fixture) => fixture.name === 'keyframes-module-isolation-forward')!;
  const keyframesReference = await readDocument(keyframesFixture, 'reference');
  const keyframesAtomic = await readDocument(keyframesFixture, 'atomic');
  const keyframesCorrupted = await readDocument(keyframesFixture, 'atomic', 'keyframes');
  const keyframesDifferences = compare(keyframesReference, keyframesCorrupted);
  const keyframesChanges = compare(keyframesAtomic, keyframesCorrupted);
  const keyframesControlsUnchanged = keyframesChanges.length === 5 && keyframesChanges.every((difference) =>
    difference.node === 'motion-a' && difference.property.startsWith('animation:'));
  const keyframesDetected = keyframesControlsUnchanged && keyframesDifferences.length === 5 && keyframesDifferences.some((difference) =>
    difference.node === 'motion-a' && difference.property === 'animation:count' && difference.reference === '1' && difference.atomic === '0');
  const relationFixture = fixtures.find((fixture) => fixture.name === 'structural-sibling-base-forward')!;
  const relationReference = await readDocument(relationFixture, 'reference');
  const relationAtomic = await readDocument(relationFixture, 'atomic');
  const relationCorrupted = await readDocument(relationFixture, 'atomic', 'relation');
  const relationDifferences = compare(relationReference, relationCorrupted);
  const relationChanges = compare(relationAtomic, relationCorrupted);
  const relationControlsUnchanged = relationChanges.length === 1 && relationChanges[0]!.node === 'adjacent' &&
    relationChanges[0]!.property === 'color';
  const relationDetected = relationControlsUnchanged && compare(relationReference, relationAtomic).length === 0 &&
    relationDifferences.length === 1 && relationDifferences[0]!.node === 'adjacent' &&
    relationDifferences[0]!.reference === 'rgb(255, 0, 0)' && relationDifferences[0]!.atomic === 'rgb(0, 0, 255)';
  publish({
    relationNegativeControl: { detected: relationDetected, controlsUnchanged: relationControlsUnchanged, ruleReordered: true, differences: relationDifferences },
    status: results.every((result) => result.comparisons > 0 && !result.differences.length && !result.expectedFailures.length) && detected && pseudoDetected && conditionDetected && layerDetected && assetDetected && keyframesDetected && relationDetected
      ? 'passed' : 'failed',
    results,
    negativeControl: { detected, differences },
    keyframesNegativeControl: { detected: keyframesDetected, controlsUnchanged: keyframesControlsUnchanged, definitionRemoved: true, differences: keyframesDifferences },
    assetNegativeControl: { detected: assetDetected, controlsUnchanged: assetControlsUnchanged, differences: assetDifferences },
    conditionNegativeControl: { detected: conditionDetected, differences: conditionDifferences },
    layerNegativeControl: { detected: layerDetected, differences: layerDifferences },
    pseudoNegativeControl: { detected: pseudoDetected, controlsUnchanged, differences: pseudoDifferences }
  });
}

publish({ status: 'running' });
void run().catch((error: unknown) => publish({ status: 'failed', error: String(error) }));
