import { expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

function compile(source: string) {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  expect(session.replaceStylesheet({ id: '/project/Fixed.gss', source })).toMatchObject({ committed: true, diagnostics: [] });
  return session;
}

it('orders already-admitted simple same-module color composition by authored occurrence', () => {
  const session = compile('.a { color: red; } .b { color: blue; }');
  expect(session.finalize().manifest.rules.map((rule) => rule.value)).toEqual(['red', 'blue']);
});

it.each(['.a:where(:checked), .a:focus', '.a:focus, .a:where(:checked)'])('keeps selector branch implication for %s', (branches) => {
  const session = compile(`.a:where(:checked):where(:disabled) { color: blue; } ${branches} { color: red; }`);
  const matching = session.finalize().manifest.rules.filter((rule) => !rule.selector.includes(':focus'));
  expect(matching.map((rule) => rule.value)).toEqual(['red', 'blue']);
});

it.each(['.a::before, .a::after', '.a::after, .a::before'])('separates pseudo subjects for %s', (branches) => {
  const session = compile(`${branches} { color: red; } .b::before { color: blue; }`);
  expect(session.finalize().manifest.rules.filter((rule) => rule.selector.endsWith('::before')).map((rule) => rule.value)).toEqual(['red', 'blue']);
});

function rulesFor(session: ReturnType<typeof compile>, path: string[]) {
  let node = { selfClassName: '', targets: session.getScopeSchema('/project/Fixed.gss')!.exports };
  for (const part of path) node = node.targets[part]!;
  const classes = node.selfClassName.split(' ');
  return session.finalize().manifest.rules.filter((rule) => classes.includes(rule.className));
}

it.each([false, true])('retains structural refinement above owned color in either authored order (%s)', (reverse) => {
  const rules = ['.root > .item { color: blue; }', '.root .item { color: red; }'];
  const session = compile((reverse ? rules.reverse() : rules).join(' '));
  expect(rulesFor(session, ['root', 'item']).map((rule) => rule.value)).toEqual(['red', 'blue']);
});

it('orders child blue above ordinary green and owned red without unrelated structure excluding ordinary effects', () => {
  const session = compile('.root > .item { color: blue; } .b { color: green; } .root .item { color: red; } .a { background-color: red; } .c { background-color: blue; }');
  expect(session.finalize().manifest.rules.filter((rule) => rule.property === 'color').map((rule) => rule.value)).toEqual(['green', 'red', 'blue']);
  expect(session.finalize().manifest.rules.filter((rule) => rule.property === 'background-color').map((rule) => rule.value)).toEqual(['red', 'blue']);
});

it('uses original declaration ordinals on every comma branch and retains shorthand winners', () => {
  for (const selectors of ['.a, .b', '.b, .a']) {
    const session = compile(`${selectors} { margin-left: 2px; margin: 1px; }`);
    for (const path of [['a'], ['b']]) expect(Object.fromEntries(rulesFor(session, path).map((rule) => [rule.property, rule.value]))).toEqual({ 'margin-top': '1px', 'margin-right': '1px', 'margin-bottom': '1px', 'margin-left': '1px' });
    const reversed = compile(`${selectors} { margin: 1px; margin-left: 2px; }`);
    for (const path of [['a'], ['b']]) expect(Object.fromEntries(rulesFor(reversed, path).map((rule) => [rule.property, rule.value]))).toEqual({ 'margin-top': '1px', 'margin-right': '1px', 'margin-bottom': '1px', 'margin-left': '2px' });
  }
  const nested = compile('.root .item { margin-left: 2px; } .item { margin: 1px; }');
  expect(rulesFor(nested, ['root', 'item']).map((rule) => rule.property)).toEqual(['margin', 'margin-left']);
  expect(rulesFor(nested, ['item']).map((rule) => rule.property)).toEqual(['margin']);
  expect(compile('.a { margin-left: 2px; } .b { margin: 1px; }').finalize().manifest.rules.filter((rule) => rule.property === 'margin-left').map((rule) => rule.value)).toEqual(['2px', '1px']);
});

it.each([
  ['1px', ['1px', '1px', '1px', '1px']],
  ['1px 2px', ['1px', '2px', '1px', '2px']],
  ['1px 2px 3px', ['1px', '2px', '3px', '2px']],
  ['1px 2px 3px 4px', ['1px', '2px', '3px', '4px']]
])('expands safe margin %s and keeps shorthand source provenance', (value, expected) => {
  const source = `.a { margin: ${value}; margin-left: 9px; }`;
  const session = compile(source);
  const rules = rulesFor(session, ['a']);
  for (const [index, side] of ['top', 'right', 'bottom', 'left'].entries()) {
    const rule = rules.find((entry) => entry.property === `margin-${side}`)!;
    expect(rule.value).toBe(side === 'left' ? '9px' : expected[index]);
    const start = source.indexOf(side === 'left' ? 'margin-left:' : 'margin:');
    expect(rule.origins[0]?.range.start).toBe(start);
  }
});

it.each(['var(--space)', '1.px', 'calc(1px + 2px)', '1px 2px 3px 4px 5px'])('retains unsupported margin shorthand %s', (value) => {
  const session = compile(`.a { margin: ${value}; margin-left: 2px; }`);
  expect(rulesFor(session, ['a']).map((rule) => rule.property)).toEqual(['margin', 'margin-left']);
});

it.each([false, true])('keeps expanded side ordering for composed scopes (%s)', (reverse) => {
  const rules = ['.a { margin: 1px; margin-left: 2px; }', '.b { margin-left: 3px; }'];
  const session = compile((reverse ? rules.reverse() : rules).join(' '));
  const a = rulesFor(session, ['a']).find((rule) => rule.property === 'margin-left')!;
  const b = rulesFor(session, ['b']).find((rule) => rule.property === 'margin-left')!;
  const emitted = session.finalize().manifest.rules;
  expect(a.value).toBe('2px');
  expect(b.value).toBe('3px');
  expect(emitted.findIndex((rule) => rule.className === a.className) < emitted.findIndex((rule) => rule.className === b.className)).toBe(!reverse);
});

it.each([false, true])('expands static margin across distinct scopes in authored order (%s)', (reverse) => {
  const authored = ['.a { margin: 1px 2px; }', '.b { margin-left: 9px; }'];
  const source = (reverse ? authored.reverse() : authored).join(' ');
  const session = compile(source);
  const a = rulesFor(session, ['a']);
  expect(Object.fromEntries(a.map((rule) => [rule.property, rule.value]))).toEqual({
    'margin-top': '1px', 'margin-right': '2px', 'margin-bottom': '1px', 'margin-left': '2px'
  });
  expect(a.every((rule) => rule.origins[0]?.range.start === source.indexOf('margin:'))).toBe(true);
  expect(session.finalize().manifest.rules.filter((rule) => rule.property === 'margin-left').map((rule) => rule.value))
    .toEqual(reverse ? ['9px', '2px'] : ['2px', '9px']);
});

it('retains shared selector-list membership after cross-scope expansion', () => {
  const session = compile('.a, .b { margin: 1px; } .c { margin-left: 9px; }');
  const a = rulesFor(session, ['a']);
  const b = rulesFor(session, ['b']);
  expect(a).toHaveLength(4);
  expect(b.map((rule) => rule.className)).toEqual(a.map((rule) => rule.className));
  expect(rulesFor(session, ['c']).map((rule) => [rule.property, rule.value])).toEqual([['margin-left', '9px']]);
});

it.each([
  '.a { margin: var(--space); } .b { margin-left: 9px; }',
  '.a { margin: 1px; } .b { margin-left: var(--space); }',
  '.a { margin: 1px; } .b { margin-left: 9px; } .c { margin-inline-start: 3px; }'
])('retains shorthand when cross-scope effects or values are not proved safe: %s', (source) => {
  expect(compile(source).finalize().manifest.rules.some((rule) => rule.property === 'margin')).toBe(true);
});

it.each([
  ['1px', ['1px', '1px', '1px', '1px']],
  ['1px 2px', ['1px', '2px', '1px', '2px']],
  ['1px 2px 3px', ['1px', '2px', '3px', '2px']],
  ['1px 2px 3px 4px', ['1px', '2px', '3px', '4px']]
])('expands static padding %s and retains the later side and origins', (value, expected) => {
  const source = `.a { padding: ${value}; padding-left: 9px; }`;
  const rules = rulesFor(compile(source), ['a']);
  for (const [index, side] of ['top', 'right', 'bottom', 'left'].entries()) {
    const rule = rules.find((entry) => entry.property === `padding-${side}`)!;
    expect(rule.value).toBe(side === 'left' ? '9px' : expected[index]);
    expect(rule.origins[0]?.range.start).toBe(source.indexOf(side === 'left' ? 'padding-left:' : 'padding:'));
  }
});

it.each([false, true])('preserves padding order across simple scopes (%s)', (reverse) => {
  const authored = ['.a { padding: 1px 2px; }', '.b { padding-left: 9px; }'];
  const session = compile((reverse ? authored.reverse() : authored).join(' '));
  expect(rulesFor(session, ['a']).filter((rule) => rule.property.startsWith('padding-'))).toHaveLength(4);
  expect(session.finalize().manifest.rules.filter((rule) => rule.property === 'padding-left').map((rule) => rule.value))
    .toEqual(reverse ? ['9px', '2px'] : ['2px', '9px']);
});

it.each(['var(--space)', 'calc(1px + 2px)', '1.px'])('does not expand unsafe padding shorthand %s', (value) => {
  const session = compile(`.a { padding: ${value}; padding-left: 2px; }`);
  expect(rulesFor(session, ['a']).map((rule) => rule.property)).toEqual(['padding', 'padding-left']);
});

it.each([
  ['.a { padding-left: 9px; padding: -1px; }', 'padding-left', '9px'],
  ['.a { padding-left: 9px; padding: 1px -2px; }', 'padding-left', '9px'],
  ['.a { padding: 1px; padding-left: -2px; }', 'padding', '1px'],
  ['.a { padding-left: 9px; padding: -1px !important; }', 'padding-left', '9px']
])('ignores provably invalid static negative padding: %s', (source, property, value) => {
  const session = compile(source);
  expect(rulesFor(session, ['a']).map((rule) => [rule.property, rule.value])).toEqual([[property, value]]);
});

it('keeps valid negative zero and leaves var() pending at computed-value time', () => {
  const zero = compile('.a { padding-left: 9px; padding: -0px; }');
  expect(rulesFor(zero, ['a']).some((rule) => rule.value === '-0px')).toBe(true);
  expect(rulesFor(zero, ['a']).some((rule) => rule.value === '9px')).toBe(false);
  const variable = compile('.a { padding-left: 9px; padding: var(--missing); }');
  expect(rulesFor(variable, ['a']).map((rule) => rule.property)).toEqual(['padding']);
});

it.each(['padding-inline', 'padding-block'])('ignores invalid static negative %s shorthand', (property) => {
  const side = `${property}-start`;
  const session = compile(`.a { ${side}: 9px; ${property}: -1px; }`);
  expect(rulesFor(session, ['a']).map((rule) => [rule.property, rule.value])).toEqual([[side, '9px']]);
});

it('ignores invalid padding before logical and physical conflict validation', () => {
  const session = compile('.a { padding-inline-start: 3px; padding: -1px; }');
  expect(rulesFor(session, ['a']).map((rule) => [rule.property, rule.value])).toEqual([['padding-inline-start', '3px']]);
  const stillConflicting = createGssCompilerSession({ projectRoot: '/project' });
  expect(stillConflicting.replaceStylesheet({ id: '/project/Fixed.gss', source: '.a { margin-inline-start: 1px; margin: 2px; padding: -1px; }' }))
    .toMatchObject({ committed: false, diagnostics: [{ code: 'GSS1206' }] });
});

it.each([
  '.a { padding: -1px; padding: 1px; }',
  '.a { padding: 1px; padding: -1px; }',
  '.a { padding-left: -1px; padding-left: 1px; }',
  '.a { padding-left: 1px; padding-left: -1px; }'
])('ignores invalid declarations before duplicate validation: %s', (source) => {
  const session = compile(source);
  expect(rulesFor(session, ['a']).map((rule) => rule.value)).toEqual(['1px']);
});

it('still rejects duplicate valid padding declarations', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  expect(session.replaceStylesheet({ id: '/project/Fixed.gss', source: '.a { padding: 1px; padding: 2px; }' }))
    .toMatchObject({ committed: false, diagnostics: [{ code: 'GSS1204' }] });
});

