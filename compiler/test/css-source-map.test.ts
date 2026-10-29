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

it('orders distinct Unicode Module origins independent of registration order', () => {
  const ids = ['caf\u00e9.gss', 'cafe\u0301.gss'] as const;
  const origins = (order: readonly string[]) => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    for (const id of order) expect(session.replaceStylesheet({ id: `/project/${id}`,
      source: '.card { color: red; }' }).committed).toBe(true);
    return session.finalize().manifest.rules[0]!.origins;
  };
  const expected = ids.slice().sort().map((moduleId) => ({
    moduleId, range: { start: 8, end: 19 }
  }));
  expect(origins(ids)).toEqual(expected);
  expect(origins([...ids].reverse())).toEqual(expected);
});

it('records every contributing declaration when adjacent occurrence versions share one atom in a Module', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const source = '.a { color: red; } .b { color: red; }';
  expect(session.replaceStylesheet({ id: '/project/card.gss', source }).committed).toBe(true);
  const snapshot = session.finalize();
  expect(snapshot.manifest.rules).toHaveLength(1);
  expect(originalPositionFor(new TraceMap(snapshot.sourceMap), generatedPosition(snapshot.css, 'color:'))).toMatchObject({
    source: 'card.gss', line: 1, column: source.indexOf('color:')
  });
  const positions = [...source.matchAll(/color: red;/g)].map((match) => match.index);
  expect(snapshot.manifest.rules.flatMap((rule) => rule.origins)).toEqual(positions.map((start) => ({
    moduleId: 'card.gss', range: { start, end: start + 'color: red;'.length }
  })));
  expect(snapshot.manifest.rules[0]?.sources).toEqual(['card.gss']);
});

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
  expect(snapshot.manifest.rules[0]?.origins).toEqual([
    { moduleId: 'a.gss', range: { start: a.indexOf('display:'), end: a.indexOf('display:') + 'display: /*😀*/ flex;'.length } },
    { moduleId: 'b.gss', range: { start: b.indexOf('display:'), end: b.indexOf('display:') + 'display: flex;'.length } }
  ]);
  const map = new TraceMap(snapshot.sourceMap);
  for (const physical of ['display: -webkit-box;', 'display: -webkit-flex;', 'display: flex;']) {
    expect(originalPositionFor(map, generatedPosition(snapshot.css, physical))).toMatchObject({
      source: 'a.gss', line: 2, column: a.indexOf('display:') - a.indexOf('\n') - 1
    });
    // A comment before the value prevents a reliable simple-token mapping.
    expect(originalPositionFor(map, generatedPosition(snapshot.css, physical.slice('display: '.length)))).toMatchObject({
      source: 'a.gss', line: 2, column: a.indexOf('display:') - a.indexOf('\n') - 1
    });
  }
  session.invalidate('/project/a.gss');
  const remaining = session.finalize();
  expect(remaining.sourceMap.sources).toEqual(['b.gss']);
  expect(remaining.sourceMap.sourcesContent).toEqual([b]);
  expect(remaining.manifest.rules[0]?.origins).toEqual([
    { moduleId: 'b.gss', range: { start: b.indexOf('display:'), end: b.indexOf('display:') + 'display: flex;'.length } }
  ]);
});

it('maps simple atomic physical value starts to the authored value, not the property', () => {
  const session = createGssCompilerSession({ projectRoot: '/project',
    compatibilityTargetStages: [{ safari: '6.0' }] });
  const source = '\r\n.card { display: flex; }';
  expect(session.replaceStylesheet({ id: '/project/card.gss', source }).committed).toBe(true);
  const snapshot = session.finalize();
  const map = new TraceMap(snapshot.sourceMap);
  for (const physical of ['-webkit-box;', '-webkit-flex;', 'flex;']) {
    expect(originalPositionFor(map, generatedPosition(snapshot.css, physical))).toMatchObject({
      source: 'card.gss', line: 2, column: source.indexOf('flex;') - source.indexOf('\n') - 1
    });
  }
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'display:'))).toMatchObject({
    source: 'card.gss', line: 2, column: source.indexOf('display:') - source.indexOf('\n') - 1
  });
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
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'vertical;'))).toMatchObject({
    source: 'card.gss', line: 1, column: source.indexOf('column;')
  });
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'red;'))).toMatchObject({
    source: 'card.gss', line: 1, column: source.indexOf('red;')
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
  expect(originalPositionFor(map, generatedPosition(snapshot.css, '1;'))).toMatchObject({
    source: 'move.gss', line: 1, column: source.indexOf('1;')
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
  expect(snapshot.manifest.resources[0]?.origins).toEqual([
    { moduleId: 'a.gss', range: { start: 2, end: a.length } },
    { moduleId: 'b.gss', range: { start: 0, end: b.length } }
  ]);
  expect(originalPositionFor(new TraceMap(snapshot.sourceMap),
    generatedPosition(snapshot.css, 'initial-value: red;'))).toMatchObject({
    source: 'a.gss', line: 2, column: b.indexOf('initial-value:')
  });
  expect(snapshot.sourceMap.sourcesContent).toEqual([a]);
  expect(originalPositionFor(new TraceMap(snapshot.sourceMap),
    generatedPosition(snapshot.css, 'red;'))).toMatchObject({
    source: 'a.gss', line: 2, column: b.indexOf('red;')
  });
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
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'url(demo.woff2);'))).toMatchObject({
    source: 'z.gss', line: 1, column: resource.indexOf('url(demo.woff2);')
  });
  expect(originalPositionFor(map, generatedPosition(snapshot.css, '.gss-s--module_p_2e_gss--path_icon'))).toMatchObject({
    source: 'p.gss', line: 1, column: preserved.indexOf('.icon')
  });
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'color: blue;'))).toMatchObject({
    source: 'p.gss', line: 1, column: preserved.indexOf('color:')
  });
  expect(snapshot.sourceMap.sourcesContent).toEqual([resource, preserved]);
  expect(snapshot.manifest.preservedRules).toEqual([
    { moduleId: 'p.gss', range: { start: 0, end: preserved.indexOf(' .icon') } },
    { moduleId: 'p.gss', range: { start: preserved.indexOf('.icon'), end: preserved.length } }
  ]);
});

