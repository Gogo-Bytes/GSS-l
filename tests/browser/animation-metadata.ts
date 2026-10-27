import type { CompiledReferenceFixture } from './fixtures.js';
import type { AnimationExpectation } from './keyframes-fixtures.js';

type Fixture = CompiledReferenceFixture;

/** Probe names are transport alignment only; all effect expectations are fixture literals. */
export function animationProbeNames(doc: Document, fixture: Fixture): Map<string, string> {
  const names = new Map<string, string>();
  for (const { moduleId, symbol, probe } of fixture.animationSymbols ?? []) {
    const element = doc.getElementById(probe);
    if (!element) throw new Error(`Missing animation probe: ${probe}`);
    const name = doc.defaultView!.getComputedStyle(element).animationName;
    if (!name || name === 'none' || name.includes(',') || [...names.values()].includes(name)) {
      throw new Error(`Missing or non-distinct Module animation probe: ${moduleId}/${symbol}`);
    }
    names.set(`${moduleId}/${symbol}`, name);
  }
  return names;
}

export function removeKeyframeDefinition(style: HTMLStyleElement, name: string): void {
  const rules = [...style.sheet!.cssRules];
  const matches = rules.flatMap((rule, index) => rule.type === CSSRule.KEYFRAMES_RULE &&
    (rule as CSSKeyframesRule).name === name ? [index] : []);
  if (matches.length !== 1) throw new Error('Keyframe control requires exactly one intended root definition');
  style.sheet!.deleteRule(matches[0]!);
  if ([...style.sheet!.cssRules].some((rule) => rule.type === CSSRule.KEYFRAMES_RULE && (rule as CSSKeyframesRule).name === name)) {
    throw new Error('Keyframe control did not remove definition');
  }
}

export async function animationMetadata(
  element: HTMLElement, expected: AnimationExpectation, probeName: string | undefined, label: string
): Promise<readonly { property: string; value: string; expected: string }[]> {
  if (!probeName) throw new Error(`Missing symbol probe for ${label}`);
  const win = element.ownerDocument.defaultView as Window & typeof globalThis;
  const computedName = win.getComputedStyle(element).animationName;
  const animations = element.getAnimations();
  // Await native ready, never sample progress or elapsed wall-clock time.
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([Promise.all(animations.map((animation) => animation.ready)), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Animation readiness timed out')), 5000);
    })]);
  } finally { clearTimeout(timer); }
  const animation = animations.length === 1 && animations[0] instanceof win.CSSAnimation ? animations[0] : undefined;
  const effect = animation?.effect instanceof win.KeyframeEffect ? animation.effect : undefined;
  const timing = effect?.getTiming();
  const frames = effect?.getKeyframes().map((frame) => ({
    offset: frame.computedOffset,
    easing: frame.easing,
    properties: Object.fromEntries(Object.entries(frame).filter(([key]) => !['offset', 'computedOffset', 'easing', 'composite'].includes(key)).sort(([a], [b]) => a.localeCompare(b)))
  }));
  const association = computedName === probeName && animation?.animationName === probeName && effect?.target === element;
  const reading = (property: string, value: unknown, literal: unknown) => ({
    property: `animation:${property}`, value: JSON.stringify(value ?? 'missing'), expected: JSON.stringify(literal)
  });
  return [
    reading('count', animations.length, 1),
    reading('association', association ? label : 'association-mismatch', label),
    reading('play-state', animation?.playState, expected.playState),
    reading('timing', timing && { duration: timing.duration, delay: timing.delay, iterations: timing.iterations,
      direction: timing.direction, fill: timing.fill, easing: timing.easing }, expected.timing),
    reading('frames', frames, expected.frames)
  ];
}
