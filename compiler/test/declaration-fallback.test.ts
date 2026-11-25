import { expect, it } from 'vitest';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { createGssCompilerSession } from '../src/index.js';
import { createReadableAtomicName, decodeReadableAtomicName, type PureDeclarationIdentity } from '../src/domain/readable-name.js';

function compile(source: string, options = {}) {
  const session = createGssCompilerSession({ projectRoot: '/project', ...options });
  const result = session.replaceStylesheet({ id: '/project/a.gss', source });
  expect(result.committed).toBe(true);
  return { session, result, snapshot: session.finalize() };
}

it('emits an adjacent fallback sequence as one atomic class without losing order or duplicates', () => {
  const { result, snapshot } = compile('.a { display: block; display: flex; display: flex; }');
  expect(result.module?.compilationMode).toBe('atomic');
  expect(snapshot.report.rules).toBe(1);
  expect(result.module?.scopeSchema.exports.a?.selfClassName.split(' ')).toHaveLength(1);
  expect(snapshot.css).toContain('display: block;\n  display: flex;\n  display: flex;');
});

it('distinguishes the full ordered group from its last value and reuses identical groups', () => {
  const { session, snapshot } = compile('.a { display: block; display: flex; } .b { display: block; display: flex; } .c { display: flex; }');
  const exports = session.getScopeSchema('/project/a.gss')!.exports;
  expect(exports.a!.selfClassName).toBe(exports.b!.selfClassName);
  expect(exports.a!.selfClassName).not.toBe(exports.c!.selfClassName);
  expect(snapshot.report.rules).toBe(2);
  const first = compile('.a { display: block; display: flex; }').snapshot.manifest.rules[0]!.className;
  const reversed = compile('.a { display: flex; display: block; }').snapshot.manifest.rules[0]!.className;
  expect(first).not.toBe(reversed);
});

it.each(['.a', '.a:focus', '.panel[x] > .a', '.panel[x] .a'])('keeps interleaved writes, locations and atomic mode for %s', selector => {
  const source = `${selector}{margin:1px;margin-left:9px;margin:var(--size)}`;
  const { snapshot, result } = compile(source, { atomizationFallback: 'error' });
  expect(result.module?.compilationMode).toBe('atomic');
  expect(snapshot.manifest.rules.map(r => [r.property, r.value, r.origins[0]!.range.start])).toEqual([
    ['margin', '1px', source.indexOf('margin:1px')], ['margin-left', '9px', source.indexOf('margin-left')],
    ['margin', 'var(--size)', source.indexOf('margin:var')]
  ]);
});

it.each(['.icon::before{content:"•";margin-left:17px}', '.a:has(> .child){width:7px}', '.a :global(.tag){width:7px}'])('keeps local alternatives alongside %s', other => {
  for (const reverse of [false, true]) {
    const local = '.a{margin:1px;margin-left:9px;margin:gss-unsupported}';
    const { snapshot } = compile(reverse ? other + local : local + other, { atomizationFallback: 'error' });
    expect(snapshot.manifest.rules.filter(r => ['1px', '9px', 'gss-unsupported'].includes(r.value)).map(r => r.value))
      .toEqual(['1px', '9px', 'gss-unsupported']);
    expect(snapshot.css).toContain(other.includes('before') ? '17px' : '7px');
  }
});

it.each(['.a:has(> .child){margin-left:3px}', '.a :global(.tag){margin-inline-start:3px}',
  '.a:has(> .child){width:7px}.bridge{width:9px;margin-bottom:3px}'])('keeps connected element conflicts transactional: %s', other => {
  const base = '.a{margin:1px;color:red;margin:2px}';
  const { session, snapshot } = compile(base + '.a::before{content:"•"}');
  const source = base + other;
  expect(session.replaceStylesheet({ id: '/project/a.gss', source })).toMatchObject({ committed: false,
    diagnostics: [{ code: 'GSS1204', range: { start: source.indexOf('margin:2px'), end: source.indexOf('margin:2px') + 10 } }] });
  expect(session.finalize()).toEqual(snapshot);
});