it('maps expanded margin sides back to their authored declarations', () => {
  const source = '.box { margin: 1px 2px; margin-left: 9px; }';
  const session = createGssCompilerSession({ projectRoot: '/project' });
  expect(session.replaceStylesheet({ id: '/project/box.gss', source }).committed).toBe(true);
  const snapshot = session.finalize();
  const map = new TraceMap(snapshot.sourceMap);
  for (const side of ['top', 'right', 'bottom', 'left']) {
    expect(originalPositionFor(map, generatedPosition(snapshot.css, `margin-${side}:`))).toMatchObject({
      source: 'box.gss', line: 1, column: source.indexOf(side === 'left' ? 'margin-left:' : 'margin:')
    });
  }
});

it('restores expanded margin output after an invalid replacement', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const id = '/project/box.gss';
  const source = '.box { margin: 1px 2px; margin-left: 9px; }';
  expect(session.replaceStylesheet({ id, source }).committed).toBe(true);
  const initial = session.finalize();
  expect(session.replaceStylesheet({ id, source: '.box { color: red; color: blue; }' }).committed).toBe(false);
  expect(session.finalize()).toEqual(initial);
  expect(session.replaceStylesheet({ id, source }).committed).toBe(true);
  const recovered = session.finalize();
  expect(recovered.css).toBe(initial.css);
  expect(recovered.sourceMap).toEqual(initial.sourceMap);
  expect(recovered.manifest).toEqual(initial.manifest);
});

it('maps cross-scope expanded margin atoms to the originating shorthand', () => {
  const source = '.a { margin: 1px 2px; } .b { margin-left: 9px; }';
  const session = createGssCompilerSession({ projectRoot: '/project' });
  expect(session.replaceStylesheet({ id: '/project/box.gss', source }).committed).toBe(true);
  const snapshot = session.finalize();
  const map = new TraceMap(snapshot.sourceMap);
  for (const side of ['top', 'right', 'bottom', 'left']) {
    expect(originalPositionFor(map, generatedPosition(snapshot.css, `margin-${side}:`))).toMatchObject({
      source: 'box.gss', line: 1, column: source.indexOf('margin:')
    });
  }
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'margin-left: 9px;'))).toMatchObject({
    source: 'box.gss', line: 1, column: source.indexOf('margin-left:')
  });
});


it('maps cross-scope expanded padding atoms to their authored declarations', () => {
  const source = '.a { padding: 1px 2px; } .b { padding-left: 9px; }';
  const session = createGssCompilerSession({ projectRoot: '/project' });
  expect(session.replaceStylesheet({ id: '/project/box.gss', source }).committed).toBe(true);
  const snapshot = session.finalize();
  const map = new TraceMap(snapshot.sourceMap);
  for (const side of ['top', 'right', 'bottom', 'left']) {
    expect(originalPositionFor(map, generatedPosition(snapshot.css, `padding-${side}:`))).toMatchObject({
      source: 'box.gss', line: 1, column: source.indexOf('padding:')
    });
  }
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'padding-left: 9px;'))).toMatchObject({
    source: 'box.gss', line: 1, column: source.indexOf('padding-left:')
  });
});


it('maps the retained declaration after an invalid padding shorthand is ignored', () => {
  const source = '.box { padding-left: 9px; padding: -1px; }';
  const session = createGssCompilerSession({ projectRoot: '/project' });
  expect(session.replaceStylesheet({ id: '/project/box.gss', source }).committed).toBe(true);
  const snapshot = session.finalize();
  expect(originalPositionFor(new TraceMap(snapshot.sourceMap), generatedPosition(snapshot.css, 'padding-left:'))).toMatchObject({
    source: 'box.gss', line: 1, column: source.indexOf('padding-left:')
  });
});


