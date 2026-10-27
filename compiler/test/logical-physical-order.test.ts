import { expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

it.each([
  ['margin-inline-start', 'margin-left'],
  ['padding-inline-start', 'padding-left'],
  ['inset-inline-start', 'left']
])('admits same-rule logical %s and physical %s longhands in either authored order', (logical, physical) => {
  for (const reverse of [false, true]) {
    const declarations = [`${logical}:1px`, `${physical}:2px`];
    if (reverse) declarations.reverse();
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id: '/project/Order.gss', source: `.a{${declarations.join(';')}}` });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
    const rules = session.finalize().manifest.rules;
    const classes = result.module!.scopeSchema.exports.a!.selfClassName.split(' ');
    expect(rules.map(({ property }) => property)).toEqual([logical, physical]);
    expect(rules.every(({ className }) => classes.includes(className))).toBe(true);
  }
});

it('keeps same-property scope order while a same-rule physical longhand remains last', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const result = session.replaceStylesheet({ id: '/project/Order.gss', source:
    '.a{margin-inline-start:1px;margin-left:2px}.b{margin-inline-start:3px}' });
  expect(result).toMatchObject({ committed: true, diagnostics: [] });
  const rules = session.finalize().manifest.rules;
  expect(rules.map(({ property, value }) => [property, value])).toEqual([
    ['margin-inline-start', '1px'], ['margin-inline-start', '3px'], ['margin-left', '2px']
  ]);
  const { a, b } = result.module!.scopeSchema.exports;
  expect(a!.selfClassName.split(' ')).toEqual(expect.arrayContaining([rules[0]!.className, rules[2]!.className]));
  expect(b!.selfClassName.split(' ')).toContain(rules[1]!.className);
});

it('preserves importance on both same-rule directional longhands', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const result = session.replaceStylesheet({ id: '/project/Order.gss', source:
    '.a{margin-inline-start:1px!important;margin-left:2px}' });
  expect(result).toMatchObject({ committed: true, diagnostics: [] });
  const rules = session.finalize().manifest.rules;
  expect(rules.map(({ property, important }) => [property, important])).toEqual([
    ['margin-inline-start', true], ['margin-left', false]
  ]);
  expect(session.finalize().css).toContain('margin-inline-start: 1px !important;');
});

it.each([
  ['.root .item{margin-left:2px}', '.item{margin-inline-start:1px}', ['margin-inline-start', 'margin-left']],
  ['.root .item{margin-inline-start:1px}', '.item{margin-left:2px}', ['margin-left', 'margin-inline-start']],
  ['.root .item{padding-left:2px}', '.item{padding-inline-start:1px}', ['padding-inline-start', 'padding-left']],
  ['.root .item{padding-inline-start:1px}', '.item{padding-left:2px}', ['padding-left', 'padding-inline-start']],
  ['.root .item{left:2px}', '.item{inset-inline-start:1px}', ['inset-inline-start', 'left']],
  ['.root .item{inset-inline-start:1px}', '.item{left:2px}', ['left', 'inset-inline-start']]
] as const)('admits accumulated longhands and preserves ownership: %s', (strong, weak, expected) => {
  for (const reverse of [false, true]) {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id: '/project/Order.gss', source: reverse ? weak + strong : strong + weak });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
    const classes = result.module!.scopeSchema.exports.root!.targets.item!.selfClassName.split(' ');
    const rules = session.finalize().manifest.rules.filter(({ className }) => classes.includes(className));
    expect(rules.map(({ property }) => property)).toEqual(expected);
  }
});

it('retains existing handling for a shorthand with a runtime variable', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const result = session.replaceStylesheet({ id: '/project/Order.gss', source: '.a{margin:var(--space)}' });
  expect(result).toMatchObject({ committed: true, diagnostics: [], module: { compilationMode: 'atomic' } });
  expect(session.finalize().manifest.rules.map(({ property, value }) => [property, value]))
    .toEqual([['margin', 'var(--space)']]);
});

it('keeps the last good snapshot when the new longhand pair would enter preserved mode', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const id = '/project/Order.gss';
  expect(session.replaceStylesheet({ id, source: '.a{color:red}' }).committed).toBe(true);
  const before = session.finalize();
  const result = session.replaceStylesheet({ id, source:
    '.a{margin-left:2px;margin-inline-start:1px;future-paint:1}' });
  expect(result).toMatchObject({ committed: false, diagnostics: [{ code: 'GSS1206' }] });
  expect(session.finalize()).toEqual(before);
});

