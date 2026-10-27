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

it.each(['-1px', '1px -2px', 'var(--space)', 'calc(1px + 2px)', '1.px'])('does not expand unsafe padding shorthand %s', (value) => {
  const session = compile(`.a { padding: ${value}; padding-left: 2px; }`);
  expect(rulesFor(session, ['a']).map((rule) => rule.property)).toEqual(['padding', 'padding-left']);
});

it('does not expand padding when an affected longhand is negative', () => {
  const session = compile('.a { padding: 1px; padding-left: -2px; }');
  expect(rulesFor(session, ['a']).map((rule) => rule.property)).toEqual(['padding', 'padding-left']);
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
