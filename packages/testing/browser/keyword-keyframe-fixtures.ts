import type { CompiledReferenceFixture, ReferenceFixture } from './fixtures.js';

// The native CSS and literal animation metadata are independent of GSS names/output.
export const keywordKeyframeFixtures: readonly (ReferenceFixture & {
  reference: CompiledReferenceFixture['reference'];
})[] = [{
  name: 'keyword-like-keyframe-explicit-longhand',
  modules: [{ id: 'KeywordMotion.gss', source: `
    @keyframes ease { from { width: 10px; } to { width: 30px; } }
    .motion { animation-name: ease; animation-duration: 2s;
      animation-play-state: paused; animation-timing-function: linear; color: red; }
    .probe { animation-name: ease; }
  ` }],
  reference: {
    css: `
      @keyframes ease { from { width: 10px; } to { width: 30px; } }
      .native-motion { animation-name: ease; animation-duration: 2s;
        animation-play-state: paused; animation-timing-function: linear; color: red; }
      .native-probe { animation-name: ease; }
    `,
    scopeSchemas: { 'KeywordMotion.gss': { moduleId: 'KeywordMotion.gss', exports: {
      motion: { selfClassName: 'native-motion', targets: {} },
      probe: { selfClassName: 'native-probe', targets: {} }
    } } }
  },
  animationSymbols: [{ moduleId: 'KeywordMotion.gss', symbol: 'ease', probe: 'keyword-probe' }],
  nodes: [
    { id: 'keyword-motion', moduleId: 'KeywordMotion.gss', path: ['motion'], expected: {
      color: 'rgb(255, 0, 0)', 'animation-duration': '2s', 'animation-play-state': 'paused'
    }, animationExpected: {
      symbol: 'ease', playState: 'paused',
      timing: { duration: 2000, delay: 0, iterations: 1, direction: 'normal', fill: 'none', easing: 'linear' },
      frames: [{ offset: 0, easing: 'linear', properties: { width: '10px' } },
        { offset: 1, easing: 'linear', properties: { width: '30px' } }]
    } },
    { id: 'keyword-probe', moduleId: 'KeywordMotion.gss', path: ['probe'], expected: {} },
    { id: 'keyword-unowned', moduleId: 'KeywordMotion.gss', path: [], externalClassName: '',
      expected: { color: 'rgb(0, 0, 0)' } }
  ]
}];