it('orders admitted singleton exports by fixed logical-first physical-last policy', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  expect(session.replaceStylesheet({ id: '/project/Order.gss', source: '.b{margin-left:2px}.c{margin-inline-start:1px}' })).toMatchObject({ committed: true, diagnostics: [] });
  const rules = session.finalize().manifest.rules;
  const schema = session.getScopeSchema('/project/Order.gss')!;
  expect(rules.map(({ property, value }) => [property, value])).toEqual([
    ['margin-inline-start', '1px'], ['margin-left', '2px']
  ]);
  expect(rules[1]!.className).toBe(schema.exports.b!.selfClassName);
  expect(rules[0]!.className).toBe(schema.exports.c!.selfClassName);
  expect(rules.map(({ className }) => className)).toEqual([
    expect.stringContaining('--rank_1'), expect.stringContaining('--rank_2')
  ]);
});

const sides = ['top', 'right', 'bottom', 'left'];
const families = ['margin', 'padding', 'inset', 'scroll-margin', 'scroll-padding'];
const directionalPairs = families.flatMap((family) => {
  const physical = [family, ...sides.map((side) => family === 'inset' ? side : `${family}-${side}`)];
  const logical = ['inline', 'block'].flatMap((axis) => [
    `${family}-${axis}`, `${family}-${axis}-start`, `${family}-${axis}-end`
  ]);
  return [
    ...physical.map((property) => [property, logical[0]!] as const),
    ...logical.map((property) => [property, physical[0]!] as const)
  ];
});

it.each(directionalPairs)('orders %s with potentially overlapping %s without depending on family population', (property, competitor) => {
  for (const count of [2, 3, 4]) for (const reverse of [false, true]) {
    const declarations = Array.from({ length: count }, (_, index) => ({
      name: `scope${index}`, property: index % 2 === 0 ? property : competitor, value: `${index + 1}px`
    }));
    if (reverse) declarations.reverse();
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const source = declarations.map(({ name, property, value }) => `.${name}{${property}:${value}}`).join('');
    expect(session.replaceStylesheet({ id: '/project/Order.gss', source })).toMatchObject({ committed: true, diagnostics: [] });
    const rules = session.finalize().manifest.rules;
    // Explicit GSS policy oracle: stable authored order only within each property kind.
    const expected = [...declarations].sort((a, b) => Number(!/-inline|-block/.test(a.property)) - Number(!/-inline|-block/.test(b.property)));
    expect(rules.map(({ property, value }) => [property, value])).toEqual(expected.map(({ property, value }) => [property, value]));
    const schema = session.getScopeSchema('/project/Order.gss')!;
    expected.forEach(({ name }, index) => expect(schema.exports[name]!.selfClassName).toBe(rules[index]!.className));
  }
});

function compile(source: string) {
  const session = createGssCompilerSession({ projectRoot: '/project', layers: ['a', 'b'], conditions: { media: ['(min-width:1px)'] } });
  expect(session.replaceStylesheet({ id: '/project/Order.gss', source })).toMatchObject({ committed: true, diagnostics: [] });
  return session;
}
function targetRules(session: ReturnType<typeof compile>, path = ['root', 'item']) {
  let node = { selfClassName: '', targets: session.getScopeSchema('/project/Order.gss')!.exports };
  for (const part of path) node = node.targets[part]!;
  return session.finalize().manifest.rules.filter((rule) => node.selfClassName.split(' ').includes(rule.className));
}

it.each([
  ['nested-scroll', '.root .item{scroll-margin-left:2px}', '.item{scroll-margin-inline-start:1px}'],
  ['nested-vertical', '.root .item{margin-top:2px}', '.item{margin-inline-start:1px}'],
  ['strict-child', '.root > .item{margin-left:2px}', '.root .item{margin-inline-start:1px}']
])('preserves proved priority across potential overlap: %s in both authored orders', (_name, strong, weak) => {
  for (const reverse of [false, true]) {
    const session = compile((reverse ? [weak, strong] : [strong, weak]).join(''));
    expect(targetRules(session).map((rule) => rule.value)).toEqual(['1px', '2px']);
  }
});

