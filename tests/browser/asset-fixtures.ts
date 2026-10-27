import type { ReferenceFixture } from './fixtures.js';

// Owned host routes and independent literal byte dimensions, not compiler output.
export const assetFixtures: readonly ReferenceFixture[] = [
  isolation('one'), isolation('two'),
  {
    name: 'asset-media-disabled-pseudo',
    config: { layers: ['paint'], conditions: { media: ['(min-width: 400px)'] } },
    conditionProbes: { media: ['(min-width: 400px)'] },
    assetUrls: { base: '/__reference_assets__/base.svg', wide: '/__reference_assets__/wide.svg?q=%23#icon', disabled: '/__reference_assets__/disabled.svg' },
    assetDimensions: { '/__reference_assets__/base.svg': '3x2', '/__reference_assets__/wide.svg?q=%23#icon': '5x4', '/__reference_assets__/disabled.svg': '7x6' },
    modules: [{ id: 'AssetPseudo.gss', source: `@layer paint {
      .card::before { content: ""; display: block; width: 20px; height: 20px; background-image: url(base); }
      @media (min-width: 400px) {
        .card::before { background-image: url(wide); }
        .card:disabled::before { background-image: url(disabled) !important; }
      }
    }`, assetReferences: [{ url: 'base', identity: 'base' }, { url: 'wide', identity: 'wide' }, { url: 'disabled', identity: 'disabled' }] }],
    nodes: [{ id: 'asset-button', tag: 'button', moduleId: 'AssetPseudo.gss', path: ['card'], expected: {},
      pseudoExpected: { '::before': { 'background-image': 'url("/__reference_assets__/wide.svg?q=%23#icon")' } } }],
    phases: [
      { name: 'disabled', changes: [{ node: 'asset-button', disabled: true }], expected: {},
        pseudoExpected: { 'asset-button': { '::before': { 'background-image': 'url("/__reference_assets__/disabled.svg")' } } } },
      { name: 'no-match-disabled', viewportWidth: 100, changes: [], expected: {},
        pseudoExpected: { 'asset-button': { '::before': { 'background-image': 'url("/__reference_assets__/base.svg")' } } } },
      { name: 'restored', viewportWidth: 640, changes: [{ node: 'asset-button', disabled: false }], expected: {},
        pseudoExpected: { 'asset-button': { '::before': { 'background-image': 'url("/__reference_assets__/wide.svg?q=%23#icon")' } } } }
    ]
  }
];

function isolation(delivery: 'one' | 'two'): ReferenceFixture {
  return {
    name: `asset-module-isolation-${delivery}`,
    assetUrls: { 'a/icon': `/__reference_assets__/${delivery}-a.svg?q=%23#icon`, 'b/icon': `/__reference_assets__/${delivery}-b.svg` },
    assetDimensions: { [`/__reference_assets__/${delivery}-a.svg?q=%23#icon`]: '3x2', [`/__reference_assets__/${delivery}-b.svg`]: '5x4' },
    modules: [
      { id: 'AssetA.gss', source: '.card { background-image: url("./icon\\2e svg?q=%23#icon"); width: 20px; height: 20px; }',
        assetReferences: [{ url: './icon.svg?q=%23#icon', identity: 'a/icon' }] },
      { id: 'AssetB.gss', source: '.card { background-image: url("./icon.svg?q=%23#icon"); width: 20px; height: 20px; }',
        assetReferences: [{ url: './icon.svg?q=%23#icon', identity: 'b/icon' }] }
    ],
    nodes: [
      { id: 'asset-a', moduleId: 'AssetA.gss', path: ['card'], expected: { 'background-image': `url("/__reference_assets__/${delivery}-a.svg?q=%23#icon")` } },
      { id: 'asset-b', moduleId: 'AssetB.gss', path: ['card'], expected: { 'background-image': `url("/__reference_assets__/${delivery}-b.svg")` } }
    ]
  };
}
