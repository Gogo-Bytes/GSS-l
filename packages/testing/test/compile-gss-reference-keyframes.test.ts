import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { compileGssReference } from '../src/index.js';

const config = { projectRoot: '/project' };
const frames = '@keyframes pulse { from { width: 10px; } to { width: 30px; } }';

describe('compileGssReference module-local keyframes', () => {
  it('independently namespaces forward references without mapping frame selectors', () => {
    const modules = ['A.gss', 'B.gss'].map((id) => ({ id, source: `.parent .target { animation-name: pulse; } ${frames}` }));
    const result = compileGssReference({ config, modules });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(JSON.stringify(result.diagnostics));
    const names: string[] = [];
    const references: string[] = [];
    const root = postcss.parse(result.css);
    root.walkAtRules('keyframes', (rule) => { names.push(rule.params); });
    root.walkDecls('animation-name', (decl) => { references.push(decl.value); });
    expect(names).toHaveLength(2);
    expect(new Set(names).size).toBe(2);
    expect(references).toEqual(names);
    expect(names[0]).toBe('gss_ref_keyframes_41_2e_67_73_73__70_75_6c_73_65');
    expect(Object.keys(result.scopeSchemas['A.gss']!.exports)).toEqual(['parent']);
    expect(Object.keys(result.scopeSchemas['A.gss']!.exports.parent!.targets)).toEqual(['target']);
    expect(compileGssReference({ config, modules: [...modules].reverse() })).toEqual(result);
  });
});

it.each([
  '@keyframes empty {}', '@keyframes empty { from {} to {} }',
  '@keyframes spin { to { width: 1px; } }',
  '@keyframes empty { /* from .notScope */ 0% {} 50.5% { height: 2.5px; color: RED; } 100% {} }'
])('retains resource-only/empty definitions with empty mappings: %s', (source) => {
  const result = compileGssReference({ config, modules: [{ id: 'A.gss', source }] });
  expect(result.success).toBe(true);
  if (!result.success) throw new Error('Expected resource');
  expect(result.css).toContain('@keyframes gss_ref_keyframes_');
  expect(result.scopeSchemas['A.gss']!.exports).toEqual({});
});

it('preserves empty declared paths, case-sensitive external names, opaque content and comments', () => {
  const result = compileGssReference({ config, modules: [{ id: 'A.gss', source: `${frames}
    .parent .empty {} .local { animation-name: pulse; content: "pulse url(fake.svg) .from"; }
    /* animation-name: pulse */ .external { animation-name: Pulse; } .none { animation-name: NONE; }` }] });
  expect(result.success).toBe(true);
  if (!result.success) throw new Error('Expected resources');
  expect(result.scopeSchemas['A.gss']!.exports.parent!.targets.empty).toBeDefined();
  expect(result.scopeSchemas['A.gss']!.exports).not.toHaveProperty('from');
  expect(result.css).toContain('content: "pulse url(fake.svg) .from"');
  expect(result.css).toContain('/* animation-name: pulse */');
  expect(result.css).toContain('animation-name: Pulse');
  expect(result.css).toContain('animation-name: NONE');
});

it.each([
  ['animation-name', 'external'], ['animation-name', 'none'],
  ['animation-duration', '0s'], ['animation-duration', '1.25MS'],
  ['animation-delay', '-0.5s'], ['animation-delay', '+1s'], ['animation-delay', '0ms'],
  ['animation-iteration-count', '2.5'], ['animation-iteration-count', 'INFINITE'],
  ['animation-play-state', 'paused'], ['animation-play-state', 'RUNNING'],
  ...['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end'].map((value) => ['animation-timing-function', value]),
  ...['normal', 'reverse', 'alternate', 'alternate-reverse'].map((value) => ['animation-direction', value]),
  ...['none', 'forwards', 'backwards', 'both'].map((value) => ['animation-fill-mode', value])
])('accepts one static %s: %s with outer CSS whitespace and importance', (property, value) => {
  const result = compileGssReference({ config, modules: [{ id: 'A.gss', source: `.a { ${property}: \t${value} \n!important; }` }] });
  expect(result.success).toBe(true);
});