it('retains unknown and var-based padding values for browser evaluation', () => {
  for (const value of ['-1px var(--size)', 'calc(-1px)', '-1em']) {
    const session = compile(`.a { padding: ${value}; }`);
    expect(rulesFor(session, ['a']).map((rule) => rule.value)).toEqual([value]);
  }
});

it('ignores proven invalid padding under runtime state and keeps its scope', () => {
  const session = compile('.a:hover { padding-left: 9px; padding: -1px; }');
  expect(session.finalize().manifest.rules.map((rule) => [rule.property, rule.value])).toEqual([['padding-left', '9px']]);
  expect(session.getScopeSchema('/project/Fixed.gss')!.exports.a).toBeDefined();
});

it('retains selector-list scopes even when their only declaration is invalid', () => {
  const session = compile('.a, .b { padding: -1px; }');
  expect(session.finalize().manifest.rules).toEqual([]);
  expect(Object.keys(session.getScopeSchema('/project/Fixed.gss')!.exports).sort()).toEqual(['a', 'b']);
});

it('retains invalid padding in preserved fallback and compatibility paths', () => {
  const preserved = createGssCompilerSession({ projectRoot: '/project' });
  const result = preserved.replaceStylesheet({ id: '/project/Fixed.gss', source: '.a { padding-left: 9px; padding: -1px; future-paint: red; }' });
  expect(result.module?.compilationMode).toBe('preserved');
  expect(preserved.finalize().css).toContain('padding: -1px;');
  const compatible = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: [{ safari: '6.0' }] });
  expect(compatible.replaceStylesheet({ id: '/project/Fixed.gss', source: '.a { padding-left: 9px; padding: -1px; }' }).committed).toBe(true);
  expect(compatible.finalize().manifest.rules.some((rule) => rule.property === 'padding')).toBe(true);
});

