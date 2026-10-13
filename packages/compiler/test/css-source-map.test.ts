import { expect, it } from 'vitest';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { createGssCompilerSession } from '../src/index.js';

function generatedPosition(css: string, token: string, occurrence = 0) {
  let index = -1;
  for (let i = 0; i <= occurrence; i++) index = css.indexOf(token, index + 1);
  expect(index).toBeGreaterThanOrEqual(0);
  const lines = css.slice(0, index).split('\n');
  return { line: lines.length, column: lines.at(-1)!.length };
}

it('maps shared and compatibility-expanded declarations to a stable primary authored origin', () => {
  const session = createGssCompilerSession({ projectRoot: '/project',
    compatibilityTargetStages: [{ safari: '6.0' }] });
  const b = '.card { display: flex; }';
  const a = '\r\n.card { display: /*😀*/ flex; }';
  expect(session.replaceStylesheet({ id: '/project/b.gss', source: b }).committed).toBe(true);
  expect(session.replaceStylesheet({ id: '/project/a.gss', source: a }).committed).toBe(true);
  const snapshot = session.finalize();
  expect(snapshot.sourceMap.sources).toEqual(['a.gss']);
  expect(snapshot.sourceMap.sourcesContent).toEqual([a]);
  expect(snapshot.manifest.rules[0]?.sources).toEqual(['a.gss', 'b.gss']);
  const map = new TraceMap(snapshot.sourceMap);
  for (const physical of ['display: -webkit-box;', 'display: -webkit-flex;', 'display: flex;']) {
    expect(originalPositionFor(map, generatedPosition(snapshot.css, physical))).toMatchObject({
      source: 'a.gss', line: 2, column: a.indexOf('display:') - a.indexOf('\n') - 1
    });
  }
  session.invalidate('/project/a.gss');
  const remaining = session.finalize();
  expect(remaining.sourceMap.sources).toEqual(['b.gss']);
  expect(remaining.sourceMap.sourcesContent).toEqual([b]);
});

it('tracks generated lines through the unmapped layer prelude and media wrapper', () => {
  const session = createGssCompilerSession({ projectRoot: '/project', layers: ['base'],
    conditions: { media: ['(min-width: 400px)'] } });
  const source = '@layer base { @media (min-width: 400px) { .card { color: red; } } }';
  expect(session.replaceStylesheet({ id: '/project/card.gss', source }).committed).toBe(true);
  const snapshot = session.finalize();
  const map = new TraceMap(snapshot.sourceMap);
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'color: red;'))).toMatchObject({
    source: 'card.gss', line: 1, column: source.indexOf('color: red;')
  });
  expect(snapshot.sourceMap.sourcesContent).toEqual([source]);
});

it('maps physical declarations in a preserved compatibility Module to authored declarations', () => {
  const session = createGssCompilerSession({ projectRoot: '/project',
    compatibilityTargetStages: [{ safari: '6.0' }] });
  const source = '.card { flex-direction: column; color: red; }';
  expect(session.replaceStylesheet({ id: '/project/card.gss', source })).toMatchObject({
    committed: true, module: { compilationMode: 'preserved' }
  });
  const snapshot = session.finalize();
  const map = new TraceMap(snapshot.sourceMap);
  expect(originalPositionFor(map, generatedPosition(snapshot.css, '-webkit-box-orient: vertical;'))).toMatchObject({
    source: 'card.gss', line: 1, column: source.indexOf('flex-direction:')
  });
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'color: red;'))).toMatchObject({
    source: 'card.gss', line: 1, column: source.indexOf('color:')
  });
});

it('traces an authored keyframe step and its declaration through resource output', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const source = '@keyframes move { from { opacity: 0; } to { opacity: 1; } }';
  expect(session.replaceStylesheet({ id: '/project/move.gss', source }).committed).toBe(true);
  const snapshot = session.finalize();
  const map = new TraceMap(snapshot.sourceMap);
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'from {'))).toMatchObject({
    source: 'move.gss', line: 1, column: source.indexOf('from {')
  });
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'opacity: 1;'))).toMatchObject({
    source: 'move.gss', line: 1, column: source.lastIndexOf('opacity:')
  });
});

it('retains a keyframe step origin across target-generated prefixed resource pairs', () => {
  const session = createGssCompilerSession({ projectRoot: '/project',
    compatibilityTargetStages: [{ safari: '6.0' }] });
  const source = '@keyframes move { to { opacity: 1; } } .card { animation-name: move; }';
  expect(session.replaceStylesheet({ id: '/project/move.gss', source }).committed).toBe(true);
  const snapshot = session.finalize();
  expect(snapshot.css).toContain('@-webkit-keyframes');
  const map = new TraceMap(snapshot.sourceMap);
  for (let index = 0; index < 2; index++) {
    expect(originalPositionFor(map, generatedPosition(snapshot.css, 'to {', index))).toMatchObject({
      source: 'move.gss', line: 1, column: source.indexOf('to {')
    });
    expect(originalPositionFor(map, generatedPosition(snapshot.css, 'opacity: 1;', index))).toMatchObject({
      source: 'move.gss', line: 1, column: source.indexOf('opacity:')
    });
  }
});

it('maps a shared property descriptor to the primary owner, not the first registered owner', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const b = '@property --tone { syntax: "<color>"; inherits: false; initial-value: red; }';
  const a = `\r\n${b}`;
  expect(session.replaceStylesheet({ id: '/project/b.gss', source: b }).committed).toBe(true);
  expect(session.replaceStylesheet({ id: '/project/a.gss', source: a }).committed).toBe(true);
  const snapshot = session.finalize();
  expect(snapshot.manifest.resources[0]?.sources).toEqual(['a.gss', 'b.gss']);
  expect(originalPositionFor(new TraceMap(snapshot.sourceMap),
    generatedPosition(snapshot.css, 'initial-value: red;'))).toMatchObject({
    source: 'a.gss', line: 2, column: b.indexOf('initial-value:')
  });
  expect(snapshot.sourceMap.sourcesContent).toEqual([a]);
});

it('maps preserved and resource blocks without borrowing unrelated Module origins', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const resource = '@font-face { font-family: Demo; src: url(demo.woff2); }';
  const preserved = '.card { future-paint: red; } .icon { color: blue; }';
  expect(session.replaceStylesheet({ id: '/project/z.gss', source: resource }).committed).toBe(true);
  expect(session.replaceStylesheet({ id: '/project/p.gss', source: preserved }).committed).toBe(true);
  const snapshot = session.finalize();
  const map = new TraceMap(snapshot.sourceMap);
  expect(originalPositionFor(map, generatedPosition(snapshot.css, '@font-face'))).toMatchObject({
    source: 'z.gss', line: 1, column: 0
  });
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'src: url(demo.woff2);'))).toMatchObject({
    source: 'z.gss', line: 1, column: resource.indexOf('src:')
  });
  expect(originalPositionFor(map, generatedPosition(snapshot.css, '.gss-s--module_p_2e_gss--path_icon'))).toMatchObject({
    source: 'p.gss', line: 1, column: preserved.indexOf('.icon')
  });
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'color: blue;'))).toMatchObject({
    source: 'p.gss', line: 1, column: preserved.indexOf('color:')
  });
  expect(snapshot.sourceMap.sourcesContent).toEqual([resource, preserved]);
});
