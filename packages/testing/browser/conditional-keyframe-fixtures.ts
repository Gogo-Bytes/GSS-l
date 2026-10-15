import type { ScopeSchema } from '@gss-l/compiler';
import type { ReferenceFixture } from './fixtures.js';
import type { AnimationExpectation } from './keyframes-fixtures.js';

const moduleId = 'WidthMotion.gss';
const scopeSchemas: Readonly<Record<string, ScopeSchema>> = { [moduleId]: { moduleId, exports: {
  motion: { selfClassName: 'native-motion', targets: {} },
  probe: { selfClassName: 'native-probe', targets: {} },
  control: { selfClassName: 'native-control', targets: {} }
} } };
const animation = (from: string, to: string): AnimationExpectation => ({
  symbol: 'pulse', playState: 'paused',
  timing: { duration: 1000, delay: 0, iterations: 1, direction: 'normal', fill: 'both', easing: 'linear' },
  frames: [
    { offset: 0, easing: 'linear', properties: { width: from } },
    { offset: 1, easing: 'linear', properties: { width: to } }
  ]
});
const narrow = animation('10px', '20px');
const wide = animation('30px', '40px');
const motion = { color: 'rgb(255, 0, 0)', 'animation-duration': '1s', 'animation-play-state': 'paused' };
const control = { color: 'rgb(0, 128, 0)' };

// Literal native CSS, scope names and frame expectations are authored independently of Compiler output.
export const conditionalKeyframeFixtures: readonly (ReferenceFixture & {
  reference: { css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>> };
})[] = [{
  name: 'disjoint-registered-width-keyframes',
  config: { conditions: { media: ['(max-width: 400px)', '(min-width: 401px)'] } },
  modules: [{ id: moduleId, source: `
    @media (max-width: 400px) { @keyframes pulse { from { width: 10px; } to { width: 20px; } } }
    @media (min-width: 401px) { @keyframes pulse { from { width: 30px; } to { width: 40px; } } }
    .motion { animation-name: pulse; animation-duration: 1s; animation-play-state: paused;
      animation-timing-function: linear; animation-fill-mode: both; color: red; }
    .probe { animation-name: pulse; }
    .control { color: green; }
  ` }],
  reference: { css: `
    @media (max-width: 400px) { @keyframes pulse { from { width: 10px; } to { width: 20px; } } }
    @media (min-width: 401px) { @keyframes pulse { from { width: 30px; } to { width: 40px; } } }
    .native-motion { animation-name: pulse; animation-duration: 1s; animation-play-state: paused;
      animation-timing-function: linear; animation-fill-mode: both; color: red; }
    .native-probe { animation-name: pulse; }
    .native-control { color: green; }
  `, scopeSchemas },
  conditionProbes: { media: ['(max-width: 400px)', '(min-width: 401px)'] },
  animationSymbols: [{ moduleId, symbol: 'pulse', probe: 'width-probe' }],
  nodes: [
    { id: 'width-motion', moduleId, path: ['motion'], expected: motion, animationExpected: wide },
    { id: 'width-probe', moduleId, path: ['probe'], expected: {} },
    { id: 'width-control', moduleId, path: ['control'], expected: control }
  ],
  phases: [
    { name: 'narrow-media', viewportWidth: 360, changes: [],
      expected: { 'width-motion': motion, 'width-probe': {}, 'width-control': control },
      animationExpected: { 'width-motion': narrow } },
    { name: 'wide-media-restored', viewportWidth: 640, changes: [],
      expected: { 'width-motion': motion, 'width-probe': {}, 'width-control': control },
      animationExpected: { 'width-motion': wide } }
  ]
}];