it('keeps root resources base-ranked and rewrites references in registered layers/conditions', () => {
  const result = compileGssReference({ config: { ...config, layers: ['early'], conditions: { media: ['(min-width: 200px)'] } },
    modules: [{ id: 'A.gss', source: `@layer early { @media (min-width: 200px) { .a { animation-name: pulse; } } } ${frames} .empty {}` }] });
  expect(result.success).toBe(true);
  if (!result.success) throw new Error('Expected wrapped reference');
  expect(result.css.indexOf('@keyframes')).toBeLessThan(result.css.indexOf('@media'));
  expect(result.scopeSchemas['A.gss']!.exports.a).toBeDefined();
  expect(result.css).not.toContain('animation-name: pulse');
});

it.each([
  '@keyframes pulse {} @keyframes pulse {}', '@keyframes none {}', '@keyframes inherit {}',
  '@keyframes "pulse" {}', '@keyframes p\\75lse {}', '@-webkit-keyframes pulse {}',
  '@keyframes pulse { from, to {} }', '@keyframes pulse { from {} 0% {} }',
  '@keyframes pulse { 50% {} 50.0% {} }', '@keyframes pulse { 101% {} }',
  '@keyframes pulse { -1% {} }', '@keyframes pulse { .5% {} }', '@keyframes pulse { 01% {} }',
  '@keyframes pulse { FROM {} }', '@keyframes pulse { .a {} }',
  '@keyframes pulse { from { width: 1px !important; } }',
  '@keyframes pulse { from { width: 1px; width: 2px; } }',
  '@keyframes pulse { from { background-image: url(a); } }',
  '@keyframes pulse { from { opacity: 0; } }', '@keyframes pulse { from { width: auto; } }',
  '@keyframes pulse { from { width: -1px; } }', '@keyframes pulse { from { color: #fff; } }',
  '@keyframes pulse { from { width: /*hidden*/1px; } }',
  '@keyframes pulse { from { width: 1px/**/; } }',
  '@keyframes pulse { from { color: r\\65d; } }', '@keyframes pulse { from { @media (min-width: 200px) {} } }',
  '@keyframes pulse { @keyframes other {} }', '.a { @keyframes pulse {} }',
  '@media (min-width: 200px) { @keyframes pulse {} }', '@layer early { @keyframes pulse {} }',
  '.a { animation: pulse 1s; }', '.a { animation-name: pulse, other; }',
  '.a { animation-name: var(--name); }', '.a { animation-name: "pulse"; }',
  '.a { animation-name: initial; }', '.a { animation-name: p\\75lse; }',
  '.a { animation-name: /*hidden*/pulse; }', '.a { animation-name: pulse/**/; }',
  '.a { animation-duration: -1s; }', '.a { animation-delay: --1s; }',
  '.a { animation-duration: 01s; }', '.a { animation-duration: 1; }',
  '.a { animation-duration: .5s; }', '.a { animation-duration: 1s, 2s; }',
  '.a { animation-duration: 1s\u00a0; }', '.a { animation-play-state: var(--state); }',
  '.a { animation-iteration-count: -1; }', '.a { animation-timing-function: steps(2); }',
  '.a { animation-direction: sideways; }', '.a { animation-fill-mode: auto; }'
])('rejects excluded syntax transactionally before earlier Module Asset callback: %s', (source) => {
  let calls = 0;
  const result = compileGssReference({ config: { ...config, layers: ['early'], conditions: { media: ['(min-width: 200px)'] } }, modules: [
    { id: 'A.gss', source: '.a { background-image: url(a); }', assetReferences: [{ url: 'a', identity: 'asset' }] },
    { id: 'Z.gss', source }
  ] }, { resolveAssetUrl() { calls++; return '/out.svg'; } });
  expect(result).toMatchObject({ success: false, diagnostics: [{ severity: 'error' }] });
  expect(result).not.toHaveProperty('css');
  expect(result).not.toHaveProperty('scopeSchemas');
  expect(calls).toBe(0);
});

it('retains duplicate-property policy and separate normal/important animation references', () => {
  expect(compileGssReference({ config, modules: [{ id: 'A.gss', source: '.a { animation-name: a; animation-name: b; }' }] }))
    .toMatchObject({ success: false, diagnostics: [{ reason: 'duplicate-reference-property' }] });
  const result = compileGssReference({ config, modules: [{ id: 'A.gss', source: `${frames} .a { animation-name: pulse; animation-name: pulse !important; }` }] });
  expect(result.success).toBe(true);
  if (!result.success) throw new Error('Expected references');
  expect(result.css.match(/animation-name:/g)).toHaveLength(2);
});