it.each(['.a::before', '.a::after', '.panel .a:focus::before', '.a::placeholder'])('retains interleaved writes on %s', selector => {
  const source = `${selector}{color:red;display:block;color:gss-unsupported}`;
  const { snapshot } = compile(source, { atomizationFallback: 'error' });
  expect(snapshot.manifest.rules.map(r => [r.value, r.origins[0]!.range.start])).toEqual([
    ['red', source.indexOf('color:red')], ['block', source.indexOf('display:block')],
    ['gss-unsupported', source.indexOf('color:gss-unsupported')]
  ]);
});

it.each(['.box:has(> .child)', '.box:has(> .child, > .alt)', '.box:has(> .child):has(+ .alt)'])('retains all observed writes and their source offsets on %s', selector => {
  const source = `${selector}{margin:1px;margin-left:9px;margin:gss-unsupported}`;
  const { snapshot } = compile(source, { atomizationFallback: 'error' });
  for (const branch of new Set(snapshot.manifest.rules.map(r => r.selector))) {
    expect(snapshot.manifest.rules.filter(r => r.selector === branch).map(r => [r.value, r.origins[0]!.range.start])).toEqual([
      ['1px', source.indexOf('margin:1px')], ['9px', source.indexOf('margin-left')],
      ['gss-unsupported', source.indexOf('margin:gss-unsupported')]
    ]);
  }
  expect(snapshot.css).toContain(':has(');
});

it('retains the observed last-good contribution on a connected non-observed update', () => {
  const source = '.a:has(> .b){margin:1px;margin-left:9px;margin:2px}';
  const { session, snapshot } = compile(source);
  expect(session.replaceStylesheet({ id: '/project/a.gss', source: source + '.a{margin-left:4px}' }))
    .toMatchObject({ committed: false, diagnostics: [{ code: 'GSS1204' }] });
  expect(session.finalize()).toEqual(snapshot);
});

it('keeps the previous pseudo-element sequence when an update introduces an unsupported state tie', () => {
  const source = '.a:focus::before{color:red;display:block;color:gss-unsupported}';
  const { session, snapshot } = compile(source);
  expect(session.replaceStylesheet({ id: '/project/a.gss', source: source + '.a:hover::before{color:blue}' }))
    .toMatchObject({ committed: false, diagnostics: [{ code: 'GSS1205' }] });
  expect(session.finalize()).toEqual(snapshot);
});

it('reports only unsupported repetitions in a mixed module', () => {
  const source = '.a{display:block;color:red;display:flex}.a::before{margin:1px;all:unset;margin:2px}';
  const session = createGssCompilerSession({ projectRoot: '/project' });
  expect(session.replaceStylesheet({ id: '/project/a.gss', source }).diagnostics).toMatchObject([
    { code: 'GSS1204', range: { start: source.indexOf('margin:2px') } }
  ]);
});

it('keeps opaque interleaved writes rejected and retains the previous contribution', () => {
  const { session, snapshot } = compile('.a { color: red; display: block; color: blue; }');
  expect(session.replaceStylesheet({ id: '/project/a.gss', source: '.a { color: red; all: unset; color: blue; }' }))
    .toMatchObject({ committed: false, diagnostics: [expect.objectContaining({ code: 'GSS1204' })] });
  expect(session.finalize()).toEqual(snapshot);
});

it('retains importance and keeps shorthand fallback groups unexpanded', () => {
  const { snapshot } = compile('.a { margin: 1px !important; margin: 2px !important; margin-left: 3px; }');
  expect(snapshot.css).toContain('margin: 1px !important;\n  margin: 2px !important;');
  expect(snapshot.css).not.toContain('margin-top');
});

it('retains all alternatives in existing preserved fallback', () => {
  const { result, snapshot } = compile('.a { future-paint: one; future-paint: two; color: red; color: blue; }');
  expect(result.module?.compilationMode).toBe('preserved');
  expect(snapshot.css).toContain('future-paint: one;\n  future-paint: two;');
  expect(snapshot.css).toContain('color: red;\n  color: blue;');
});

it.each([
  '.a:hover', '.a + .b', '.a:has(> .b)', '.a::before', '.a :global(.external)'
])('retains fallback groups through the existing selector path %s', selector => {
  const { snapshot } = compile(`${selector} { display: block; display: flex; }`);
  expect(snapshot.report.rules).toBe(1);
  expect(snapshot.css).toContain('display: block;\n  display: flex;');
  expect(snapshot.manifest.rules[0]).toMatchObject({ fallbackValues: ['block'], value: 'flex' });
  expect(snapshot.manifest.rules[0]).not.toHaveProperty('flatAtom');
});