it.each(families)('extends only proved ownership/structural order in %s', (family) => {
  const physical = family === 'inset' ? 'top' : `${family}-top`;
  for (const relation of [' ', ' > ']) for (const logical of [`${family}-inline-start`, `${family}-inline`]) {
    const strong = `.root${relation}.item{${physical}:2px}`;
    const weak = `.item{${logical}:1px}`;
    for (const reverse of [false, true]) {
      const session = compile(reverse ? weak + strong : strong + weak);
      expect(targetRules(session).map((rule) => rule.value)).toEqual(['1px', '2px']);
      if (relation === ' ') expect(targetRules(session, ['item']).map((rule) => rule.value)).toEqual(['1px']);
    }
  }
});

it('keeps disjoint physical sides, logical axes and different families unranked', () => {
  for (const source of ['.a{margin-left:2px}', '.a{margin-left:2px}.b{margin-right:1px}',
    '.a{margin-inline-start:2px}.b{margin-block-start:1px}', '.a{margin-left:2px}.b{padding-inline-start:1px}']) {
    expect(compile(source).finalize().manifest.rules.every((rule) => !rule.className.includes('--rank_'))).toBe(true);
  }
});

it('does not join importance, layer, condition or pseudo-subject bands', () => {
  for (const source of ['.a{margin-left:2px!important}.b{margin-inline-start:1px}',
    '@layer a{.a{margin-left:2px}}@layer b{.b{margin-inline-start:1px}}',
    '@media (min-width:1px){.a{margin-left:2px}}.b{margin-inline-start:1px}',
    '.a::before{margin-left:2px}.b::after{margin-inline-start:1px}']) {
    expect(compile(source).finalize().manifest.rules.every((rule) => !rule.className.includes('--rank_'))).toBe(true);
  }
});

it.each([false, true])('retains branch identity and predicate implication across potential writes (%s)', (reverse) => {
  const branches = reverse ? '.item:focus,.item:where(:checked)' : '.item:where(:checked),.item:focus';
  const session = compile(`.item:where(:checked):where(:disabled){scroll-margin-left:2px}${branches}{scroll-margin-inline-start:1px}`);
  expect(targetRules(session, ['item']).filter((rule) => !rule.selector.includes(':focus')).map((rule) => rule.value)).toEqual(['1px', '2px']);
  const pseudo = reverse ? '.item::after,.item::before' : '.item::before,.item::after';
  const separate = compile(`${pseudo}{scroll-margin-left:2px}.b::before{scroll-margin-inline-start:1px}`);
  expect(separate.finalize().manifest.rules.filter((rule) => rule.selector.endsWith('::before')).map((rule) => rule.value)).toEqual(['1px', '2px']);
  expect(separate.finalize().manifest.rules.find((rule) => rule.selector.endsWith('::after'))!.className).not.toContain('--rank_');
});

it.each([false, true])('preserves the owned-path compatibility guard instead of imposing selector tiers (%s)', (reverse) => {
  const strong = '.root .item{scroll-margin-left:2px}', state = '.item:hover{scroll-margin-inline-start:1px}';
  const session = compile(reverse ? state + strong : strong + state);
  expect(targetRules(session).map((rule) => rule.value)).toEqual(['1px', '2px']);
});

it('retains actual effects and partially surviving owned shorthands', () => {
  const session = compile('.root .item{scroll-margin:2px;scroll-margin-top:3px}.item{scroll-margin-inline:1px}');
  expect(targetRules(session).map((rule) => [rule.property, rule.value])).toEqual([
    ['scroll-margin-inline', '1px'], ['scroll-margin', '2px'], ['scroll-margin-top', '3px']
  ]);
  expect(targetRules(session, ['item']).map((rule) => rule.property)).toEqual(['scroll-margin-inline']);
});

function permutations<T>(items: T[]): T[][] {
  return items.length === 0 ? [[]] : items.flatMap((item, index) => permutations(items.filter((_, i) => i !== index)).map((rest) => [item, ...rest]));
}
it('has no cycle when ownership equivalence and strict predicate/runtime implication alternate', () => {
  // Actual admitted constraints, not arbitrary synthetic edges. All authored
  // permutations must have the same semantic height order at the bound target.
  const rules = ['.item{scroll-margin-left:1px}', '.root .item{scroll-margin-inline:2px}',
    '.root:hover .item{scroll-margin-top:3px}', '.root:hover > .item{scroll-margin-block:4px}'];
  for (const order of permutations(rules)) {
    const session = compile(order.join(''));
    expect(targetRules(session).map((rule) => rule.value)).toEqual(['1px', '2px', '3px', '4px']);
  }
});

