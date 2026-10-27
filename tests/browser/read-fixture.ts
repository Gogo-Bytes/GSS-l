import { animationMetadata, animationProbeNames, removeKeyframeDefinition } from './animation-metadata.js';
import type { ScopeNodeSchema } from '@gss-l/compiler';
import type { CompiledReferenceFixture } from './fixtures.js';

type Fixture = CompiledReferenceFixture;
export type Reading = {
  phase: string; state: string; node: string; moduleId: string; path: readonly string[];
  subject: 'element' | '::before' | '::after'; property: string; value: string; expected: string;
};

export async function readDocument(fixture: Fixture, side: 'reference' | 'atomic', corrupt?: 'element' | 'pseudo' | 'condition' | 'layer' | 'nested-layer' | 'asset' | 'keyframes' | 'relation' | 'interleaved' | 'interleaved-depth' | 'interleaved-prefix' | 'interleaved-general-prefix' | 'interleaved-general-root' | 'interleaved-child-root' | 'interleaved-child-prefix' | 'cross-layer-specificity' | 'font-reset' | 'has-specificity' | 'has-specificity-dedup' | 'has-type-list' | 'conditional-keyframe' | 'external-anchor' | 'external-ancestor' | 'external-media' | 'external-compound' | 'owned-external-condition' | 'external-observation' | 'functional-external' | 'compatibility-sequence' | 'compatibility-asset' | 'compatibility-property' | 'compatibility-fallback-media' | 'property-inheritance' | 'keyword-keyframe' | 'scope-source-alias' | 'external-tag-anchor' | 'external-attribute-qualifier' | 'external-attribute-escape', options: { container?: HTMLElement; phaseLimit?: number } = {}): Promise<Reading[]> {
  const frame = document.createElement('iframe');
  frame.title = `${fixture.name}: ${side}${corrupt ? ' negative control' : ''}`;
  frame.width = '640';
  frame.height = '360';
  const loaded = new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(`Timed out loading ${frame.title}`)), 5000);
    frame.onload = () => { window.clearTimeout(timer); resolve(); };
  });
  frame.srcdoc = '<!doctype html><html><head><meta charset="UTF-8"></head><body></body></html>';
  (options.container ?? document.querySelector('#documents')!).append(frame);
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
  if (corrupt === 'compatibility-sequence') {
    const declarations = /^ {2}display: [^;]+;\n/gm;
    if ([...style.textContent.matchAll(declarations)].length !== 3) {
      throw new Error('Compatibility control requires the three physical display declarations');
    }
    style.textContent = style.textContent.replace(declarations, '');
  }
  if (corrupt === 'compatibility-asset') {
    const changed = style.textContent.replace('url("/__reference_assets__/one-a.svg")',
      'url("/__reference_assets__/wrong.svg")');
    if (changed === style.textContent) throw new Error('Compatibility Asset control did not substitute the URL');
    style.textContent = changed;
  }
  if (corrupt === 'compatibility-property') {
    const changed = style.textContent.replace(/@property --tone \{[^}]*\}/, '');
    if (changed === style.textContent) throw new Error('Compatibility resource control did not remove the property registration');
    style.textContent = changed;
  }
  if (corrupt === 'external-attribute-escape') {
    const authored = String.raw`[data-mode="a\a b"]`;
    if (style.textContent.split(authored).length !== 2) {
      throw new Error('External attribute escape control requires one authored CSS escape');
    }
    style.textContent = style.textContent.replace(authored, String.raw`[data-mode="a\nb"]`);
  }
  if (corrupt === 'external-attribute-qualifier') {
    const qualifier = '[data-mode="ready"]';
    if (style.textContent.split(qualifier).length !== 2) {
      throw new Error('External attribute control requires one exact-value target qualifier');
    }
    style.textContent = style.textContent.replace(qualifier, 'span');
  }
  if (corrupt === 'external-tag-anchor') {
    const outer = fixture.atomic.scopeSchemas['ExternalShape.gss']?.exports.outer?.selfClassName;
    const tagRules = [...style.textContent.matchAll(/^[^\n]* button \{$/gm)];
    const rule = tagRules[0]?.[0];
    const weakened = rule?.replace(`.${outer} `, '');
    if (!outer || tagRules.length !== 1 || !rule || !weakened || weakened === rule) {
      throw new Error('External tag control requires one generated tag rule with an owned outer marker');
    }
    style.textContent = style.textContent.replace(rule, weakened);
  }
  if (corrupt === 'property-inheritance') {
    const provider = '--tone: blue;';
    if (style.textContent.split(provider).length !== 2) {
      throw new Error('Inheritance control requires exactly one blue owned provider');
    }
    style.textContent = style.textContent.replace(provider, '');
  }
  if (corrupt === 'compatibility-fallback-media') {
    const authored = '(min-width: 400px)';
    if (style.textContent.split(authored).length !== 2) {
      throw new Error('Compatibility fallback control requires exactly one media guard');
    }
    style.textContent = style.textContent.replace(authored, '(min-width: 0px)');
  }
  doc.head.append(style);
  if (corrupt === 'conditional-keyframe') {
    const media = [...style.sheet!.cssRules].filter((rule) =>
      rule instanceof (frame.contentWindow as Window & typeof globalThis).CSSMediaRule &&
      (rule as CSSMediaRule).conditionText === '(min-width: 401px)') as CSSMediaRule[];
    const frames = media.flatMap((rule) => [...rule.cssRules].filter((child) =>
      child instanceof (frame.contentWindow as Window & typeof globalThis).CSSKeyframesRule)) as CSSKeyframesRule[];
    const first = frames[0]?.cssRules[0] as CSSKeyframeRule | undefined;
    if (media.length !== 1 || frames.length !== 1 || first?.style.width !== '30px') {
      throw new Error('Conditional keyframe control requires one wide-media 30px frame');
    }
    first.style.width = '31px';
  }
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
  if (corrupt === 'has-type-list') {
    const sheet = style.sheet!;
    const index = [...sheet.cssRules].findIndex((item) =>
      item instanceof (frame.contentWindow as Window & typeof globalThis).CSSStyleRule &&
      (item as CSSStyleRule).selectorText.includes('--residual_button') &&
      (item as CSSStyleRule).selectorText.includes(':has(button)'));
    const rule = sheet.cssRules[index] as CSSStyleRule | undefined;
    if (index < 0 || !rule) throw new Error('Type-only control requires one emitted button branch');
    const weakened = rule.selectorText.replace(':has(button)', ':has(:where(button))');
    const declarations = rule.style.cssText;
    sheet.deleteRule(index);
    sheet.insertRule(`${weakened} { ${declarations} }`, index);
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
  if (fixture.afterCss) {
    const competitor = doc.createElement('style');
    competitor.dataset.role = 'identical-fixture-competitor';
    competitor.textContent = fixture.afterCss;
    doc.head.append(competitor);
  }
  const ownedClasses = new Map<string, string>();
  for (const node of fixture.nodes) {
    if (node.externalClassName !== undefined && node.extraClassName !== undefined) {
      throw new Error('An external fixture node cannot also claim an owned scope');
    }
    let scope: ScopeNodeSchema | undefined;
    const scopes: ScopeNodeSchema[] = [];
    if (node.externalClassName === undefined) {
      for (const path of [node.path, ...(node.additionalPaths ?? [])]) {
        let current: ScopeNodeSchema | undefined;
        let targets = fixture[side].scopeSchemas[node.moduleId]!.exports;
        for (const segment of path) {
          current = targets[segment];
          if (!current) throw new Error(`Missing ${side} mapping: ${node.moduleId}:${path.join('.')}`);
          targets = current.targets;
        }
        if (current) scopes.push(current);
        if (!scope) scope = current;
      }
    } else if (node.path.length > 0 || (node.additionalPaths?.length ?? 0) > 0) {
      throw new Error('An external fixture node must not claim an owned scope path');
    }
    const element = doc.createElement(node.tag ?? 'div');
    if (element.tagName === 'INPUT') (element as HTMLInputElement).type = 'checkbox';
    element.id = node.id;
    const classes = [...new Set(scopes.flatMap((entry) => entry.selfClassName.split(/\s+/).filter(Boolean)))];
    if (scope) ownedClasses.set(node.id, classes.join(' '));
    element.className = node.externalClassName ?? [...classes, node.extraClassName ?? ''].filter(Boolean).join(' ');
    if (element.tagName !== 'INPUT') element.textContent = node.id;
    const parent = node.parent ? doc.getElementById(node.parent) : doc.body;
    if (!parent) throw new Error(`Missing fixture parent: ${node.parent}`);
    parent.append(element);
  }
  if (corrupt === 'scope-source-alias') {
    const sourceMarker = fixture.atomic.scopeSchemas['Alias.gss']?.exports['a.b']?.selfClassName
      .split(' ').find((name) => name.startsWith('gss-s--'));
    const nested = doc.getElementById('alias-b');
    if (!sourceMarker || !nested || nested.classList.contains(sourceMarker)) {
      throw new Error('Scope/source alias control requires two initially distinct owned marker identities');
    }
    nested.classList.add(sourceMarker);
  }
  const probeNames = animationProbeNames(doc, fixture);
  if (corrupt === 'keyframes' || corrupt === 'keyword-keyframe') {
    const name = probeNames.get(corrupt === 'keyframes' ? 'MotionA.gss/pulse' : 'KeywordMotion.gss/ease');
    if (!name) throw new Error('Missing intended keyframe control probe');
    removeKeyframeDefinition(style, name);
  }
  const readings: Reading[] = [];
  const phases: NonNullable<Fixture['phases']> = [
    { name: 'baseline', changes: [], expected: Object.fromEntries(fixture.nodes.map((node) => [node.id, node.expected])),
      pseudoExpected: Object.fromEntries(fixture.nodes.map((node) => [node.id, node.pseudoExpected ?? {}])) },
    ...fixture.phases ?? []
  ];
  for (const phase of phases.slice(0, options.phaseLimit ?? phases.length)) {
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
      const expectedAnimation = phase.animationExpected?.[node.id] ?? node.animationExpected;
      if (expectedAnimation) {
        const label = `${node.moduleId}/${expectedAnimation.symbol}`;
        for (const reading of await animationMetadata(doc.getElementById(node.id)!, expectedAnimation, probeNames.get(label), label)) {
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
