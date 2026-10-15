import payload from 'virtual:reference-fixtures';
import { readDocument, type Reading } from './read-fixture.js';
import type { CompiledReferenceFixture } from './fixtures.js';

// The Vite host typechecks this exact JSON payload before serialization.
const fixtures = payload as readonly CompiledReferenceFixture[];
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
  const keywordFixture = fixtures.find((fixture) => fixture.name === 'keyword-like-keyframe-explicit-longhand')!;
  const keywordReference = await readDocument(keywordFixture, 'reference');
  const keywordAtomic = await readDocument(keywordFixture, 'atomic');
  const keywordCorrupted = await readDocument(keywordFixture, 'atomic', 'keyword-keyframe');
  const keywordDifferences = compare(keywordReference, keywordCorrupted);
  const keywordChanges = compare(keywordAtomic, keywordCorrupted);
  const keywordDetected = compare(keywordReference, keywordAtomic).length === 0 &&
    keywordChanges.length === 5 && keywordDifferences.length === 5 &&
    keywordDifferences.every((difference) => difference.node === 'keyword-motion' &&
      difference.property.startsWith('animation:')) &&
    keywordDifferences.some((difference) => difference.property === 'animation:count' &&
      difference.reference === '1' && difference.atomic === '0');
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
  const hasTypeListFixture = fixtures.find((fixture) => fixture.name === 'has-type-only-list-forward')!;
  const typeReference = await readDocument(hasTypeListFixture, 'reference');
  const typeAtomic = await readDocument(hasTypeListFixture, 'atomic');
  const typeCorrupted = await readDocument(hasTypeListFixture, 'atomic', 'has-type-list');
  const typeDifferences = compare(typeReference, typeCorrupted);
  const typeChanges = compare(typeAtomic, typeCorrupted);
  const hasTypeListDetected = compare(typeReference, typeAtomic).length === 0 &&
    typeChanges.length === 1 && typeDifferences.length === 1 &&
    typeChanges[0]!.node === 'card-button' && typeChanges[0]!.property === 'background-color' &&
    typeDifferences[0]!.node === 'card-button' && typeDifferences[0]!.property === 'background-color' &&
    typeDifferences[0]!.reference === 'rgb(255, 0, 0)' && typeDifferences[0]!.atomic === 'rgb(0, 0, 255)';
  const conditionalKeyframeFixture = fixtures.find((fixture) => fixture.name === 'disjoint-registered-width-keyframes')!;
  const conditionalReference = await readDocument(conditionalKeyframeFixture, 'reference');
  const conditionalAtomic = await readDocument(conditionalKeyframeFixture, 'atomic');
  const conditionalCorrupted = await readDocument(conditionalKeyframeFixture, 'atomic', 'conditional-keyframe');
  const conditionalDifferences = compare(conditionalReference, conditionalCorrupted);
  const conditionalChanges = compare(conditionalAtomic, conditionalCorrupted);
  const conditionalKeyframeDetected = compare(conditionalReference, conditionalAtomic).length === 0 &&
    conditionalChanges.length === 2 && conditionalDifferences.length === 2 &&
    conditionalDifferences.every((difference) => difference.node === 'width-motion' &&
      difference.property === 'animation:frames' && difference.phase !== 'narrow-media');
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
  const compatibilityFixture = fixtures.find((fixture) => fixture.name === 'host-target-indivisible-flex-sequence')!;
  const compatibilityReference = await readDocument(compatibilityFixture, 'reference');
  const compatibilityAtomic = await readDocument(compatibilityFixture, 'atomic');
  const compatibilityCorrupted = await readDocument(compatibilityFixture, 'atomic', 'compatibility-sequence');
  const compatibilityDifferences = compare(compatibilityReference, compatibilityCorrupted);
  const compatibilityDetected = compare(compatibilityReference, compatibilityAtomic).length === 0 &&
    compare(compatibilityAtomic, compatibilityCorrupted).length === 1 &&
    compatibilityDifferences.length === 1 && compatibilityDifferences[0]?.node === 'card' &&
    compatibilityDifferences[0]?.property === 'display' &&
    compatibilityDifferences[0]?.reference === 'flex' && compatibilityDifferences[0]?.atomic === 'block';
  const fallbackFixture = fixtures.find((fixture) => fixture.name === 'host-target-preserved-media-isolation')!;
  const fallbackReference = await readDocument(fallbackFixture, 'reference');
  const fallbackAtomic = await readDocument(fallbackFixture, 'atomic');
  const fallbackCorrupted = await readDocument(fallbackFixture, 'atomic', 'compatibility-fallback-media');
  const fallbackDifferences = compare(fallbackReference, fallbackCorrupted);
  const fallbackDetected = compare(fallbackReference, fallbackAtomic).length === 0 &&
    compare(fallbackAtomic, fallbackCorrupted).length === 2 && fallbackDifferences.length === 2 &&
    fallbackDifferences.every((difference) => difference.phase === 'media-off' && difference.node === 'fallback-card') &&
    fallbackDifferences.some((difference) => difference.property === 'color' &&
      difference.reference === 'rgb(0, 0, 0)' && difference.atomic === 'rgb(255, 0, 0)') &&
    fallbackDifferences.some((difference) => difference.property === 'flex-direction' &&
      difference.reference === 'row' && difference.atomic === 'column');
  const resourceFixture = fixtures.find((fixture) => fixture.name === 'host-target-asset-property-resource')!;
  const resourceReference = await readDocument(resourceFixture, 'reference');
  const resourceAtomic = await readDocument(resourceFixture, 'atomic');
  const compatAssetCorrupted = await readDocument(resourceFixture, 'atomic', 'compatibility-asset');
  const compatPropertyCorrupted = await readDocument(resourceFixture, 'atomic', 'compatibility-property');
  const compatAssetDifferences = compare(resourceReference, compatAssetCorrupted);
  const compatPropertyDifferences = compare(resourceReference, compatPropertyCorrupted);
  const resourceBaseline = compare(resourceReference, resourceAtomic).length === 0;
  const compatAssetDetected = resourceBaseline && compare(resourceAtomic, compatAssetCorrupted).length === 2 &&
    compatAssetDifferences.length === 2 && compatAssetDifferences.every((difference) => difference.node === 'resource-card') &&
    compatAssetDifferences.some((difference) => difference.property === 'background-image' &&
      difference.atomic.includes('/__reference_assets__/wrong.svg')) &&
    compatAssetDifferences.some((difference) => difference.property === 'background-image:decoded-dimensions' &&
      difference.reference === '3x2' && difference.atomic === '11x7');
  const compatPropertyDetected = resourceBaseline && compare(resourceAtomic, compatPropertyCorrupted).length === 1 &&
    compatPropertyDifferences.length === 1 && compatPropertyDifferences[0]?.node === 'resource-card' &&
    compatPropertyDifferences[0]?.property === 'color' && compatPropertyDifferences[0]?.reference === 'rgb(255, 0, 0)' &&
    compatPropertyDifferences[0]?.atomic === 'rgb(0, 0, 0)';
  const inheritanceFixture = fixtures.find((fixture) => fixture.name === 'registered-property-inheritance-and-module-isolation')!;
  const inheritanceReference = await readDocument(inheritanceFixture, 'reference');
  const inheritanceAtomic = await readDocument(inheritanceFixture, 'atomic');
  const inheritanceCorrupted = await readDocument(inheritanceFixture, 'atomic', 'property-inheritance');
  const inheritanceDifferences = compare(inheritanceReference, inheritanceCorrupted);
  const inheritanceDetected = compare(inheritanceReference, inheritanceAtomic).length === 0 &&
    compare(inheritanceAtomic, inheritanceCorrupted).length === 6 && inheritanceDifferences.length === 6 &&
    inheritanceDifferences.every((difference) =>
      ['baseline', 'restored'].includes(difference.phase) &&
      ((difference.node === 'inherit-parent' && difference.property === '--tone') ||
        (difference.node === 'inherit-child' && ['--tone', 'color'].includes(difference.property))) &&
      difference.reference === 'rgb(0, 0, 255)' && difference.atomic === 'rgb(255, 0, 0)');
  const shapeFixture = fixtures.find((fixture) => fixture.name === 'external-tag-attribute-owned-anchor')!;
  const shapeReference = await readDocument(shapeFixture, 'reference');
  const shapeAtomic = await readDocument(shapeFixture, 'atomic');
  const shapeCorrupted = await readDocument(shapeFixture, 'atomic', 'external-tag-anchor');
  const shapeDifferences = compare(shapeReference, shapeCorrupted);
  const attributeCorrupted = await readDocument(shapeFixture, 'atomic', 'external-attribute-qualifier');
  const attributeDifferences = compare(shapeReference, attributeCorrupted);
  const attributeDetected = compare(shapeReference, shapeAtomic).length === 0 &&
    compare(shapeAtomic, attributeCorrupted).length === 2 && attributeDifferences.length === 2 &&
    attributeDifferences.every((difference) => difference.node === 'shape-attribute' &&
      difference.property === 'background-color' && ['baseline', 'attribute-restored'].includes(difference.phase) &&
      difference.reference === 'rgba(0, 0, 0, 0)' && difference.atomic === 'rgb(0, 128, 0)');
  const shapeDetected = compare(shapeReference, shapeAtomic).length === 0 &&
    compare(shapeAtomic, shapeCorrupted).length === 3 && shapeDifferences.length === 3 &&
    shapeDifferences.every((difference) => difference.node === 'shape-button' && difference.property === 'color' &&
      ['baseline', 'attribute-ready', 'attribute-restored'].includes(difference.phase) &&
      difference.reference === 'rgb(255, 0, 0)' && difference.atomic === 'rgb(0, 0, 255)');
  const escapedFixture = fixtures.find((fixture) => fixture.name === 'external-attribute-css-escape-value')!;
  const escapedReference = await readDocument(escapedFixture, 'reference');
  const escapedAtomic = await readDocument(escapedFixture, 'atomic');
  const escapedCorrupted = await readDocument(escapedFixture, 'atomic', 'external-attribute-escape');
  const escapedDifferences = compare(escapedReference, escapedCorrupted);
  const escapedDetected = compare(escapedReference, escapedAtomic).length === 0 &&
    compare(escapedAtomic, escapedCorrupted).length === 2 && escapedDifferences.length === 2 &&
    escapedDifferences.every((difference) => difference.node === 'escaped-inside' &&
      difference.property === 'background-color') &&
    escapedDifferences.some((difference) => difference.phase === 'newline-value' &&
      difference.reference === 'rgb(0, 0, 255)' && difference.atomic === 'rgba(0, 0, 0, 0)') &&
    escapedDifferences.some((difference) => difference.phase === 'literal-n-value' &&
      difference.reference === 'rgba(0, 0, 0, 0)' && difference.atomic === 'rgb(0, 0, 255)');
  const aliasFixture = fixtures.find((fixture) => fixture.name === 'scope-source-path-separator-isolation')!;
  const aliasReference = await readDocument(aliasFixture, 'reference');
  const aliasAtomic = await readDocument(aliasFixture, 'atomic');
  const aliasCorrupted = await readDocument(aliasFixture, 'atomic', 'scope-source-alias');
  const aliasDifferences = compare(aliasReference, aliasCorrupted);
  const aliasDetected = compare(aliasReference, aliasAtomic).length === 0 &&
    compare(aliasAtomic, aliasCorrupted).length === 1 && aliasDifferences.length === 1 &&
    aliasDifferences[0]?.node === 'alias-orphan' && aliasDifferences[0]?.property === 'background-color' &&
    aliasDifferences[0]?.reference === 'rgba(0, 0, 0, 0)' && aliasDifferences[0]?.atomic === 'rgb(0, 0, 255)';
  publish({
    externalTagAnchorNegativeControl: { detected: shapeDetected, ancestorRemoved: true, differences: shapeDifferences },
    externalAttributeNegativeControl: { detected: attributeDetected, qualifierRemoved: true,
      differences: attributeDifferences },
    externalAttributeEscapeNegativeControl: { detected: escapedDetected, escapeAltered: true,
      differences: escapedDifferences },
    scopeSourceAliasNegativeControl: { detected: aliasDetected, wrongMarkerAttached: true, differences: aliasDifferences },
    propertyInheritanceNegativeControl: { detected: inheritanceDetected, providerRemoved: true,
      differences: inheritanceDifferences },
    compatibilityFallbackMediaNegativeControl: { detected: fallbackDetected, guardChanged: true, differences: fallbackDifferences },
    compatibilityAssetNegativeControl: { detected: compatAssetDetected, differences: compatAssetDifferences },
    compatibilityPropertyNegativeControl: { detected: compatPropertyDetected, differences: compatPropertyDifferences },
    compatibilitySequenceNegativeControl: { detected: compatibilityDetected, declarationsRemoved: 3, differences: compatibilityDifferences },
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
    hasTypeListNegativeControl: { detected: hasTypeListDetected, typeSpecificityNeutralized: true, differences: typeDifferences },
    conditionalKeyframeNegativeControl: { detected: conditionalKeyframeDetected, wideFrameChanged: true,
      differences: conditionalDifferences },
    hasSpecificityDedup: { fixtures: hasSpecificityDedupResults, negativeControl: { detected: hasSpecificityDedupControl, qualifierRemoved: true, differences: hasSpecificityDedupDifferences } },
    status: results.every((result) => result.comparisons > 0 && !result.differences.length && !result.expectedFailures.length) &&
      hasSpecificityDedupResults.every((result) => result.differences.length === 0) && hasSpecificityDedupControl &&
      detected && pseudoDetected && conditionDetected && layerDetected && nestedLayerDetected && assetDetected && keyframesDetected && relationDetected && interleavedDetected && interleavedDepthDetected && interleavedPrefixDetected && interleavedGeneralPrefixDetected && interleavedGeneralRootDetected && interleavedChildRootDetected && interleavedChildPrefixDetected && crossLayerSpecificityDetected && hasSpecificityDetected && hasTypeListDetected && conditionalKeyframeDetected && fontResetNegativeControl && externalAnchorDetected && externalAncestorDetected && externalMediaDetected && externalCompoundDetected && sameNodeDetected && refinementDetected && externalObservationDetected && functionalDetected && compatibilityDetected && fallbackDetected && compatAssetDetected && compatPropertyDetected && inheritanceDetected && keywordDetected && aliasDetected && shapeDetected && attributeDetected && escapedDetected
      ? 'passed' : 'failed',
    results,
    negativeControl: { detected, differences },
    fontResetNegativeControl: { detected: fontResetNegativeControl, differences: fontResetDifferences },
    keyframesNegativeControl: { detected: keyframesDetected, controlsUnchanged: keyframesControlsUnchanged, definitionRemoved: true, differences: keyframesDifferences },
    keywordKeyframeNegativeControl: { detected: keywordDetected, definitionRemoved: true, differences: keywordDifferences },
    assetNegativeControl: { detected: assetDetected, controlsUnchanged: assetControlsUnchanged, differences: assetDifferences },
    conditionNegativeControl: { detected: conditionDetected, differences: conditionDifferences },
    layerNegativeControl: { detected: layerDetected, differences: layerDifferences },
    nestedLayerNegativeControl: { detected: nestedLayerDetected, controlsUnchanged: nestedLayerChanges.length === 3 && !nestedLayerChanges.some((difference) => difference.property === 'border-top-color'), configuredOrderPerturbed: true, differences: nestedLayerDifferences },
    pseudoNegativeControl: { detected: pseudoDetected, controlsUnchanged, differences: pseudoDifferences }
  });
}

publish({ status: 'running' });
void run().catch((error: unknown) => publish({ status: 'failed', error: String(error) }));