it('retains padding shorthand when a cross-scope side is unsafe or a directional alias participates', () => {
  for (const source of [
    '.a { padding: 1px; } .b { padding-left: -2px; }',
    '.a { padding: 1px; } .b { padding-left: 2px; } .c { padding-inline-start: 3px; }'
  ]) expect(compile(source).finalize().manifest.rules.some((rule) => rule.property === 'padding')).toBe(true);
});

it('retains padding shorthand during preserved fallback', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const result = session.replaceStylesheet({ id: '/project/Fixed.gss', source: '.a { padding: 1px; } .b { padding-left: 2px; future-paint: red; }' });
  expect(result.module?.compilationMode).toBe('preserved');
  expect(session.finalize().css).toContain('padding: 1px;');
});

it('expands margin and padding independently without losing importance', () => {
  const session = compile('.a { margin: -1px; margin-left: 2px; padding: 1px !important; padding-left: 2px; }');
  const rules = rulesFor(session, ['a']);
  expect(rules.find((rule) => rule.property === 'margin-top')?.value).toBe('-1px');
  expect(rules.find((rule) => rule.property === 'margin-left')?.value).toBe('2px');
  expect(rules.find((rule) => rule.property === 'padding-left')).toMatchObject({ value: '1px', important: true });
});

it.each([
  ['1px', ['1px', '1px', '1px', '1px']],
  ['1px 2px', ['1px', '2px', '1px', '2px']],
  ['1px 2px 3px', ['1px', '2px', '3px', '2px']],
  ['1px 2px 3px 4px', ['1px', '2px', '3px', '4px']],
  ['-1px', ['-1px', '-1px', '-1px', '-1px']]
])('expands safe inset %s and keeps its source and later side', (value, expected) => {
  const source = `.a { inset: ${value}; left: 9px; }`;
  const rules = rulesFor(compile(source), ['a']);
  for (const [index, side] of ['top', 'right', 'bottom', 'left'].entries()) {
    const rule = rules.find((entry) => entry.property === side)!;
    expect(rule.value).toBe(side === 'left' ? '9px' : expected[index]);
    expect(rule.origins[0]?.range.start).toBe(source.indexOf(side === 'left' ? 'left:' : 'inset:'));
  }
});

