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

async function readDocument(fixture: Fixture, side: 'reference' | 'atomic', corrupt?: 'element' | 'pseudo' | 'condition' | 'layer' | 'nested-layer' | 'asset' | 'keyframes' | 'relation' | 'interleaved' | 'interleaved-depth' | 'interleaved-prefix' | 'interleaved-general-prefix' | 'interleaved-general-root' | 'interleaved-child-root' | 'interleaved-child-prefix' | 'cross-layer-specificity' | 'font-reset' | 'has-specificity' | 'has-specificity-dedup' | 'external-anchor' | 'external-ancestor' | 'external-media' | 'external-compound' | 'owned-external-condition' | 'external-observation' | 'functional-external'): Promise<Reading[]> {
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
  if (corrupt === 'font-reset') style.textContent += '\n#font-reset { font-variant: small-caps !important; }';
  if (corrupt === 'asset') style.textContent += '\n#asset-a { background-image: url("/__reference_assets__/wrong.svg") !important; }';
  if (corrupt === 'pseudo') style.textContent += '\n#pseudo-a::before { color: rgb(1, 2, 3) !important; }';
  if (corrupt === 'condition') style.textContent += '\n@media (min-width: 400px) { #target { padding-left: 123px !important; } }';
  if (corrupt === 'layer') {
    const changed = style.textContent.replace(/@layer early,\s*late;/, '@layer late, early;');
    if (changed === style.textContent) throw new Error('Layer corruption did not change the prelude');
    style.textContent = changed;
  }
  if (corrupt === 'nested-layer') {
    const changed = style.textContent.replace(
      '@layer framework.base, framework.utilities;',
      '@layer framework.utilities, framework.base;'
    );
    if (changed === style.textContent) throw new Error('Nested-layer control did not change the configured prelude');
    style.textContent = changed;
  }
  if (corrupt === 'cross-layer-specificity') {
    const changed = style.textContent.replace('@layer base, override;', '@layer override, base;');
    if (changed === style.textContent) throw new Error('Cross-layer specificity control did not change the configured prelude');
    style.textContent = changed;
  }
  if (corrupt === 'external-anchor') {
    const changed = style.textContent.replace(/\.[^\s{]+ \.ProseMirror-focused(?=\s*\{)/, '.ProseMirror-focused');
    if (changed === style.textContent) throw new Error('External control did not remove the owned anchor');
    style.textContent = changed;
  }
  if (corrupt === 'external-ancestor') {
    const changed = style.textContent.replace(/^\.[^\s{]+ /, '');
    if (changed === style.textContent) throw new Error('External ancestor control did not remove the owned prefix');
    style.textContent = changed;
  }
  if (corrupt === 'external-compound') {
    const changed = style.textContent.replace('.ProseMirror.ProseMirror-focused {', '.ProseMirror {');
    if (changed === style.textContent) throw new Error('External compound control did not remove the focus qualifier');
    style.textContent = changed;
  }
  if (corrupt === 'owned-external-condition') {
    const changed = style.textContent.replace(/\.ProseMirror-focused(?=\s*\{)/, '');
    if (changed === style.textContent) throw new Error('Owned external condition control did not remove the qualifier');
    style.textContent = changed;
  }
  if (corrupt === 'external-observation') {
    const changed = style.textContent.replace(/:has\(\.ProseMirror-focused\)(?=\s*\{)/, '');
    if (changed === style.textContent) throw new Error('External observation control did not remove the :has condition');
    style.textContent = changed;
  }
  if (corrupt === 'functional-external') {
    const predicate = /:(?:not|is|where)\(\.external\)(?=\s*\{)/g;
    if ([...style.textContent.matchAll(predicate)].length !== 3) {
      throw new Error('Functional external control did not find all three qualifiers');
    }
    style.textContent = style.textContent.replace(predicate, '');
  }
  doc.head.append(style);
  if (corrupt === 'external-media') {
    const layer = [...style.sheet!.cssRules].find((rule) => rule.cssText.startsWith('@layer base {')) as CSSGroupingRule | undefined;
    const media = layer?.cssRules[0];
    if (!layer || !(media instanceof (frame.contentWindow as Window & typeof globalThis).CSSMediaRule) ||
      media.conditionText !== '(min-width: 400px)' || media.cssRules.length !== 1) {
      throw new Error('External media control requires one registered media rule inside the authored layer');
    }
    const css = media.cssRules[0]!.cssText;
    layer.deleteRule(0);
    layer.insertRule(css, 0);
  }
  if (corrupt === 'has-specificity-dedup') {
    const sheet = style.sheet!;
    const rule = [...sheet.cssRules].map((item, index) => ({ item, index })).find(({ item }) =>
      item instanceof (frame.contentWindow as Window & typeof globalThis).CSSStyleRule &&
      (item as CSSStyleRule).selectorText.includes('--observed_error') &&
      (item as CSSStyleRule).style.color === 'red' &&
      (item as CSSStyleRule).selectorText.slice(0, (item as CSSStyleRule).selectorText.indexOf(':has(')).split('.').filter(Boolean).length === 3
    );
    if (!rule) throw new Error('Dedup specificity control requires the stronger shared .error selector');
    const cssRule = rule.item as CSSStyleRule;
    const separator = cssRule.selectorText.indexOf(':has(');
    const subject = cssRule.selectorText.slice(0, separator);
    const markers = subject.split('.').filter(Boolean);
    if (markers.length !== 3 || !markers.every((marker) => marker === markers[0])) {
      throw new Error('Dedup specificity control requires three repeated target-qualified markers');
    }
    const weakenedSelector = `.${markers[0]}.${markers[0]}${cssRule.selectorText.slice(separator)}`;
    const cssText = cssRule.cssText.slice(cssRule.cssText.indexOf('{'));
    sheet.deleteRule(rule.index);
    sheet.insertRule(`${weakenedSelector} ${cssText}`, rule.index);
  }
  if (corrupt === 'has-specificity') {
    const sheet = style.sheet!;
    const index = [...sheet.cssRules].findIndex((rule) => rule instanceof (frame.contentWindow as Window & typeof globalThis).CSSStyleRule &&
      (rule as CSSStyleRule).selectorText.includes('--observed_error') && (rule as CSSStyleRule).selectorText.includes(':has(:where('));
    const rule = sheet.cssRules[index] as CSSStyleRule | undefined;
    if (index < 0 || !rule) throw new Error('Specificity control requires the lower :has() list branch');
    const separator = rule.selectorText.indexOf(':has(');
    const subject = rule.selectorText.slice(0, separator);
    const markers = subject.split('.').filter(Boolean);
    if (markers.length < 2 || !markers.every((marker) => marker === markers[0])) {
      throw new Error('Specificity control requires repeated target-qualified markers');
    }
    const weakenedSelector = `.${markers[0]}${rule.selectorText.slice(separator)}`;
    const cssText = rule.cssText.slice(rule.cssText.indexOf('{'));
    sheet.deleteRule(index);
    sheet.insertRule(`${weakenedSelector} ${cssText}`, index);
  }
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
  if (corrupt === 'interleaved' || corrupt === 'interleaved-prefix' || corrupt === 'interleaved-general-prefix' || corrupt === 'interleaved-general-root' || corrupt === 'interleaved-child-root' || corrupt === 'interleaved-child-prefix') {
    // Replace only the runtime edge in the bounded interleaved selector.
    const sheet = style.sheet!;
    const relation = corrupt === 'interleaved-general-prefix' || corrupt === 'interleaved-general-root' ? ' ~ '
      : corrupt === 'interleaved-child-root' || corrupt === 'interleaved-child-prefix' ? ' > ' : ' + ';
    const index = [...sheet.cssRules].findIndex((rule) => rule instanceof (frame.contentWindow as Window & typeof globalThis).CSSStyleRule &&
      (rule as CSSStyleRule).selectorText.includes(relation) && (rule as CSSStyleRule).style.color === 'red');
    const rule = sheet.cssRules[index] as CSSStyleRule | undefined;
    if (index < 0 || !rule) throw new Error('Interleaved control requires the intended red rule');
    const selector = rule.selectorText;
    const weakened = selector.replace(relation, corrupt === 'interleaved-child-root' || corrupt === 'interleaved-child-prefix' ? ' + ' : ' ');
    if (weakened === selector) throw new Error('Interleaved control did not alter the intended runtime edge');
    const declarations = rule.style.cssText;
    sheet.deleteRule(index);
    sheet.insertRule(`${weakened} { ${declarations} }`, index);
  }
  if (corrupt === 'interleaved-depth') {
    // Collapse only the final ownership-descendant edge in the deeper chain.
    const sheet = style.sheet!;
    const index = [...sheet.cssRules].findIndex((rule) => rule instanceof (frame.contentWindow as Window & typeof globalThis).CSSStyleRule &&
      (rule as CSSStyleRule).selectorText.includes('--position_2--') && (rule as CSSStyleRule).style.color === 'red');
    const rule = sheet.cssRules[index] as CSSStyleRule | undefined;
    if (index < 0 || !rule) throw new Error('Deep ownership control requires the red position-2 rule');
    const selector = rule.selectorText;
    const separator = selector.lastIndexOf(' .');
    if (separator < 0) throw new Error('Deep ownership control requires a trailing descendant edge');
    const weakened = selector.slice(0, separator) + selector.slice(separator + 1);
    const declarations = rule.style.cssText;
    sheet.deleteRule(index);
    sheet.insertRule(`${weakened} { ${declarations} }`, index);
  }
  const ownedClasses = new Map<string, string>();
  for (const node of fixture.nodes) {
    if (node.externalClassName !== undefined && node.extraClassName !== undefined) {
      throw new Error('An external fixture node cannot also claim an owned scope');
    }
    let scope: ScopeNodeSchema | undefined;
    if (node.externalClassName === undefined) {
      let targets = fixture[side].scopeSchemas[node.moduleId]!.exports;
      for (const segment of node.path) {
        scope = targets[segment];
        if (!scope) throw new Error(`Missing ${side} mapping: ${node.moduleId}:${node.path.join('.')}`);
        targets = scope.targets;
      }
    } else if (node.path.length > 0) throw new Error('An external fixture node must not have an owned scope path');
    const element = doc.createElement(node.tag ?? 'div');
    if (element.tagName === 'INPUT') (element as HTMLInputElement).type = 'checkbox';
    element.id = node.id;
    if (scope) ownedClasses.set(node.id, scope.selfClassName);
    element.className = node.externalClassName ?? [scope!.selfClassName, node.extraClassName ?? ''].filter(Boolean).join(' ');
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
      if (change.externalClassName !== undefined) {
        if (!fixture.nodes.some((node) => node.id === change.node && node.externalClassName !== undefined)) {
          throw new Error('Only fixture-owned external nodes may change their classes');
        }
        element.className = change.externalClassName;
      }
      if (change.extraClassName !== undefined) {
        const ownedClass = ownedClasses.get(change.node);
        if (!ownedClass || !fixture.nodes.some((node) => node.id === change.node && node.extraClassName !== undefined)) {
          throw new Error('Only fixture-owned GSS nodes may change their third-party class');
        }
        element.className = [ownedClass, change.extraClassName].filter(Boolean).join(' ');
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
  const nestedLayerFixture = fixtures.find((fixture) => fixture.name === 'nested-layers-forward-source-forward-config')!;
  const nestedLayerReference = await readDocument(nestedLayerFixture, 'reference');
  const nestedLayerAtomic = await readDocument(nestedLayerFixture, 'atomic');
  const nestedLayerCorrupted = await readDocument(nestedLayerFixture, 'atomic', 'nested-layer');
  const nestedLayerDifferences = compare(nestedLayerReference, nestedLayerCorrupted);
  const nestedLayerChanges = compare(nestedLayerAtomic, nestedLayerCorrupted);
  const nestedLayerExpected = new Map([
    ['color', ['rgb(0, 0, 255)', 'rgb(255, 0, 0)']],
    ['background-color', ['rgb(255, 0, 0)', 'rgb(0, 0, 255)']],
    ['outline-color', ['rgb(255, 0, 0)', 'rgb(0, 0, 255)']]
  ]);
  const nestedLayerDetected = nestedLayerChanges.length === 3 && nestedLayerDifferences.length === 3 &&
    [...nestedLayerExpected].every(([property, [reference, atomic]]) =>
      nestedLayerDifferences.some((difference) => difference.node === 'nested-layer-probe' &&
        difference.property === property && difference.reference === reference && difference.atomic === atomic) &&
      nestedLayerChanges.some((difference) => difference.node === 'nested-layer-probe' && difference.property === property)) &&
    !nestedLayerDifferences.some((difference) => difference.property === 'border-top-color');
  const crossLayerSpecificityFixture = fixtures.find((fixture) => fixture.name === 'cross-layer-specificity-forward-source-forward-config')!;
  const crossLayerSpecificityReference = await readDocument(crossLayerSpecificityFixture, 'reference');
  const crossLayerSpecificityAtomic = await readDocument(crossLayerSpecificityFixture, 'atomic');
  const crossLayerSpecificityCorrupted = await readDocument(crossLayerSpecificityFixture, 'atomic', 'cross-layer-specificity');
  const crossLayerSpecificityDifferences = compare(crossLayerSpecificityReference, crossLayerSpecificityCorrupted);
  const crossLayerSpecificityChanges = compare(crossLayerSpecificityAtomic, crossLayerSpecificityCorrupted);
  const crossLayerSpecificityDetected = compare(crossLayerSpecificityReference, crossLayerSpecificityAtomic).length === 0 &&
    crossLayerSpecificityChanges.length === 2 && crossLayerSpecificityDifferences.length === 2 &&
    crossLayerSpecificityDifferences.some((difference) => difference.phase === 'ready' && difference.property === 'color' &&
      difference.reference === 'rgb(0, 0, 255)' && difference.atomic === 'rgb(255, 0, 0)') &&
    crossLayerSpecificityDifferences.some((difference) => difference.phase === 'ready' && difference.property === 'background-color' &&
      difference.reference === 'rgb(255, 0, 0)' && difference.atomic === 'rgb(0, 0, 255)') &&
    !crossLayerSpecificityDifferences.some((difference) => difference.property === 'outline-color');
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
  const fontResetFixture = fixtures.find((fixture) => fixture.name === 'font-shorthand-resets-font-variant')!;
  const fontResetReference = await readDocument(fontResetFixture, 'reference');
  const fontResetAtomic = await readDocument(fontResetFixture, 'atomic');
  const fontResetCorrupted = await readDocument(fontResetFixture, 'atomic', 'font-reset');
  const fontResetDifferences = compare(fontResetReference, fontResetCorrupted);
  const fontResetChanges = compare(fontResetAtomic, fontResetCorrupted);
  const fontResetNegativeControl = fontResetChanges.length === 1 && fontResetChanges[0]!.node === 'font-reset' &&
    fontResetChanges[0]!.property === 'font-variant-caps' && fontResetChanges[0]!.reference === 'normal' &&
    fontResetChanges[0]!.atomic === 'small-caps' && fontResetDifferences.length === 1;
  const hasSpecificityFixture = fixtures.find((fixture) => fixture.name === 'has-selector-list-specificity-forward')!;
  const hasSpecificityReference = await readDocument(hasSpecificityFixture, 'reference');
  const hasSpecificityAtomic = await readDocument(hasSpecificityFixture, 'atomic');
  const hasSpecificityCorrupted = await readDocument(hasSpecificityFixture, 'atomic', 'has-specificity');
  const hasSpecificityDifferences = compare(hasSpecificityReference, hasSpecificityCorrupted);
  const hasSpecificityChanges = compare(hasSpecificityAtomic, hasSpecificityCorrupted);
  const hasSpecificityControlsUnchanged = hasSpecificityChanges.length === 1 &&
    hasSpecificityChanges[0]!.node === 'card' && hasSpecificityChanges[0]!.phase === 'lower-branch-matches-maximum-branch-does-not' &&
    hasSpecificityChanges[0]!.property === 'color';
  const hasSpecificityDetected = hasSpecificityControlsUnchanged && hasSpecificityDifferences.length === 1 &&
    hasSpecificityDifferences[0]!.node === 'card' && hasSpecificityDifferences[0]!.reference === 'rgb(255, 0, 0)' &&
    hasSpecificityDifferences[0]!.atomic === 'rgb(0, 0, 255)';
  const hasSpecificityDedupFixtures = fixtures.filter((fixture) => fixture.name.startsWith('has-selector-list-shared-branch-'));
  const hasSpecificityDedupResults = await Promise.all(hasSpecificityDedupFixtures.map(async (fixture) => {
    const reference = await readDocument(fixture, 'reference');
    const atomic = await readDocument(fixture, 'atomic');
    return { name: fixture.name, differences: compare(reference, atomic) };
  }));
  const hasSpecificityDedupFixture = hasSpecificityDedupFixtures.find((fixture) =>
    fixture.name === 'has-selector-list-shared-branch-forward-list-weaker-first'
  )!;
  const hasSpecificityDedupReference = await readDocument(hasSpecificityDedupFixture, 'reference');
  const hasSpecificityDedupCorrupted = await readDocument(hasSpecificityDedupFixture, 'atomic', 'has-specificity-dedup');
  const hasSpecificityDedupDifferences = compare(hasSpecificityDedupReference, hasSpecificityDedupCorrupted);
  const hasSpecificityDedupAtomic = await readDocument(hasSpecificityDedupFixture, 'atomic');
  const hasSpecificityDedupChanges = compare(hasSpecificityDedupAtomic, hasSpecificityDedupCorrupted);
  const hasSpecificityDedupControl = hasSpecificityDedupChanges.length === 1 &&
    hasSpecificityDedupChanges[0]!.node === 'card' && hasSpecificityDedupChanges[0]!.property === 'color' &&
    hasSpecificityDedupDifferences.length === 1 && hasSpecificityDedupDifferences[0]!.reference === 'rgb(255, 0, 0)' &&
    hasSpecificityDedupDifferences[0]!.atomic === 'rgb(0, 0, 255)';
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
  const interleavedFixture = fixtures.find((fixture) => fixture.name === 'interleaved-owned-descendant-forward')!;
  const interleavedReference = await readDocument(interleavedFixture, 'reference');
  const interleavedAtomic = await readDocument(interleavedFixture, 'atomic');
  const interleavedCorrupted = await readDocument(interleavedFixture, 'atomic', 'interleaved');
  const interleavedDifferences = compare(interleavedReference, interleavedCorrupted);
  const interleavedChanges = compare(interleavedAtomic, interleavedCorrupted);
  const interleavedDetected = compare(interleavedReference, interleavedAtomic).length === 0 &&
    interleavedChanges.length === 1 && interleavedChanges[0]!.node === 'icon' && interleavedChanges[0]!.property === 'color' &&
    interleavedDifferences.length === 1 && interleavedDifferences[0]!.node === 'icon' &&
    interleavedDifferences[0]!.property === 'color' && interleavedDifferences[0]!.reference === 'rgb(255, 0, 0)' &&
    interleavedDifferences[0]!.atomic === 'rgb(0, 0, 0)';
  const interleavedDepthFixture = fixtures.find((fixture) => fixture.name === 'interleaved-owned-descendant-deep-forward')!;
  const interleavedDepthReference = await readDocument(interleavedDepthFixture, 'reference');
  const interleavedDepthAtomic = await readDocument(interleavedDepthFixture, 'atomic');
  const interleavedDepthCorrupted = await readDocument(interleavedDepthFixture, 'atomic', 'interleaved-depth');
  const interleavedDepthDifferences = compare(interleavedDepthReference, interleavedDepthCorrupted);
  const interleavedDepthChanges = compare(interleavedDepthAtomic, interleavedDepthCorrupted);
  const interleavedDepthDetected = compare(interleavedDepthReference, interleavedDepthAtomic).length === 0 &&
    interleavedDepthChanges.length === 1 && interleavedDepthChanges[0]!.node === 'badge' &&
    interleavedDepthChanges[0]!.property === 'color' && interleavedDepthDifferences.length === 1 &&
    interleavedDepthDifferences[0]!.node === 'badge' && interleavedDepthDifferences[0]!.property === 'color' &&
    interleavedDepthDifferences[0]!.reference === 'rgb(255, 0, 0)' &&
    interleavedDepthDifferences[0]!.atomic === 'rgb(0, 0, 0)';
  const interleavedPrefixFixture = fixtures.find((fixture) => fixture.name === 'interleaved-owned-descendant-prefix-forward')!;
  const interleavedPrefixReference = await readDocument(interleavedPrefixFixture, 'reference');
  const interleavedPrefixAtomic = await readDocument(interleavedPrefixFixture, 'atomic');
  const interleavedPrefixCorrupted = await readDocument(interleavedPrefixFixture, 'atomic', 'interleaved-prefix');
  const interleavedPrefixDifferences = compare(interleavedPrefixReference, interleavedPrefixCorrupted);
  const interleavedPrefixChanges = compare(interleavedPrefixAtomic, interleavedPrefixCorrupted);
  const interleavedPrefixDetected = compare(interleavedPrefixReference, interleavedPrefixAtomic).length === 0 &&
    interleavedPrefixChanges.length === 1 && interleavedPrefixChanges[0]!.node === 'icon' &&
    interleavedPrefixChanges[0]!.property === 'color' && interleavedPrefixDifferences.length === 1 &&
    interleavedPrefixDifferences[0]!.node === 'icon' && interleavedPrefixDifferences[0]!.property === 'color' &&
    interleavedPrefixDifferences[0]!.reference === 'rgb(255, 0, 0)' &&
    interleavedPrefixDifferences[0]!.atomic === 'rgb(0, 0, 0)';
  const interleavedGeneralPrefixFixture = fixtures.find((fixture) => fixture.name === 'interleaved-owned-descendant-general-prefix-forward')!;
  const interleavedGeneralPrefixReference = await readDocument(interleavedGeneralPrefixFixture, 'reference');
  const interleavedGeneralPrefixAtomic = await readDocument(interleavedGeneralPrefixFixture, 'atomic');
  const interleavedGeneralPrefixCorrupted = await readDocument(interleavedGeneralPrefixFixture, 'atomic', 'interleaved-general-prefix');
  const interleavedGeneralPrefixDifferences = compare(interleavedGeneralPrefixReference, interleavedGeneralPrefixCorrupted);
  const interleavedGeneralPrefixChanges = compare(interleavedGeneralPrefixAtomic, interleavedGeneralPrefixCorrupted);
  const interleavedGeneralPrefixDetected = compare(interleavedGeneralPrefixReference, interleavedGeneralPrefixAtomic).length === 0 &&
    interleavedGeneralPrefixChanges.length === 1 && interleavedGeneralPrefixChanges[0]!.node === 'icon' &&
    interleavedGeneralPrefixChanges[0]!.property === 'color' && interleavedGeneralPrefixDifferences.length === 1 &&
    interleavedGeneralPrefixDifferences[0]!.node === 'icon' && interleavedGeneralPrefixDifferences[0]!.property === 'color' &&
    interleavedGeneralPrefixDifferences[0]!.reference === 'rgb(255, 0, 0)' &&
    interleavedGeneralPrefixDifferences[0]!.atomic === 'rgb(0, 0, 0)';
  const interleavedGeneralRootFixture = fixtures.find((fixture) => fixture.name === 'interleaved-owned-descendant-general-root-forward')!;
  const interleavedGeneralRootReference = await readDocument(interleavedGeneralRootFixture, 'reference');
  const interleavedGeneralRootAtomic = await readDocument(interleavedGeneralRootFixture, 'atomic');
  const interleavedGeneralRootCorrupted = await readDocument(interleavedGeneralRootFixture, 'atomic', 'interleaved-general-root');
  const interleavedGeneralRootDifferences = compare(interleavedGeneralRootReference, interleavedGeneralRootCorrupted);
  const interleavedGeneralRootChanges = compare(interleavedGeneralRootAtomic, interleavedGeneralRootCorrupted);
  const interleavedGeneralRootDetected = compare(interleavedGeneralRootReference, interleavedGeneralRootAtomic).length === 0 &&
    interleavedGeneralRootChanges.length === 1 && interleavedGeneralRootChanges[0]!.node === 'icon' &&
    interleavedGeneralRootChanges[0]!.property === 'color' && interleavedGeneralRootDifferences.length === 1 &&
    interleavedGeneralRootDifferences[0]!.node === 'icon' && interleavedGeneralRootDifferences[0]!.property === 'color' &&
    interleavedGeneralRootDifferences[0]!.reference === 'rgb(255, 0, 0)' &&
    interleavedGeneralRootDifferences[0]!.atomic === 'rgb(0, 0, 0)';
  const interleavedChildRootFixture = fixtures.find((fixture) => fixture.name === 'interleaved-owned-descendant-child-root-forward')!;
  const interleavedChildRootReference = await readDocument(interleavedChildRootFixture, 'reference');
  const interleavedChildRootAtomic = await readDocument(interleavedChildRootFixture, 'atomic');
  const interleavedChildRootCorrupted = await readDocument(interleavedChildRootFixture, 'atomic', 'interleaved-child-root');
  const interleavedChildRootDifferences = compare(interleavedChildRootReference, interleavedChildRootCorrupted);
  const interleavedChildRootChanges = compare(interleavedChildRootAtomic, interleavedChildRootCorrupted);
  const interleavedChildRootDetected = compare(interleavedChildRootReference, interleavedChildRootAtomic).length === 0 &&
    interleavedChildRootChanges.length === 1 && interleavedChildRootChanges[0]!.node === 'icon' &&
    interleavedChildRootChanges[0]!.property === 'color' && interleavedChildRootDifferences.length === 1 &&
    interleavedChildRootDifferences[0]!.node === 'icon' && interleavedChildRootDifferences[0]!.property === 'color' &&
    interleavedChildRootDifferences[0]!.reference === 'rgb(255, 0, 0)' &&
    interleavedChildRootDifferences[0]!.atomic === 'rgb(0, 0, 0)';
  const interleavedChildPrefixFixture = fixtures.find((fixture) => fixture.name === 'interleaved-owned-descendant-child-prefix-forward')!;
  const interleavedChildPrefixReference = await readDocument(interleavedChildPrefixFixture, 'reference');
  const interleavedChildPrefixAtomic = await readDocument(interleavedChildPrefixFixture, 'atomic');
  const interleavedChildPrefixCorrupted = await readDocument(interleavedChildPrefixFixture, 'atomic', 'interleaved-child-prefix');
  const interleavedChildPrefixDifferences = compare(interleavedChildPrefixReference, interleavedChildPrefixCorrupted);
  const interleavedChildPrefixChanges = compare(interleavedChildPrefixAtomic, interleavedChildPrefixCorrupted);
  const interleavedChildPrefixDetected = compare(interleavedChildPrefixReference, interleavedChildPrefixAtomic).length === 0 &&
    interleavedChildPrefixChanges.length === 1 && interleavedChildPrefixChanges[0]!.node === 'icon' &&
    interleavedChildPrefixChanges[0]!.property === 'color' && interleavedChildPrefixDifferences.length === 1 &&
    interleavedChildPrefixDifferences[0]!.node === 'icon' && interleavedChildPrefixDifferences[0]!.property === 'color' &&
    interleavedChildPrefixDifferences[0]!.reference === 'rgb(255, 0, 0)' &&
    interleavedChildPrefixDifferences[0]!.atomic === 'rgb(0, 0, 0)';
  const externalFixture = fixtures.find((fixture) => fixture.name === 'external-descendant-anchored-dynamic-class')!;
  const externalReference = await readDocument(externalFixture, 'reference');
  const externalAtomic = await readDocument(externalFixture, 'atomic');
  const externalCorrupted = await readDocument(externalFixture, 'atomic', 'external-anchor');
  const externalChanges = compare(externalAtomic, externalCorrupted);
  const externalDifferences = compare(externalReference, externalCorrupted);
  const externalAnchorDetected = compare(externalReference, externalAtomic).length === 0 &&
    externalChanges.length === 3 && externalDifferences.length === 3 &&
    externalDifferences.every((difference) => difference.node === 'external-outside' &&
      difference.property === 'color' && difference.reference === 'rgb(0, 0, 0)' &&
      difference.atomic === 'rgb(255, 0, 0)');
  const externalAncestorFixture = fixtures.find((fixture) => fixture.name === 'external-descendant-owned-ancestor-specificity')!;
  const externalAncestorReference = await readDocument(externalAncestorFixture, 'reference');
  const externalAncestorAtomic = await readDocument(externalAncestorFixture, 'atomic');
  const externalAncestorCorrupted = await readDocument(externalAncestorFixture, 'atomic', 'external-ancestor');
  const externalAncestorDifferences = compare(externalAncestorReference, externalAncestorCorrupted);
  const externalAncestorChanges = compare(externalAncestorAtomic, externalAncestorCorrupted);
  const externalAncestorDetected = compare(externalAncestorReference, externalAncestorAtomic).length === 0 &&
    externalAncestorChanges.length === 2 && externalAncestorDifferences.length === 2 &&
    externalAncestorDifferences.every((difference) => difference.node === 'nested-external' &&
      difference.property === 'color' && ['baseline', 'class-restored'].includes(difference.phase) &&
      difference.reference === 'rgb(255, 0, 0)' && difference.atomic === 'rgb(0, 0, 255)');
  const externalMediaFixture = fixtures.find((fixture) => fixture.name === 'external-descendant-registered-media-layer')!;
  const externalMediaReference = await readDocument(externalMediaFixture, 'reference');
  const externalMediaAtomic = await readDocument(externalMediaFixture, 'atomic');
  const externalMediaCorrupted = await readDocument(externalMediaFixture, 'atomic', 'external-media');
  const externalMediaDifferences = compare(externalMediaReference, externalMediaCorrupted);
  const externalMediaChanges = compare(externalMediaAtomic, externalMediaCorrupted);
  const externalMediaDetected = compare(externalMediaReference, externalMediaAtomic).length === 0 &&
    externalMediaChanges.length === 1 && externalMediaDifferences.length === 1 &&
    externalMediaDifferences[0]!.node === 'conditioned-inside' &&
    externalMediaDifferences[0]!.phase === 'media-off' && externalMediaDifferences[0]!.property === 'color' &&
    externalMediaDifferences[0]!.reference === 'rgb(0, 0, 0)' &&
    externalMediaDifferences[0]!.atomic === 'rgb(255, 0, 0)';
  const externalCompoundFixture = fixtures.find((fixture) => fixture.name === 'external-descendant-compound-class')!;
  const externalCompoundReference = await readDocument(externalCompoundFixture, 'reference');
  const externalCompoundAtomic = await readDocument(externalCompoundFixture, 'atomic');
  const externalCompoundCorrupted = await readDocument(externalCompoundFixture, 'atomic', 'external-compound');
  const externalCompoundDifferences = compare(externalCompoundReference, externalCompoundCorrupted);
  const externalCompoundChanges = compare(externalCompoundAtomic, externalCompoundCorrupted);
  const externalCompoundDetected = compare(externalCompoundReference, externalCompoundAtomic).length === 0 &&
    externalCompoundChanges.length === 1 && externalCompoundDifferences.length === 1 &&
    externalCompoundDifferences[0]!.node === 'compound-inside' &&
    externalCompoundDifferences[0]!.phase === 'focus-class-removed' && externalCompoundDifferences[0]!.property === 'color' &&
    externalCompoundDifferences[0]!.reference === 'rgb(0, 0, 0)' &&
    externalCompoundDifferences[0]!.atomic === 'rgb(255, 0, 0)';
  const sameNodeFixture = fixtures.find((fixture) => fixture.name === 'owned-node-external-class-condition')!;
  const sameNodeReference = await readDocument(sameNodeFixture, 'reference');
  const sameNodeAtomic = await readDocument(sameNodeFixture, 'atomic');
  const sameNodeCorrupted = await readDocument(sameNodeFixture, 'atomic', 'owned-external-condition');
  const sameNodeDifferences = compare(sameNodeReference, sameNodeCorrupted);
  const sameNodeChanges = compare(sameNodeAtomic, sameNodeCorrupted);
  const sameNodeDetected = compare(sameNodeReference, sameNodeAtomic).length === 0 &&
    sameNodeChanges.length === 4 && sameNodeDifferences.length === 4 &&
    sameNodeDifferences.every((difference) => ['editor-focused', 'editor-unfocused'].includes(difference.node) &&
      difference.property === 'color' && difference.reference === 'rgb(0, 0, 0)' &&
      difference.atomic === 'rgb(255, 0, 0)') &&
    sameNodeDifferences.some((difference) => difference.node === 'editor-focused' &&
      difference.phase === 'owned-focus-removed');
  const refinementFixture = fixtures.find((fixture) => fixture.name === 'same-node-refinement-base-first')!;
  const refinementReference = await readDocument(refinementFixture, 'reference');
  const refinementAtomic = await readDocument(refinementFixture, 'atomic');
  const refinementCorrupted = await readDocument(refinementFixture, 'atomic', 'owned-external-condition');
  const refinementDifferences = compare(refinementReference, refinementCorrupted);
  const refinementChanges = compare(refinementAtomic, refinementCorrupted);
  const refinementDetected = compare(refinementReference, refinementAtomic).length === 0 &&
    refinementChanges.length === 2 && refinementDifferences.length === 2 &&
    refinementDifferences.every((difference) => difference.node === 'editor-focused' &&
      difference.property === 'color' && ['baseline', 'owned-focus-restored'].includes(difference.phase) &&
      difference.reference === 'rgb(255, 0, 0)' && difference.atomic === 'rgb(0, 0, 255)');
  const externalObservationFixture = fixtures.find((fixture) => fixture.name === 'observed-external-descendant-class')!;
  const externalObservationReference = await readDocument(externalObservationFixture, 'reference');
  const externalObservationAtomic = await readDocument(externalObservationFixture, 'atomic');
  const externalObservationCorrupted = await readDocument(externalObservationFixture, 'atomic', 'external-observation');
  const externalObservationDifferences = compare(externalObservationReference, externalObservationCorrupted);
  const externalObservationChanges = compare(externalObservationAtomic, externalObservationCorrupted);
  const externalObservationDetected = compare(externalObservationReference, externalObservationAtomic).length === 0 &&
    externalObservationChanges.length === 4 && externalObservationDifferences.length === 4 &&
    externalObservationDifferences.every((difference) => ['editor', 'editor-empty'].includes(difference.node) &&
      difference.property === 'background-color' && difference.reference === 'rgba(0, 0, 0, 0)' &&
      difference.atomic === 'rgb(255, 0, 0)') &&
    externalObservationDifferences.some((difference) => difference.node === 'editor' &&
      difference.phase === 'observed-class-removed');
  const functionalFixture = fixtures.find((fixture) => fixture.name === 'functional-external-owned-conditions')!;
  const functionalReference = await readDocument(functionalFixture, 'reference');
  const functionalAtomic = await readDocument(functionalFixture, 'atomic');
  const functionalCorrupted = await readDocument(functionalFixture, 'atomic', 'functional-external');
  const functionalDifferences = compare(functionalReference, functionalCorrupted);
  const functionalDetected = compare(functionalReference, functionalAtomic).length === 0 &&
    compare(functionalAtomic, functionalCorrupted).length === 10 && functionalDifferences.length === 10 &&
    ['not-with-class', 'is-without-class', 'where-without-class'].every((node) =>
      functionalDifferences.some((difference) => difference.node === node)) &&
    functionalDifferences.every((difference) => difference.property === 'background-color');
  publish({
    functionalExternalNegativeControl: { detected: functionalDetected, predicatesRemoved: 3, differences: functionalDifferences },
    externalObservationNegativeControl: { detected: externalObservationDetected, predicateRemoved: true, differences: externalObservationDifferences },
    ownedExternalRefinementNegativeControl: { detected: refinementDetected, qualifierRemoved: true, differences: refinementDifferences },
    ownedExternalConditionNegativeControl: { detected: sameNodeDetected, qualifierRemoved: true, differences: sameNodeDifferences },
    externalCompoundNegativeControl: { detected: externalCompoundDetected, qualifierRemoved: true, differences: externalCompoundDifferences },
    externalMediaNegativeControl: { detected: externalMediaDetected, wrapperRemoved: true, differences: externalMediaDifferences },
    externalAncestorNegativeControl: { detected: externalAncestorDetected, prefixRemoved: true, differences: externalAncestorDifferences },
    externalAnchorNegativeControl: { detected: externalAnchorDetected, anchorRemoved: true, differences: externalDifferences },
    relationNegativeControl: { detected: relationDetected, controlsUnchanged: relationControlsUnchanged, ruleReordered: true, differences: relationDifferences },
    interleavedChainNegativeControl: { detected: interleavedDetected, controlsUnchanged: interleavedChanges.length === 1, adjacentEdgeRemoved: true, differences: interleavedDifferences },
    interleavedDepthNegativeControl: { detected: interleavedDepthDetected, controlsUnchanged: interleavedDepthChanges.length === 1, finalDescendantEdgeCollapsed: true, differences: interleavedDepthDifferences },
    interleavedPrefixNegativeControl: { detected: interleavedPrefixDetected, controlsUnchanged: interleavedPrefixChanges.length === 1, adjacentEdgeRemoved: true, differences: interleavedPrefixDifferences },
    interleavedGeneralPrefixNegativeControl: { detected: interleavedGeneralPrefixDetected, controlsUnchanged: interleavedGeneralPrefixChanges.length === 1, generalSiblingEdgeRemoved: true, differences: interleavedGeneralPrefixDifferences },
    interleavedGeneralRootNegativeControl: { detected: interleavedGeneralRootDetected, controlsUnchanged: interleavedGeneralRootChanges.length === 1, generalSiblingEdgeRemoved: true, differences: interleavedGeneralRootDifferences },
    interleavedChildRootNegativeControl: { detected: interleavedChildRootDetected, controlsUnchanged: interleavedChildRootChanges.length === 1, childEdgeChangedToAdjacent: true, differences: interleavedChildRootDifferences },
    interleavedChildPrefixNegativeControl: { detected: interleavedChildPrefixDetected, controlsUnchanged: interleavedChildPrefixChanges.length === 1, childEdgeChangedToAdjacent: true, differences: interleavedChildPrefixDifferences },
    crossLayerSpecificityNegativeControl: { detected: crossLayerSpecificityDetected, controlsUnchanged: crossLayerSpecificityChanges.length === 2 && !crossLayerSpecificityChanges.some((difference) => difference.property === 'outline-color'), configuredOrderPerturbed: true, differences: crossLayerSpecificityDifferences },
    hasSpecificityNegativeControl: { detected: hasSpecificityDetected, controlsUnchanged: hasSpecificityControlsUnchanged, qualifierRemoved: true, differences: hasSpecificityDifferences },
    hasSpecificityDedup: { fixtures: hasSpecificityDedupResults, negativeControl: { detected: hasSpecificityDedupControl, qualifierRemoved: true, differences: hasSpecificityDedupDifferences } },
    status: results.every((result) => result.comparisons > 0 && !result.differences.length && !result.expectedFailures.length) &&
      hasSpecificityDedupResults.every((result) => result.differences.length === 0) && hasSpecificityDedupControl &&
      detected && pseudoDetected && conditionDetected && layerDetected && nestedLayerDetected && assetDetected && keyframesDetected && relationDetected && interleavedDetected && interleavedDepthDetected && interleavedPrefixDetected && interleavedGeneralPrefixDetected && interleavedGeneralRootDetected && interleavedChildRootDetected && interleavedChildPrefixDetected && crossLayerSpecificityDetected && hasSpecificityDetected && fontResetNegativeControl && externalAnchorDetected && externalAncestorDetected && externalMediaDetected && externalCompoundDetected && sameNodeDetected && refinementDetected && externalObservationDetected && functionalDetected
      ? 'passed' : 'failed',
    results,
    negativeControl: { detected, differences },
    fontResetNegativeControl: { detected: fontResetNegativeControl, differences: fontResetDifferences },
    keyframesNegativeControl: { detected: keyframesDetected, controlsUnchanged: keyframesControlsUnchanged, definitionRemoved: true, differences: keyframesDifferences },
    assetNegativeControl: { detected: assetDetected, controlsUnchanged: assetControlsUnchanged, differences: assetDifferences },
    conditionNegativeControl: { detected: conditionDetected, differences: conditionDifferences },
    layerNegativeControl: { detected: layerDetected, differences: layerDifferences },
    nestedLayerNegativeControl: { detected: nestedLayerDetected, controlsUnchanged: nestedLayerChanges.length === 3 && !nestedLayerChanges.some((difference) => difference.property === 'border-top-color'), configuredOrderPerturbed: true, differences: nestedLayerDifferences },
    pseudoNegativeControl: { detected: pseudoDetected, controlsUnchanged, differences: pseudoDifferences }
  });
}

publish({ status: 'running' });
void run().catch((error: unknown) => publish({ status: 'failed', error: String(error) }));
