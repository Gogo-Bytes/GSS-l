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

it('uses original declaration ordinals on every comma branch and retains partial shorthand winners', () => {
  for (const selectors of ['.a, .b', '.b, .a']) {
    const session = compile(`${selectors} { margin-left: 2px; margin: 1px; }`);
    for (const path of [['a'], ['b']]) expect(rulesFor(session, path).map((rule) => [rule.property, rule.value])).toEqual([['margin', '1px']]);
    const reversed = compile(`${selectors} { margin: 1px; margin-left: 2px; }`);
    for (const path of [['a'], ['b']]) expect(rulesFor(reversed, path).map((rule) => rule.property)).toEqual(['margin', 'margin-left']);
  }
  const nested = compile('.root .item { margin-left: 2px; } .item { margin: 1px; }');
  expect(rulesFor(nested, ['root', 'item']).map((rule) => rule.property)).toEqual(['margin', 'margin-left']);
  expect(rulesFor(nested, ['item']).map((rule) => rule.property)).toEqual(['margin']);
  expect(compile('.a { margin-left: 2px; } .b { margin: 1px; }').finalize().manifest.rules.map((rule) => rule.property)).toEqual(['margin-left', 'margin']);
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