it.each([false, true])('keeps inset ordering across simple scopes (%s)', (reverse) => {
  const authored = ['.a { inset: 1px 2px; }', '.b { left: 9px; }'];
  const session = compile((reverse ? authored.reverse() : authored).join(' '));
  expect(rulesFor(session, ['a'])).toHaveLength(4);
  expect(session.finalize().manifest.rules.filter((rule) => rule.property === 'left').map((rule) => rule.value))
    .toEqual(reverse ? ['9px', '2px'] : ['2px', '9px']);
});

it.each(['var(--space)', 'auto', 'calc(1px + 2px)', '1.px'])('retains unsupported inset shorthand %s', (value) => {
  const session = compile(`.a { inset: ${value}; left: 2px; }`);
  expect(rulesFor(session, ['a']).map((rule) => rule.property)).toEqual(['inset', 'left']);
});

it('retains source order and importance for inset side overrides', () => {
  const later = compile('.a { left: 9px; inset: 1px; }');
  expect(rulesFor(later, ['a']).find((rule) => rule.property === 'left')?.value).toBe('1px');
  const important = compile('.a { inset: 1px !important; left: 9px; }');
  expect(rulesFor(important, ['a']).find((rule) => rule.property === 'left')).toMatchObject({ value: '1px', important: true });
});

it('preserves selector-list membership for cross-scope inset expansion', () => {
  const session = compile('.a, .b { inset: 1px; } .c { left: 9px; }');
  const a = rulesFor(session, ['a']);
  const b = rulesFor(session, ['b']);
  expect(a).toHaveLength(4);
  expect(b.map((rule) => rule.className)).toEqual(a.map((rule) => rule.className));
  expect(rulesFor(session, ['c']).map((rule) => [rule.property, rule.value])).toEqual([['left', '9px']]);
});

it('retains inset when a logical alias participates across scopes', () => {
  const session = compile('.a { inset: 1px; } .b { left: 9px; } .c { inset-inline-start: 3px; }');
  expect(session.finalize().manifest.rules.some((rule) => rule.property === 'inset')).toBe(true);
});

it('retains inset logical conflict diagnosis and last-known-good state', () => {
  const session = compile('.a { color: red; }');
  const before = session.finalize();
  expect(session.replaceStylesheet({ id: '/project/Fixed.gss', source: '.a { inset: 1px; inset-inline-start: 2px; }' }))
    .toMatchObject({ committed: false, diagnostics: [{ code: 'GSS1206' }] });
  expect(session.finalize()).toEqual(before);
});

it('keeps inset on preserved and compatibility paths', () => {
  const preserved = createGssCompilerSession({ projectRoot: '/project' });
  const result = preserved.replaceStylesheet({ id: '/project/Fixed.gss', source: '.a { inset: 1px; left: 9px; future-paint: red; }' });
  expect(result.module?.compilationMode).toBe('preserved');
  expect(preserved.finalize().css).toContain('inset: 1px;');
  const compatibility = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: [{ safari: '6.0' }] });
  const compatible = compatibility.replaceStylesheet({ id: '/project/Fixed.gss', source: '.a { inset: 1px; left: 9px; }' });
  expect(compatible).toMatchObject({ committed: true, module: { compilationMode: 'preserved' } });
  const css = compatibility.finalize().css;
  expect(css).toContain('left: 1px;');
  expect(css.indexOf('left: 1px;')).toBeLessThan(css.indexOf('left: 9px;'));
});

it('preserves authored shorthand precedence when var cannot be expanded', () => {
  const laterShorthand = compile('.a { margin-left: 9px; margin: var(--space); }');
  expect(rulesFor(laterShorthand, ['a']).map((rule) => [rule.property, rule.value])).toEqual([['margin', 'var(--space)']]);
  const laterLonghand = compile('.a { margin: var(--space); margin-left: 9px; }');
  expect(rulesFor(laterLonghand, ['a']).map((rule) => rule.property)).toEqual(['margin', 'margin-left']);
  const important = compile('.a { margin-left: 9px !important; margin: var(--space); }');
  expect(rulesFor(important, ['a'])).toEqual(expect.arrayContaining([
    expect.objectContaining({ property: 'margin-left', value: '9px', important: true })
  ]));
});

it('keeps authored shorthand in preserved fallback', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const result = session.replaceStylesheet({ id: '/project/Fixed.gss', source: '.a { margin: 1px; margin-left: 2px; future-paint: red; }' });
  expect(result.module?.compilationMode).toBe('preserved');
  expect(session.finalize().css).toContain('margin: 1px;');
  expect(session.finalize().css).toContain('margin-left: 2px;');
});

it('keeps cross-scope margin authored in preserved fallback', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const result = session.replaceStylesheet({ id: '/project/Fixed.gss', source: '.a { margin: 1px; } .b { margin-left: 9px; future-paint: red; }' });
  expect(result.module?.compilationMode).toBe('preserved');
  expect(session.finalize().css).toContain('margin: 1px;');
  expect(session.finalize().css).toContain('margin-left: 9px;');
});