it('maps cross-scope expanded inset atoms to their original declarations', () => {
  const source = '.a { inset: 1px 2px; } .b { left: 9px; }';
  const session = createGssCompilerSession({ projectRoot: '/project' });
  expect(session.replaceStylesheet({ id: '/project/box.gss', source }).committed).toBe(true);
  const snapshot = session.finalize();
  const map = new TraceMap(snapshot.sourceMap);
  for (const side of ['top', 'right', 'bottom', 'left']) {
    expect(originalPositionFor(map, generatedPosition(snapshot.css, `${side}:`))).toMatchObject({
      source: 'box.gss', line: 1, column: source.indexOf('inset:')
    });
  }
  expect(originalPositionFor(map, generatedPosition(snapshot.css, 'left: 9px;'))).toMatchObject({
    source: 'box.gss', line: 1, column: source.indexOf('left:')
  });
});

it.each(['scroll-margin', 'scroll-padding'])('maps expanded %s sides and the competing longhand to their own sources', (family) => {
  const source = `.a{${family}:1px 2px}.b{${family}-left:9px}`;
  const session = createGssCompilerSession({ projectRoot: '/project' });
  expect(session.replaceStylesheet({ id: '/project/scroll.gss', source }).committed).toBe(true);
  const snapshot = session.finalize();
  const map = new TraceMap(snapshot.sourceMap);
  for (const side of ['top', 'right', 'bottom', 'left']) {
    expect(originalPositionFor(map, generatedPosition(snapshot.css, `${family}-${side}:`))).toMatchObject({
      source: 'scroll.gss', line: 1, column: source.indexOf(`${family}:`)
    });
  }
  expect(originalPositionFor(map, generatedPosition(snapshot.css, `${family}-left: 9px;`))).toMatchObject({
    source: 'scroll.gss', line: 1, column: source.indexOf(`${family}-left:`)
  });
});

it.each(['margin', 'padding', 'inset', 'scroll-margin', 'scroll-padding'])('maps expanded logical %s declarations to authored sources', (family) => {
  for (const axis of ['inline', 'block']) {
    const property = `${family}-${axis}`;
    const source = `.a{${property}:1px 2px}.b{${property}-start:9px}`;
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id: '/project/box.gss', source }).committed).toBe(true);
    const snapshot = session.finalize();
    const map = new TraceMap(snapshot.sourceMap);
    for (const side of ['start', 'end']) expect(originalPositionFor(map, generatedPosition(snapshot.css, `${property}-${side}:`))).toMatchObject({ source: 'box.gss', line: 1, column: source.indexOf(`${property}:`) });
    expect(originalPositionFor(map, generatedPosition(snapshot.css, `${property}-start: 9px;`))).toMatchObject({ source: 'box.gss', line: 1, column: source.indexOf(`${property}-start:`) });
  }
});


it.each(['margin', 'padding', 'inset', 'scroll-padding'])('maps percentage %s shorthand and longhand to their own sources', (family) => {
  for (const axis of ['', '-inline', '-block']) {
    const shorthand = `${family}${axis}`;
    const side = axis ? `${shorthand}-start` : family === 'inset' ? 'left' : `${family}-left`;
    const source = `.a{${shorthand}:1% 2px}.b{${side}:9%}`;
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id: '/project/box.gss', source }).committed).toBe(true);
    const snapshot = session.finalize();
    const map = new TraceMap(snapshot.sourceMap);
    expect(originalPositionFor(map, generatedPosition(snapshot.css, `${side}:`, 0))).toMatchObject({ source: 'box.gss', line: 1, column: source.indexOf(`${shorthand}:`) });
    expect(originalPositionFor(map, generatedPosition(snapshot.css, `${side}:`, 1))).toMatchObject({ source: 'box.gss', line: 1, column: source.indexOf(`${side}:`) });
  }
});

it.each(['margin', 'padding', 'inset', 'scroll-margin', 'scroll-padding'])('maps expanded %s font lengths to authored declarations', (family) => {
  const source = `.a{${family}-inline:1em 2rem}.b{${family}-inline-start:3em}`;
  const session = createGssCompilerSession({ projectRoot: '/project' });
  expect(session.replaceStylesheet({ id: '/project/box.gss', source }).committed).toBe(true);
  const snapshot = session.finalize();
  const map = new TraceMap(snapshot.sourceMap);
  expect(originalPositionFor(map, generatedPosition(snapshot.css, `${family}-inline-start:`, 0))).toMatchObject({ source: 'box.gss', line: 1, column: source.indexOf(`${family}-inline:`) });
  expect(originalPositionFor(map, generatedPosition(snapshot.css, `${family}-inline-start:`, 1))).toMatchObject({ source: 'box.gss', line: 1, column: source.indexOf(`${family}-inline-start:`) });
});