it('binds ordinary Assets with keyframes without discovering URLs in comments/content', () => {
  const requested: string[] = [];
  const result = compileGssReference({ config, modules: [{ id: 'A.gss', source: `${frames}
    .a { animation-name: pulse; background-image: url(a); content: "url(fake) pulse"; }`,
  assetReferences: [{ url: 'a', identity: 'asset' }] }] }, { resolveAssetUrl(identity) { requested.push(identity); return '/out.svg'; } });
  expect(result.success).toBe(true);
  expect(requested).toEqual(['asset']);
});

it.each([
  '@keyframes /*hidden*/pulse {}', '@keyframes pulse/**/ {}',
  '@keyframes pulse { from/**/ {} }', '@keyframes pulse { 50%/**/ {} }',
  '@keyframes pulse { from { width/**/: 1px; } }', '.a { animation-name/**/: pulse; }'
])('rejects comments hidden in PostCSS resource/value trivia before callbacks: %s', (source) => {
  let calls = 0;
  const result = compileGssReference({ config, modules: [
    { id: 'A.gss', source: '.a { background-image: url(a); }', assetReferences: [{ url: 'a', identity: 'asset' }] },
    { id: 'Z.gss', source }
  ] }, { resolveAssetUrl() { calls++; return '/out.svg'; } });
  expect(result.success).toBe(false);
  expect(result).not.toHaveProperty('css');
  expect(result).not.toHaveProperty('scopeSchemas');
  expect(calls).toBe(0);
});

it.each([
  '@keyframes pulse { from { width !: 1px; } }',
  '.a { animation-name !: pulse; } @keyframes pulse {}'
])('rejects malformed property/colon separators before any Asset callback: %s', (source) => {
  let calls = 0;
  const result = compileGssReference({ config, modules: [
    { id: 'A.gss', source: '.a { background-image: url(a); }', assetReferences: [{ url: 'a', identity: 'asset' }] },
    { id: 'Z.gss', source }
  ] }, { resolveAssetUrl() { calls++; return '/out.svg'; } });
  expect(result).toMatchObject({ success: false, diagnostics: [{ severity: 'error', id: 'Z.gss' }] });
  expect(result).not.toHaveProperty('css');
  expect(result).not.toHaveProperty('scopeSchemas');
  expect(calls).toBe(0);
});

it.each([
  '.a { animation-name: pulse !/**/important; } @keyframes pulse {}',
  '.a { animation-name: pulse !important/**/; } @keyframes pulse {}'
])('rejects comments hidden in importance trivia before any Asset callback: %s', (source) => {
  let calls = 0;
  const result = compileGssReference({ config, modules: [
    { id: 'A.gss', source: '.a { background-image: url(a); }', assetReferences: [{ url: 'a', identity: 'asset' }] },
    { id: 'Z.gss', source }
  ] }, { resolveAssetUrl() { calls++; return '/out.svg'; } });
  expect(result).toMatchObject({ success: false, diagnostics: [{ severity: 'error', id: 'Z.gss' }] });
  expect(result).not.toHaveProperty('css');
  expect(result).not.toHaveProperty('scopeSchemas');
  expect(calls).toBe(0);
});

it.each([' ', '\t', '\n', '\r', '\f'])(
  'preserves CSS separator whitespace and case-insensitive ordinary importance: %j', (whitespace) => {
    const result = compileGssReference({ config, modules: [{ id: 'A.gss', source:
      `.a { animation-name${whitespace}:${whitespace}pulse !${whitespace}ImPoRtAnT; }
       @keyframes pulse { from { width${whitespace}:${whitespace}1px; } }` }] });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.css).toContain(`!${whitespace}ImPoRtAnT`);
    expect(result.css).toContain(`width${whitespace}:${whitespace}1px`);
    const declarations: postcss.Declaration[] = [];
    postcss.parse(result.css).walkDecls('animation-name', (declaration) => { declarations.push(declaration); });
    expect(declarations).toHaveLength(1);
    expect(declarations[0]!.important).toBe(true);
    expect(declarations[0]!.value).toBe('gss_ref_keyframes_41_2e_67_73_73__70_75_6c_73_65');
  }
);