it('keeps shorthand on runtime-selector and compatibility paths', () => {
  const state = compile('.a:hover { margin: 1px; margin-left: 2px; }');
  expect(state.finalize().manifest.rules.map((rule) => rule.property)).toEqual(['margin', 'margin-left']);
  const compatibility = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: [{ safari: '6.0' }] });
  expect(compatibility.replaceStylesheet({ id: '/project/Fixed.gss', source: '.a { margin: 1px; margin-left: 2px; }' }).committed).toBe(true);
  expect(compatibility.finalize().manifest.rules.map((rule) => rule.property)).toEqual(['margin', 'margin-left']);
});

it('preserves importance when safe margin and longhand overlap', () => {
  const session = compile('.a { margin: 1px !important; margin-left: 2px; }');
  const left = rulesFor(session, ['a']).find((rule) => rule.property === 'margin-left')!;
  expect(left).toMatchObject({ value: '1px', important: true });
});

it('never leaks a late repeated red occurrence into an early-only export', () => {
  const session = compile('.early { color: red; } .middle { color: blue; } .late { color: red; }');
  expect(session.finalize().manifest.rules.map((rule) => rule.value)).toEqual(['red', 'blue', 'red']);
  expect(rulesFor(session, ['early'])).toHaveLength(1);
  expect(rulesFor(session, ['late'])).toHaveLength(1);
  expect(rulesFor(session, ['early'])[0]!.className).not.toBe(rulesFor(session, ['late'])[0]!.className);
});

it.each([false, true])('keeps runtime and descendant comma branches independent (%s)', (reverse) => {
  const branches = ['.root > .item', '.root .item'];
  const source = '.root > .item { margin-left: 2px; } ' + (reverse ? branches.reverse() : branches).join(',') + ' { margin: 1px; }';
  const session = compile(source);
  // A later equivalent child shorthand wins all effects; the descendant branch
  // remains an independent fallback instead of replacing the child occurrence.
  expect(rulesFor(session, ['root', 'item']).map((rule) => rule.property)).toEqual(['margin', 'margin']);
});

it('converges new fixed-rank contexts after real replace/reorder/add/delete/invalidate and relocation', () => {
  const sources = [
    '.a { color: red; } .b { color: blue; }',
    '.b { color: blue; } .a { color: red; }',
    '.early { color: red; } .middle { color: blue; } .late { color: red; }',
    '.root > .item { color: blue; } .b { color: green; } .root .item { color: red; }',
    '.root .item { margin-left: 2px; } .item { margin: 1px; }',
    '.a:where(:checked):where(:disabled) { color: blue; } .a:where(:checked), .a:focus { color: red; }',
    '.a::before, .a::after { color: red; } .b::before { color: blue; }',
    '.a { color: red; }', ''
  ];
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const live = new Map<string, string>();
  const view = (compiler: typeof session, root: string) => {
    const { generation: _generation, ...snapshot } = compiler.finalize(); void _generation;
    return { snapshot, schemas: [...live.keys()].sort().map((id) => compiler.getScopeSchema(`${root}/${id}`)) };
  };
  const assertClean = () => {
    for (const root of ['/project', '/relocated']) for (const reverse of [false, true]) {
      const clean = createGssCompilerSession({ projectRoot: root });
      const entries = [...live];
      for (const [id, source] of reverse ? entries.reverse() : entries) expect(clean.replaceStylesheet({ id: `${root}/${id}`, source }).committed).toBe(true);
      expect(view(session, '/project')).toEqual(view(clean, root));
    }
  };
  for (const source of sources) {
    for (const id of ['A.gss', 'B.gss']) {
      expect(session.replaceStylesheet({ id: `/project/${id}`, source }).committed).toBe(true);
      live.set(id, source); assertClean();
    }
    session.invalidate('/project/B.gss'); live.delete('B.gss'); assertClean();
  }
  session.invalidate('/project/A.gss'); live.clear(); assertClean();
});

const forwardBackground = '.a:hover{background-color:red}.a[aria-pressed="true"]{background-color:blue}';
const reverseBackground = '.b[aria-pressed="true"]{background-color:blue}.b:hover{background-color:red}';
it.each([
  ['01-nonconflicting', '.a{color:red}.b{background-color:blue}', ['blue']],
  ['02-base', '.a{background-color:red}.b{background-color:blue}', ['red','blue']],
  ['03-same-hover', '.a:hover{background-color:red}.b:hover{background-color:blue}', ['red','blue']],
  ['04-different-predicates', '.a:hover{background-color:red}.b:focus{background-color:blue}', ['red','blue']],
  ['05-ranked-unranked-hover', forwardBackground + '.b:hover{background-color:green}', ['red','blue','green']],
  ['06-ranked-unranked-focus', forwardBackground + '.b:focus{background-color:green}', ['red','blue','green']],
  ['07-opposing-a-b', forwardBackground + reverseBackground, ['red','blue','blue','red']],
  ['08-opposing-b-a', reverseBackground + forwardBackground, ['blue','red','red','blue']],
  ['09-interleaved', '.a:hover{background-color:red}.b:hover{background-color:green}.b:focus{background-color:purple}.a[aria-pressed="true"]{background-color:blue}', ['red','green','purple','blue']],
  ['10-important', forwardBackground.replaceAll('}', '!important}') + '.b:focus{background-color:green}', ['green','red','blue']],
  ['11-specificity', forwardBackground + '.b{background-color:green}', ['red','blue','green']],
  ['12-duplicate-scope', forwardBackground, ['red','blue']]
] as const)('public session orders the prior composition matrix: %s', (_name, source, expected) => {
  const session = compile(source);
  expect(session.finalize().manifest.preservedRules).toEqual([]);
  expect(session.finalize().report).toMatchObject({atomicModules:1,preservedModules:0});
  expect(session.finalize().manifest.rules.filter((rule) => rule.property === 'background-color').map((rule) => rule.value)).toEqual(expected);
  expect(session.getScopeSchema('/project/Fixed.gss')!.exports.a).toBeDefined();
});