it.each(['error', 'preserve-module'] as const)('converges actual lifecycle updates and retains logical-conflict LKG (%s)', (atomizationFallback) => {
  const session = createGssCompilerSession({ projectRoot: '/project', atomizationFallback });
  const live = new Map<string, string>();
  const view = (compiler: typeof session, root: string) => {
    const { generation: _generation, ...snapshot } = compiler.finalize(); void _generation;
    return { snapshot, schemas: [...live.keys()].sort().map((id) => compiler.getScopeSchema(`${root}/${id}`)) };
  };
  const assertClean = () => {
    for (const root of ['/project', '/relocated']) for (const reverse of [false, true]) {
      const clean = createGssCompilerSession({ projectRoot: root, atomizationFallback });
      const entries = [...live];
      for (const [id, source] of reverse ? entries.reverse() : entries) expect(clean.replaceStylesheet({ id: `${root}/${id}`, source }).committed).toBe(true);
      expect(view(session, '/project')).toEqual(view(clean, root));
    }
  };
  const sources = ['.b{margin-left:2px}.c{margin-inline-start:1px}', '.c{margin-inline-start:1px}.b{margin-left:2px}',
    '.root .item{scroll-margin-left:2px}.item{scroll-margin-inline-start:1px}',
    '.root > .item{margin-left:2px}.root .item{margin-inline-start:1px}',
    '.root .item{margin-top:2px}.item{margin-inline-start:1px}',
    '.a::before,.a::after{margin-left:2px}.b::before{margin-inline-start:1px}', '.b{margin-left:2px}', ''];
  for (const source of sources) {
    for (const id of ['A.gss', 'B.gss']) {
      expect(session.replaceStylesheet({ id: `/project/${id}`, source }).committed).toBe(true);
      live.set(id, source); assertClean();
      const before = session.finalize(), schema = session.getScopeSchema(`/project/${id}`);
      for (const rejected of ['.box{margin-left:2px;margin-inline:1px}', '.root .item{margin-left:2px}.item{margin-inline:1px}']) {
        const update = session.replaceStylesheet({ id: `/project/${id}`, source: rejected });
        expect(update).toMatchObject({ committed: false, diagnostics: [{ code: 'GSS1206', reason: 'logical-physical-property-conflict' }] });
        const clean = createGssCompilerSession({ projectRoot: '/project', atomizationFallback });
        expect(update.diagnostics).toEqual(clean.replaceStylesheet({ id: `/project/${id}`, source: rejected }).diagnostics);
        expect(session.finalize()).toEqual(before);
        expect(session.getScopeSchema(`/project/${id}`)).toEqual(schema); assertClean();
      }
    }
    session.invalidate('/project/B.gss'); live.delete('B.gss'); assertClean();
  }
  session.invalidate('/project/A.gss'); live.clear(); assertClean();
});

it.each([false, true])('keeps opaque observation and comma-branch identities in a potential-overlap family (%s)', (reverse) => {
  const branches = reverse ? '.item:has(:global(.y)),.item:has(:global(.x))' : '.item:has(:global(.x)),.item:has(:global(.y))';
  const session = compile(`${branches}{scroll-margin-left:2px}.b{scroll-margin-inline-start:1px}`);
  const observed = targetRules(session, ['item']);
  expect(observed).toHaveLength(2);
  expect(new Set(observed.map((rule) => rule.className)).size).toBe(2);
  expect(observed.every((rule) => rule.value === '2px')).toBe(true);
  expect(observed.map((rule) => rule.selector).join(' ')).toContain(':has(.x)');
  expect(observed.map((rule) => rule.selector).join(' ')).toContain(':has(.y)');
  expect(targetRules(session, ['b']).map((rule) => rule.value)).toEqual(['1px']);
});