it('preserves each alternative through host compatibility stages', () => {
  const { result, snapshot } = compile('.a { display: block; display: flex; }', {
    compatibilityTargetStages: [{ safari: '6' }]
  });
  expect(result.module?.compilationMode).toBe('atomic');
  expect(snapshot.css).toContain('display: -webkit-box;');
  expect(snapshot.css.indexOf('display: block;')).toBeLessThan(snapshot.css.indexOf('display: -webkit-box;'));
  expect(snapshot.css.indexOf('display: -webkit-box;')).toBeLessThan(snapshot.css.indexOf('display: flex;'));
});

it('binds assets in every alternative and separates prefix-only identity changes', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const source = '.a { background-image: url(old.svg); background-image: url(new.svg); }';
  const replace = (identity: string) => session.replaceStylesheet({ id: '/project/a.gss', source,
    assetReferences: [{ url: 'old.svg', identity }, { url: 'new.svg', identity: 'new' }] });
  expect(replace('old').committed).toBe(true);
  const before = session.getScopeSchema('/project/a.gss')!.exports.a!.selfClassName;
  const snapshot = session.finalize({ resolveAssetUrl: identity => `/out/${identity}.svg` });
  expect(snapshot.css).toContain('background-image: url("/out/old.svg");\n  background-image: url("/out/new.svg");');
  expect(snapshot.manifest.rules[0]?.fallbackValues).toEqual(['url("/out/old.svg")']);
  expect(replace('other').committed).toBe(true);
  expect(session.getScopeSchema('/project/a.gss')!.exports.a!.selfClassName).not.toBe(before);
});

it('normalizes keyframe references in every alternative independently of naming mode', () => {
  const source = '@keyframes spin { to { opacity: 0; } } .a { animation-name: spin; animation-name: none; }';
  const dev = compile(source).snapshot;
  const prod = compile(source, { namingMode: 'production' }).snapshot;
  expect(dev.manifest.rules[0]!.className.slice(-8)).toBe(prod.manifest.rules[0]!.className.slice(1));
  expect(prod.css).toContain(`animation-name: ${prod.manifest.resources[0]!.name};\n  animation-name: none;`);
});

it('round-trips complete fallback identity without conflating opaque text and assets', () => {
  const identity: PureDeclarationIdentity = { layer: null, condition: 'base', state: 'self',
    property: 'background-image', value: 'none', important: false,
    fallbackValues: [{ value: 'url(a.svg)' }, { value: '["",{"asset":"a"},""]', assetValue: true }] };
  expect(decodeReadableAtomicName(createReadableAtomicName(identity))).toEqual(identity);
  expect(createReadableAtomicName(identity)).not.toBe(createReadableAtomicName({ ...identity,
    fallbackValues: [...identity.fallbackValues!].reverse() }));
});

it('retains each origin and maps shared groups to the deterministic primary source', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  expect(session.replaceStylesheet({ id: '/project/z.gss', source: '\n\n.z { display:block; display:flex; }' }).committed).toBe(true);
  expect(session.replaceStylesheet({ id: '/project/a.gss', source: '.a {\n display:block;\n display:flex;\n}' }).committed).toBe(true);
  const snapshot = session.finalize();
  expect(snapshot.report.rules).toBe(1);
  expect(snapshot.manifest.rules[0]!.origins.map(origin => origin.moduleId)).toEqual(['a.gss', 'z.gss']);
  const lines = snapshot.css.slice(0, snapshot.css.indexOf('display: block')).split('\n');
  expect(originalPositionFor(new TraceMap(snapshot.sourceMap), { line: lines.length, column: lines.at(-1)!.length }))
    .toMatchObject({ source: 'a.gss', line: 2, column: 1 });
});

it('maps each alternative to its own original declaration', () => {
  const source = '.a {\n display: block;\n display: flex;\n}';
  const { snapshot } = compile(source);
  const map = new TraceMap(snapshot.sourceMap);
  for (const [needle, line] of [['display: block', 2], ['display: flex', 3]] as const) {
    const before = snapshot.css.slice(0, snapshot.css.indexOf(needle)).split('\n');
    expect(originalPositionFor(map, { line: before.length, column: before.at(-1)!.length }))
      .toMatchObject({ source: 'a.gss', line, column: 1 });
  }
});