it('shares identical semantics and rank only after original comma membership is retained', () => {
  const session = compile('.a,.b{color:red}.c{color:blue}');
  expect(rulesFor(session,['a'])[0]!.className).toBe(rulesFor(session,['b'])[0]!.className);
  expect(session.finalize().manifest.rules).toHaveLength(2);
  expect(session.finalize().manifest.rules.map((rule) => rule.value)).toEqual(['red','blue']);
});

it.each([false,true])('preserves ancestor predicate branch bindings (%s)', (reverse) => {
  const branches = ['.root:where(:checked) .a', '.root:focus .a'];
  const source = '.root:where(:checked):where(:disabled) .a{color:blue}' + (reverse ? branches.reverse() : branches).join(',') + '{color:red}';
  const session = compile(source);
  expect(rulesFor(session,['root','a']).filter((rule) => !rule.selector.includes(':focus')).map((rule) => rule.value)).toEqual(['red','blue']);
});

it('numbers each property independently while emitting all equal-height logical writes before physical writes', () => {
  const session = compile('.a{margin-inline-start:1px}.b{margin-inline-start:2px}.c{margin-left:3px}');
  const rules = session.finalize().manifest.rules;
  expect(rules.map(({ property, value }) => [property, value])).toEqual([
    ['margin-inline-start', '1px'], ['margin-inline-start', '2px'], ['margin-left', '3px']
  ]);
  expect(rules.map(({ className }) => className.match(/--rank_([0-9]+)/)?.[1])).toEqual(['1', '2', '1']);
  expect(rules.map(({ className }) => className.match(/--order_([0-9]+)/)?.[1])).toEqual(['1', '2', '3']);
});

it.each([false, true])('keeps unresolved shorthand order separate from per-property ranks (%s)', (reverse) => {
  const sources = ['.a{margin:var(--space)}', '.b{margin-left:9px}'];
  const session = compile((reverse ? sources.reverse() : sources).join(''));
  const rules = session.finalize().manifest.rules;
  expect(rules.map(({ property }) => property)).toEqual(reverse ? ['margin-left', 'margin'] : ['margin', 'margin-left']);
  expect(rules.map(({ className }) => className.match(/--rank_([0-9]+)/)?.[1])).toEqual(['1', '1']);
  expect(rules.map(({ className }) => className.match(/--order_([0-9]+)/)?.[1])).toEqual(['1', '2']);
});