// Owner-approved GSS policy, intentionally independent of native authored order.
const fixedPairs = [
  ['width', 'inline-size', '20px', '10px'],
  ['height', 'block-size', '20px', '10px'],
  ['min-width', 'min-inline-size', '20px', '10px'],
  ['max-height', 'max-block-size', '20px', '10px'],
  ['border-left-color', 'border-inline-start-color', 'red', 'blue'],
  ['border-top-width', 'border-block-start-width', '2px', '1px'],
  ['border-top-style', 'border-block-start-style', 'solid', 'dotted'],
  ['border-top-left-radius', 'border-start-start-radius', '8px', '4px'],
  ['overflow-x', 'overflow-inline', 'hidden', 'scroll'],
  ['overscroll-behavior-x', 'overscroll-behavior-inline', 'contain', 'none'],
  ['scroll-margin-left', 'scroll-margin-inline-start', '2px', '1px']
];
it.each(fixedPairs)('fixed policy emits physical %s after logical %s in admitted contexts', (physical, logical, pv, lv) => {
  for (const reverse of [false, true]) for (const sameBlock of [false, true]) {
    const declarations = [[physical!, pv!], [logical!, lv!]];
    if (reverse) declarations.reverse();
    const source = sameBlock ? `.item{${declarations.map(([p,v]) => `${p}:${v}`).join(';')}}` :
      declarations.map(([p,v], i) => `.scope${i}{${p}:${v}}`).join('');
    const session = compile(source);
    expect(session.finalize().manifest.rules.map(({ property }) => property)).toEqual([logical, physical]);
    expect(session.finalize().manifest.rules).toHaveLength(2);
  }
});

it.each([
  ['width', 'inline-size'], ['border-left-width', 'border-inline-start-width'],
  ['border-top-left-radius', 'border-start-start-radius'], ['overflow-x', 'overflow-inline']
])('keeps %s/%s directional writes as rank-reuse barriers', (physical, logical) => {
  const value = physical === 'overflow-x' ? 'hidden' : '2px';
  for (const property of [physical, logical]) {
    const session = compile(`.a{${property}:${value}}.b{${property}:${value}}`);
    expect(session.finalize().manifest.rules).toHaveLength(2);
    expect(session.getScopeSchema('/project/Order.gss')!.exports.a!.selfClassName)
      .not.toBe(session.getScopeSchema('/project/Order.gss')!.exports.b!.selfClassName);
  }
});

it('retains same-property authored ties and separate size/min/max effect families', () => {
  expect(compile('.a{width:20px}.b{inline-size:10px}.c{width:30px}').finalize().manifest.rules
    .map(({ property, value }) => [property, value])).toEqual([['inline-size', '10px'], ['width', '20px'], ['width', '30px']]);
  for (const source of ['.a{width:20px}.b{min-inline-size:10px}', '.a{min-width:20px}.b{max-inline-size:10px}']) {
    expect(compile(source).finalize().manifest.rules.every((rule) => !rule.className.includes('--rank_'))).toBe(true);
  }
});

it.each([false, true])('keeps proved stronger logical ownership/structural refinements above physical priority (%s)', (reverse) => {
  for (const relation of [' ', ' > ']) {
    const strong = `.root${relation}.item{inline-size:10px}`;
    const weak = '.item{width:20px}';
    expect(targetRules(compile(reverse ? weak + strong : strong + weak)).map(({ property }) => property))
      .toEqual(['width', 'inline-size']);
  }
  const strong = '.item:where(:checked):where(:disabled){scroll-margin-inline-start:1px}';
  const weak = '.item:where(:checked){scroll-margin-left:2px}';
  expect(targetRules(compile(reverse ? weak + strong : strong + weak), ['item']).map(({ property }) => property))
    .toEqual(['scroll-margin-left', 'scroll-margin-inline-start']);
});

it.each([false, true])('preserves native strength/context bands and partial shorthand survivors (%s)', (reverse) => {
  for (const [strong, weak] of [
    ['.a{inline-size:10px!important}', '.b{width:20px}'],
    ['.a:hover{inline-size:10px}', '.b{width:20px}'],
    ['@layer a{.a{inline-size:10px}}', '@layer b{.b{width:20px}}'],
    ['@media (min-width:1px){.a{inline-size:10px}}', '.b{width:20px}'],
    ['.a::before{inline-size:10px}', '.b::after{width:20px}']
  ] as const) {
    const rules = compile(reverse ? weak + strong : strong + weak).finalize().manifest.rules;
    expect(rules).toHaveLength(2);
    if (!strong.includes(':hover')) expect(rules.every((rule) => !rule.className.includes('--rank_'))).toBe(true);
    if (strong.includes('!important')) expect(rules.some((rule) => rule.property === 'inline-size' && rule.important)).toBe(true);
    if (strong.includes(':hover')) expect(rules.some((rule) => rule.property === 'inline-size' && rule.selector.endsWith(':hover'))).toBe(true);
  }
  const rules = compile('.item{border:2px solid red;border-left-color:green;border-inline-color:blue}').finalize().manifest.rules;
  expect(rules.map(({ property }) => property)).toEqual(['border-inline-color', 'border', 'border-left-color']);
});
