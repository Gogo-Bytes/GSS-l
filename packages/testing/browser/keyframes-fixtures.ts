import type { ReferenceFixture } from './fixtures.js';

export type AnimationExpectation = {
  symbol: string;
  timing: { duration: number; delay: number; iterations: number; direction: string; fill: string; easing: string };
  playState: string;
  frames: readonly { offset: number; easing: string; properties: Readonly<Record<string, string>> }[];
};

const modules = [
  { id: 'MotionA.gss', source: `
    .target { animation-name: pulse; animation-duration: 2s; animation-delay: 250ms;
      animation-iteration-count: 3; animation-play-state: paused; animation-timing-function: linear;
      animation-direction: alternate; animation-fill-mode: both; color: red; }
    .probe { animation-name: pulse; }
    @keyframes pulse { from { width: 10px; } to { width: 30px; } }
    .control { color: green; }` },
  { id: 'MotionB.gss', source: `
    @keyframes pulse { 0% { width: 40px; } 100% { width: 80px; } }
    .target { animation-name: pulse; animation-duration: 1500ms; animation-delay: -500ms;
      animation-iteration-count: 2; animation-play-state: paused; animation-timing-function: ease-in;
      animation-direction: reverse; animation-fill-mode: forwards; color: blue; }
    .probe { animation-name: pulse; }` }
];
const a: AnimationExpectation = { symbol: 'pulse', playState: 'paused',
  timing: { duration: 2000, delay: 250, iterations: 3, direction: 'alternate', fill: 'both', easing: 'linear' },
  frames: [{ offset: 0, easing: 'linear', properties: { width: '10px' } }, { offset: 1, easing: 'linear', properties: { width: '30px' } }] };
// CSS animation timing functions apply per keyframe; effect-level easing stays linear.
const b: AnimationExpectation = { symbol: 'pulse', playState: 'paused',
  timing: { duration: 1500, delay: -500, iterations: 2, direction: 'reverse', fill: 'forwards', easing: 'linear' },
  frames: [{ offset: 0, easing: 'ease-in', properties: { width: '40px' } }, { offset: 1, easing: 'ease-in', properties: { width: '80px' } }] };

export const keyframesFixtures: readonly ReferenceFixture[] = [
  ...[false, true].map((reverse): ReferenceFixture => ({
    name: `keyframes-module-isolation-${reverse ? 'reversed' : 'forward'}`,
    modules: reverse ? [...modules].reverse() : modules,
    animationSymbols: [
      { moduleId: 'MotionA.gss', symbol: 'pulse', probe: 'probe-a' },
      { moduleId: 'MotionB.gss', symbol: 'pulse', probe: 'probe-b' }
    ],
    nodes: [
      { id: 'motion-a', moduleId: 'MotionA.gss', path: ['target'], expected: { color: 'rgb(255, 0, 0)', 'animation-duration': '2s', 'animation-delay': '0.25s',
        'animation-timing-function': 'linear', 'animation-iteration-count': '3', 'animation-play-state': 'paused' }, animationExpected: a },
      { id: 'motion-b', moduleId: 'MotionB.gss', path: ['target'], expected: { color: 'rgb(0, 0, 255)', 'animation-duration': '1.5s', 'animation-delay': '-0.5s',
        'animation-timing-function': 'ease-in', 'animation-iteration-count': '2', 'animation-play-state': 'paused' }, animationExpected: b },
      { id: 'probe-a', moduleId: 'MotionA.gss', path: ['probe'], expected: {} },
      { id: 'probe-b', moduleId: 'MotionB.gss', path: ['probe'], expected: {} },
      { id: 'motion-control', moduleId: 'MotionA.gss', path: ['control'], expected: { color: 'rgb(0, 128, 0)' } }
    ]
  })),
  {
    name: 'keyframes-percentage-association',
    modules: [{ id: 'Percent.gss', source: `
      .target { animation-name: pulse; animation-duration: 1.25s; animation-delay: -250ms;
        animation-iteration-count: 2.5; animation-play-state: paused; animation-timing-function: linear;
        animation-direction: normal; animation-fill-mode: both; }
      .probe { animation-name: pulse; }
      @keyframes pulse { 0% { height: 5px; } 50.5% { height: 15px; } 100% { height: 25px; } }` }],
    animationSymbols: [{ moduleId: 'Percent.gss', symbol: 'pulse', probe: 'percent-probe' }],
    nodes: [
      { id: 'percent', moduleId: 'Percent.gss', path: ['target'], expected: { 'animation-duration': '1.25s', 'animation-delay': '-0.25s',
        'animation-timing-function': 'linear', 'animation-iteration-count': '2.5', 'animation-play-state': 'paused' }, animationExpected: {
        symbol: 'pulse', playState: 'paused',
        timing: { duration: 1250, delay: -250, iterations: 2.5, direction: 'normal', fill: 'both', easing: 'linear' },
        frames: [{ offset: 0, easing: 'linear', properties: { height: '5px' } }, { offset: 0.505, easing: 'linear', properties: { height: '15px' } },
          { offset: 1, easing: 'linear', properties: { height: '25px' } }]
      } },
      { id: 'percent-probe', moduleId: 'Percent.gss', path: ['probe'], expected: {} }
    ]
  }
];