for (const family of ['scroll-margin', 'scroll-padding']) {
  it.each([
    ['1px', ['1px', '1px', '1px', '1px']],
    ['1px 2px', ['1px', '2px', '1px', '2px']],
    ['1px 2px 3px', ['1px', '2px', '3px', '2px']],
    ['1px 2px 3px 4px', ['1px', '2px', '3px', '4px']],
    ['0 +0.0 0px', ['0', '+0.0', '0px', '+0.0']]
  ])(`expands safe ${family} %s with original declaration provenance`, (value, expected) => {
    const source = `.a{${family}:${value};${family}-left:9px}`;
    const rules = rulesFor(compile(source), ['a']);
    expect(rules).toHaveLength(4);
    for (const [index, side] of ['top', 'right', 'bottom', 'left'].entries()) {
      const rule = rules.find(({ property }) => property === `${family}-${side}`)!;
      expect(rule.value).toBe(side === 'left' ? '9px' : expected[index]);
      expect(rule.origins[0]?.range.start).toBe(source.indexOf(side === 'left' ? `${family}-left:` : `${family}:`));
    }
  });

  it.each([false, true])(`preserves ${family} declaration order and important winners (%s)`, (reverse) => {
    for (const important of ['none', 'short', 'long']) {
      const short = `${family}:1px 2px${important === 'short' ? '!important' : ''}`;
      const long = `${family}-left:9px${important === 'long' ? '!important' : ''}`;
      const session = compile(`.a{${(reverse ? [long, short] : [short, long]).join(';')}}`);
      const rules = rulesFor(session, ['a']);
      expect(rules).toHaveLength(4);
      expect(rules.find(({ property }) => property === `${family}-left`)).toMatchObject({
        value: important === 'short' || (important === 'none' && reverse) ? '2px' : '9px',
        important: important !== 'none'
      });
    }
  });

  it.each([false, true])(`preserves ${family} cross-scope ordering, selector-list membership and recovery (%s)`, (reverse) => {
    const authored = [`.a,.b{${family}:1px 2px}`, `.c{${family}-left:9px}`];
    const source = (reverse ? authored.reverse() : authored).join('');
    const session = compile(source);
    expect(rulesFor(session, ['a'])).toHaveLength(4);
    expect(rulesFor(session, ['b']).map(({ className }) => className)).toEqual(rulesFor(session, ['a']).map(({ className }) => className));
    expect(rulesFor(session, ['c']).map(({ property, value }) => [property, value])).toEqual([[`${family}-left`, '9px']]);
    expect(session.finalize().manifest.rules.filter(({ property }) => property === `${family}-left`).map(({ value }) => value))
      .toEqual(reverse ? ['9px', '2px'] : ['2px', '9px']);
    const before = session.finalize();
    expect(session.replaceStylesheet({ id: '/project/Fixed.gss', source: `.a{${family}:1px;${family}:2px}` }))
      .toMatchObject({ committed: false, diagnostics: [{ code: 'GSS1204' }] });
    expect(session.finalize()).toEqual(before);
    expect(session.replaceStylesheet({ id: '/project/Fixed.gss', source }).committed).toBe(true);
    expect(session.finalize().css).toBe(before.css);
    expect(session.finalize().sourceMap).toEqual(before.sourceMap);
  });

  it.each(['var(--space)', 'calc(1px + 2px)', '1%', 'auto', '1.px', '1px 2px 3px 4px 5px'])(`keeps unsupported ${family} %s on its existing shorthand path`, (value) => {
    expect(rulesFor(compile(`.a{${family}:${value};${family}-left:9px}`), ['a']).map(({ property }) => property))
      .toEqual([family, `${family}-left`]);
  });

  it(`keeps ${family} alias competition and non-pure rules outside expansion`, () => {
    for (const source of [
      `.a{${family}:1px;${family}-left:9px}.b{${family}-inline-start:3px}`,
      `.a{${family}:1px;${family}-left:9px;${family}-inline-start:3px}`,
      `.a:hover{${family}:1px;${family}-left:9px}`
    ]) expect(compile(source).finalize().manifest.rules.some(({ property }) => property === family)).toBe(true);
    for (const source of [
      `.a{${family}:1px}.root .b{${family}-left:9px}`,
      `.a{${family}:1px}.b{${family}-left:var(--space)}`
    ]) expect(compile(source).finalize().manifest.rules.some(({ property }) => property === family)).toBe(true);
  });

  it(`keeps ${family} compatibility and whole-module preserved fallback intact`, () => {
    const source = `.a{${family}:1px;${family}-left:9px}`;
    const compatibility = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: [{ chrome: '120.0' }] });
    expect(compatibility.replaceStylesheet({ id: '/project/Fixed.gss', source }).committed).toBe(true);
    expect(compatibility.finalize().manifest.rules.some(({ property }) => property === family)).toBe(true);
    const preserved = createGssCompilerSession({ projectRoot: '/project' });
    expect(preserved.replaceStylesheet({ id: '/project/Fixed.gss', source: `${source}.unknown{future-paint:1}` }))
      .toMatchObject({ committed: true, module: { compilationMode: 'preserved' }, diagnostics: [{ code: 'GSS1104' }] });
    expect(preserved.finalize().manifest.rules).toHaveLength(0);
    expect(preserved.finalize().report.preservedModules).toBe(1);
    expect(preserved.finalize().css).toContain(`${family}: 1px;`);
    expect(preserved.finalize().css).toContain(`${family}-left: 9px;`);
  });
}

it('allows negative scroll-margin but leaves negative scroll-padding on the existing path', () => {
  const margin = rulesFor(compile('.a{scroll-margin:-1px -2px;scroll-margin-left:9px}'), ['a']);
  expect(margin.find(({ property }) => property === 'scroll-margin-top')?.value).toBe('-1px');
  expect(margin.find(({ property }) => property === 'scroll-margin-right')?.value).toBe('-2px');
  expect(margin.find(({ property }) => property === 'scroll-margin-left')?.value).toBe('9px');
  const padding = rulesFor(compile('.a{scroll-padding:-1px;scroll-padding-left:9px}'), ['a']);
  expect(padding.map(({ property }) => property)).toEqual(['scroll-padding', 'scroll-padding-left']);
});

for (const family of ['margin', 'padding', 'inset', 'scroll-margin', 'scroll-padding']) for (const axis of ['inline', 'block']) {
  const shorthand = `${family}-${axis}`;
  it.each(['1px', '1px 2px', '0 +0.0'])(`expands ${shorthand} %s into logical sides without physical mapping`, (value) => {
    const source = `.a{${shorthand}:${value};${shorthand}-start:9px}`;
    const rules = rulesFor(compile(source), ['a']);
    expect(rules).toHaveLength(2);
    expect(rules.find(({ property }) => property === `${shorthand}-start`)).toMatchObject({ value: '9px', origins: [{ range: { start: source.indexOf(`${shorthand}-start:`) } }] });
    expect(rules.find(({ property }) => property === `${shorthand}-end`)).toMatchObject({ value: value.split(' ')[1] ?? value, origins: [{ range: { start: source.indexOf(`${shorthand}:`) } }] });
  });

  it.each([false, true])(`preserves ${shorthand} source order and importance (%s)`, (reverse) => {
    for (const important of ['none', 'short', 'long']) {
      const declarations = [`${shorthand}:1px 2px${important === 'short' ? '!important' : ''}`, `${shorthand}-start:9px${important === 'long' ? '!important' : ''}`];
      const rules = rulesFor(compile(`.a{${(reverse ? declarations.reverse() : declarations).join(';')}}`), ['a']);
      expect(rules).toHaveLength(2);
      expect(rules.find(({ property }) => property === `${shorthand}-start`)).toMatchObject({
        value: important === 'short' || (important === 'none' && reverse) ? '1px' : '9px', important: important !== 'none'
      });
    }
  });

  it.each([false, true])(`preserves ${shorthand} cross-scope membership, order and recovery (%s)`, (reverse) => {
    const authored = [`.a,.b{${shorthand}:1px 2px}`, `.c{${shorthand}-start:9px}`];
    const source = (reverse ? authored.reverse() : authored).join('');
    const session = compile(source);
    expect(rulesFor(session, ['a'])).toHaveLength(2);
    expect(rulesFor(session, ['b'])).toEqual(rulesFor(session, ['a']));
    expect(rulesFor(session, ['c']).map(({ property, value }) => [property, value])).toEqual([[`${shorthand}-start`, '9px']]);
    expect(session.finalize().manifest.rules.filter(({ property }) => property === `${shorthand}-start`).map(({ value }) => value)).toEqual(reverse ? ['9px', '1px'] : ['1px', '9px']);
    const before = session.finalize();
    expect(session.replaceStylesheet({ id: '/project/Fixed.gss', source: `.a{${shorthand}:1px;${shorthand}:2px}` })).toMatchObject({ committed: false, diagnostics: [{ code: 'GSS1204' }] });
    expect(session.finalize()).toEqual(before);
    expect(session.replaceStylesheet({ id: '/project/Fixed.gss', source }).committed).toBe(true);
    expect(session.finalize().css).toBe(before.css);
    expect(session.finalize().sourceMap).toEqual(before.sourceMap);
  });

  it(`keeps unsafe ${shorthand} values and contexts on the existing path`, () => {
    for (const value of ['var(--space)', 'calc(1px + 2px)', 'auto', '1%', '1px 2px 3px', 'inherit']) {
      expect(compile(`.a{${shorthand}:${value};${shorthand}-start:9px}`).finalize().manifest.rules.some(({ property }) => property === shorthand)).toBe(true);
    }
    for (const source of [
      `.a{${shorthand}:1px}`,
      `.a:hover{${shorthand}:1px;${shorthand}-start:9px}`,
      `.a{${shorthand}:1px}.root .b{${shorthand}-start:9px}`,
      `.a{${shorthand}:1px}.b{${shorthand}-start:var(--space)}`,
      `.a{${shorthand}:1px;${shorthand}-start:9px}.b{${family === 'inset' ? 'left' : `${family}-left`}:3px}`
    ]) expect(compile(source).finalize().manifest.rules.some(({ property }) => property === shorthand)).toBe(true);
    const source = `.a{${shorthand}:1px;${shorthand}-start:9px}`;
    const compatibility = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: [{ chrome: '120.0' }] });
    expect(compatibility.replaceStylesheet({ id: '/project/Fixed.gss', source }).committed).toBe(true);
    expect(compatibility.finalize().manifest.rules.some(({ property }) => property === shorthand)).toBe(true);
    const preserved = createGssCompilerSession({ projectRoot: '/project' });
    expect(preserved.replaceStylesheet({ id: '/project/Fixed.gss', source: `${source}.unknown{future-paint:1}` })).toMatchObject({ committed: true, module: { compilationMode: 'preserved' }, diagnostics: [{ code: 'GSS1104' }] });
    expect(preserved.finalize().manifest.rules).toHaveLength(0);
    expect(preserved.finalize().css).toContain(`${shorthand}: 1px;`);
  });
}

it('expands signed logical margins and insets while preserving padding negative-value boundaries', () => {
  for (const family of ['margin', 'inset', 'scroll-margin']) {
    expect(rulesFor(compile(`.a{${family}-inline:-1px -2px;${family}-inline-start:9px}`), ['a']).find(({ property }) => property === `${family}-inline-end`)?.value).toBe('-2px');
  }
  expect(rulesFor(compile('.a{padding-inline-start:9px;padding-inline:-1px}'), ['a']).map(({ property, value }) => [property, value])).toEqual([['padding-inline-start', '9px']]);
  for (const family of ['padding', 'scroll-padding']) {
    expect(compile(`.a{${family}-inline:-0;${family}-inline-start:9px}`).finalize().manifest.rules.some(({ property }) => property === `${family}-inline`)).toBe(true);
  }
  expect(compile('.a{scroll-padding-inline:-1px;scroll-padding-inline-start:9px}').finalize().manifest.rules.some(({ property }) => property === 'scroll-padding-inline')).toBe(true);
});

it('keeps inline and block expansions independent and supports end-side competitors', () => {
  for (const family of ['margin', 'padding', 'inset', 'scroll-margin', 'scroll-padding']) {
    const session = compile(`.a{${family}-inline:1px 2px;${family}-inline-end:9px;${family}-block:3px 4px;${family}-block-end:8px}`);
    expect(Object.fromEntries(rulesFor(session, ['a']).map(({ property, value }) => [property, value]))).toEqual({
      [`${family}-inline-start`]: '1px', [`${family}-inline-end`]: '9px', [`${family}-block-start`]: '3px', [`${family}-block-end`]: '8px'
    });
  }
});

it('keeps same-rule scroll logical/physical alias competition on the original shorthand path', () => {
  for (const family of ['scroll-margin', 'scroll-padding']) for (const axis of ['inline', 'block']) {
    const shorthand = `${family}-${axis}`;
    const session = compile(`.a{${shorthand}:1px 2px;${shorthand}-start:9px;${family}-left:3px}`);
    expect(session.finalize().manifest.rules.some(({ property }) => property === shorthand)).toBe(true);
  }
});
