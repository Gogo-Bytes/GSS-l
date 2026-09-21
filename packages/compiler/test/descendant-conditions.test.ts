import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import type { ScopeNodeSchema } from '../src/index.js';
import { createGssCompilerSession } from '../src/index.js';

describe('Compiler descendant condition ownership', () => {
  it('binds an ancestor equality condition to a deeper declared target and source prefix', () => {
    const compiler = createGssCompilerSession({ projectRoot: '/project' });
    expect(compiler.replaceStylesheet({ id: '/project/Tree.gss', source: [
      '.group .panel .leaf { margin-left: 1px; }',
      '.panel[data-mode=ready] .leaf { margin-left: 9px; }'
    ].join('\n') }).committed).toBe(true);
    const panel = compiler.getScopeSchema('/project/Tree.gss')!.exports.group!.targets.panel!;
    const target = panel.targets.leaf!.selfClassName.split(' ').find((name) => name.startsWith('gss-t'));
    expect(target).toBeDefined();
    const source = panel.selfClassName.split(' ').find((name) => name.startsWith('gss-s'));
    expect(source).toBeDefined();
    expect(compiler.finalize().css).toContain(`.${source}[data-mode="ready"] .${target}`);
  });
});

// Inspect only public CSS and ScopeSchema: these assertions do not import a planner or allocator.
function compile(source: string) {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const result = session.replaceStylesheet({ id: '/project/Tree.gss', source });
  expect(result.diagnostics).toEqual([]);
  expect(result.committed).toBe(true);
  const scope = (path: string): ScopeNodeSchema => {
    let targets = session.getScopeSchema('/project/Tree.gss')!.exports;
    let node: ScopeNodeSchema | undefined;
    for (const part of path.split('.')) { node = targets[part]!; targets = node.targets; }
    return node!;
  };
  const rules = (path: string) => {
    const tokens = scope(path).selfClassName.split(' ');
    return postcss.parse(session.finalize().css).nodes.flatMap((rule) => {
      if (rule.type !== 'rule') return [];
      const selector = selectorParser().astSync(rule.selector).nodes[0]!;
      const finalClasses = selector.nodes.slice(selector.nodes.reduce((last, node, index) => node.type === 'combinator' ? index + 1 : last, 0))
        .filter((node) => node.type === 'class').map((node) => node.value);
      return finalClasses.every((name) => tokens.includes(name)) ? [rule] : [];
    });
  };
  return { session, scope, rules };
}
function declarationValues(rules: ReturnType<ReturnType<typeof compile>['rules']>, property: string) {
  return rules.flatMap((rule) => rule.nodes.flatMap((node) => node.type === 'decl' && node.prop === property ? [node.value] : []));
}
function classSpecificity(selector: string) {
  let count = 0;
  selectorParser().astSync(selector).walk((node) => {
    if (node.type === 'class' || node.type === 'attribute' || (node.type === 'pseudo' && !node.value.startsWith('::'))) count++;
  });
  return count;
}

describe('Compiler descendant condition cascade', () => {
  it('keeps the child winner when an unrelated condition is added and removed', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const source = '.x .a .b { color: red; } .x .a > .b { color: blue; }';
    for (const extra of ['.other:checked { width: 1px; }', '', '.other:checked { width: 1px; }']) {
      const result = session.replaceStylesheet({ id: '/project/Tree.gss', source: source + extra });
      expect(result.committed).toBe(true);
      expect(result.diagnostics).toEqual([]);
      const target = session.getScopeSchema('/project/Tree.gss')!.exports.x!.targets.a!.targets.b!;
      const rules: { selector: string; color: string }[] = [];
      postcss.parse(session.finalize().css).walkRules((rule) => {
        rule.walkDecls('color', (declaration) => { rules.push({ selector: rule.selector, color: declaration.value }); });
      });
      const child = rules.find((rule) => rule.color === 'blue')!;
      const descendant = rules.find((rule) => rule.color === 'red')!;
      expect(child.selector).toContain(' > ');
      expect(classSpecificity(child.selector)).toBeGreaterThanOrEqual(classSpecificity(descendant.selector));
      expect(classSpecificity(child.selector)).toBe(3);
      expect(rules.indexOf(child)).toBeGreaterThan(rules.indexOf(descendant));
      const classes: string[] = [];
      selectorParser().astSync(child.selector).walkClasses((node) => { classes.push(node.value); });
      expect(target.selfClassName.split(' ')).toContain(classes.at(-1));
    }
  });

  it.each(['.c', '.c:checked', 'input', ':checked', '[data-mode="ready"]'])('preserves the :has subject prefix and unchanged argument across unrelated-condition replacement: %s', (observation) => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const source = `.x .a .b { color: red; } .x .a .b:has(${observation}) { color: blue; }`;
    const argumentsSeen: string[] = [];
    for (const extra of ['', '.other:checked { width: 1px; }', '']) {
      expect(session.replaceStylesheet({ id: '/project/Tree.gss', source: source + extra }).committed).toBe(true);
      const selectors: string[] = [];
      postcss.parse(session.finalize().css).walkRules((rule) => {
        if (rule.selector.includes(':has(')) selectors.push(rule.selector);
      });
      expect(selectors).toHaveLength(1);
      const selector = selectorParser().astSync(selectors[0]!).nodes[0]!;
      // The argument retains its native specificity; only the three authored subject classes repeat.
      expect(selector.nodes.filter((node) => node.type === 'class')).toHaveLength(3);
      argumentsSeen.push(selectors[0]!.slice(selectors[0]!.indexOf(':has(')));
    }
    expect(new Set(argumentsSeen).size).toBe(1);
  });

  it.each([false, true])('orders a child refinement after the same descendant source state (reversed=%s)', (reverse) => {
    const source = ['.x .a:disabled .b { color: red; }', '.x .a:disabled > .b { color: blue; }'];
    const { rules } = compile((reverse ? source.reverse() : source).join('\n'));
    const target = rules('x.a.b');
    expect(target.map((rule) => classSpecificity(rule.selector))).toEqual([4, 4]);
    expect(declarationValues(target, 'color')).toEqual(['red', 'blue']);
  });

  it.each([
    [false, false], [true, false], [false, true], [true, true]
  ])('uses relation refinement only after specificity/importance (reversed=%s, important child=%s)', (reverse, importantChild) => {
    const source = [
      '.x .a:disabled .b { color: red; }',
      `.x .a > .b { color: blue${importantChild ? ' !important' : ''}; }`
    ];
    const { rules } = compile((reverse ? source.reverse() : source).join('\n'));
    const target = rules('x.a.b');
    const descendant = target.find((rule) => declarationValues([rule], 'color').includes('red'))!;
    const child = target.find((rule) => declarationValues([rule], 'color').includes('blue'))!;
    expect(classSpecificity(descendant.selector)).toBe(4);
    expect(classSpecificity(child.selector)).toBe(3);
    expect(child.nodes.some((node) => node.type === 'decl' && node.important)).toBe(importantChild);
    expect(descendant.nodes.some((node) => node.type === 'decl' && node.important)).toBe(false);
  });

  it.each([false, true])('retains the stronger ancestor rule regardless of authored order (reversed=%s)', (reverse) => {
    const source = ['.a:disabled .c { color: red; }', '.a:disabled .b .c { color: blue; }'];
    const { rules } = compile((reverse ? source.reverse() : source).join('\n'));
    expect(declarationValues(rules('a.c'), 'color')).toEqual(['red']);
    expect(declarationValues(rules('a.b.c'), 'color')).toEqual(['blue']);
    expect(classSpecificity(rules('a.b.c')[0]!.selector)).toBe(4);
  });

  it.each([false, true])('accumulates declarations on mapped structural prefixes (with current condition=%s)', (conditional) => {
    const { rules } = compile(`.b { color: black; } ${conditional ? '.b:disabled { color: red; }' : ''} .a .b .c { margin-left: 1px; }`);
    expect(declarationValues(rules('a.b'), 'color')).toEqual(conditional ? ['black', 'red'] : ['black']);
  });

  it('prunes equal-specificity winners only within the same proven runtime predicate', () => {
    const { rules } = compile([
      '.a:disabled .b .c { color: red; }',
      '.a:disabled .d .c { color: blue; }',
      '.a .b .d .c {}'
    ].join('\n'));
    expect(declarationValues(rules('a.b.d.c'), 'color')).toEqual(['blue']);
    expect(declarationValues(rules('a.b.c'), 'color')).toEqual(['red']);
  });

  it('binds repeated source names only where the remaining suffix embeds after that source', () => {
    const { rules, scope } = compile([
      '.a:disabled .b .c { color: blue; }',
      '.a .b .a .c { margin-left: 1px; }',
      '.a .b .a .b .c { margin-left: 1px; }'
    ].join('\n'));
    const sources = (path: string) => rules(path).filter((rule) => rule.selector.includes(':disabled'))
      .map((rule) => selectorParser().astSync(rule.selector).nodes[0]!.nodes[0]!.value!);
    const outer = scope('a').selfClassName.split(' ');
    const inner = scope('a.b.a').selfClassName.split(' ');
    expect(sources('a.b.a.c')).toHaveLength(1);
    expect(outer).toContain(sources('a.b.a.c')[0]);
    expect(inner).not.toContain(sources('a.b.a.c')[0]);
    expect(sources('a.b.a.b.c')).toHaveLength(2);
    expect(sources('a.b.a.b.c').some((source) => inner.includes(source))).toBe(true);
  });

  it('preserves original base/current/ancestor specificity without promoting shared atoms', () => {
    const { rules, scope } = compile([
      '.a .b .c { color: red; }',
      '.c:checked { color: blue; }',
      '.a:disabled .c { margin-left: 8px; }',
      '.other { color: red; }'
    ].join('\n'));
    const target = rules('a.b.c');
    const red = target.find((rule) => declarationValues([rule], 'color').includes('red'))!;
    const blue = target.find((rule) => declarationValues([rule], 'color').includes('blue'))!;
    expect(classSpecificity(red.selector)).toBe(3);
    expect(classSpecificity(blue.selector)).toBe(2);
    expect(scope('other').selfClassName).not.toBe(scope('a.b.c').selfClassName);
    expect(classSpecificity(rules('other')[0]!.selector)).toBe(1);
  });

  it('keeps importance and every physical shorthand effect when resolving the closed predicate set', () => {
    const { rules } = compile([
      '.a:disabled .c { margin: 1px 2px 3px 4px !important; padding: 5px 6px 7px 8px; }',
      '.a:disabled .b .c { margin-left: 9px; padding-left: 10px; }'
    ].join('\n'));
    const target = rules('a.b.c');
    expect(declarationValues(target, 'margin')).toEqual(['1px 2px 3px 4px']);
    expect(declarationValues(target, 'margin-left')).toEqual([]);
    expect(declarationValues(target, 'padding')).toEqual(['5px 6px 7px 8px']);
    expect(declarationValues(target, 'padding-left')).toEqual(['10px']);
    expect(target.flatMap((rule) => rule.nodes).some((node) => node.type === 'decl' && node.prop === 'margin' && node.important)).toBe(true);
  });

  it.each([
    '.a:disabled .c { color: red; } .a .c:checked { color: blue; }',
    '.a[data-mode=ready] .c { color: red; } .a .c:checked { color: blue; }',
    '.a:disabled .b .c { color: red; } .b:disabled .a .c { color: blue; } .a .b .a .b .c {}'
  ])('rejects incomparable equal-specificity runtime conflicts transactionally: %s', (source) => {
    const { session } = compile('.safe { color: green; }');
    const before = session.finalize();
    const replacement = session.replaceStylesheet({ id: '/project/Tree.gss', source });
    expect(replacement.committed).toBe(false);
    expect(replacement.diagnostics[0]?.reason).toBe('ambiguous-coactive-state-conflict');
    expect(session.finalize()).toEqual(before);
  });

  it('does not route a fatal condition ambiguity through preserved-property fallback', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id: '/project/Tree.gss', source:
      '.c:checked { future-paint: red; } .c:disabled { future-paint: blue; }' });
    expect(result.committed).toBe(false);
    expect(result.diagnostics[0]?.reason).toBe('ambiguous-coactive-state-conflict');
  });

  it('allows unequal specificity, importance, mutually exclusive attributes and explicit current intersections', () => {
    compile([
      '.a:disabled .c { color: red; }',
      '.a .b .c:checked { color: blue; }',
      '.a[data-mode=ready] .c { margin-left: 1px; }',
      '.a[data-mode=waiting] .c { margin-left: 2px; }',
      '.c:checked { padding-left: 1px; }',
      '.c:disabled { padding-left: 2px; }',
      '.c:checked:disabled { padding-left: 3px; }',
      '.a .c:checked { color: green !important; }'
    ].join('\n'));
  });

  it('retains condition order, named layer bands, importance and original selector specificity', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', layers: ['base', 'theme'],
      conditions: { media: ['(min-width: 10px)', '(min-width: 20px)'] } });
    const result = session.replaceStylesheet({ id: '/project/Tree.gss', source: [
      '@layer base { @media (min-width: 20px) { .a:disabled .b .c { color: red !important; } } }',
      '@layer base { @media (min-width: 10px) { .a:disabled .b .c { color: blue !important; } } }',
      '@layer theme { .a .b .c:checked { color: green !important; } }'
    ].join('\n') });
    expect(result.committed).toBe(true);
    expect(result.diagnostics).toEqual([]);
    const css = session.finalize().css;
    expect(css).toContain('@layer base, theme;');
    expect(css.indexOf('(min-width: 10px)')).toBeLessThan(css.indexOf('(min-width: 20px)'));
    const selectors: string[] = [];
    postcss.parse(css).walkRules((rule) => { selectors.push(rule.selector); });
    expect(selectors.map(classSpecificity)).toEqual([4, 4, 4]);
    expect((css.match(/!important/g) ?? []).length).toBe(3);
  });

  it('is stable across replacement history, Module registration order and project relocation', () => {
    const source = '.a:disabled .c { color: red; } .a:disabled .b .c { color: blue; } .a .b .a .c {}';
    const run = (root: string, reverse: boolean, replace: boolean) => {
      const session = createGssCompilerSession({ projectRoot: root });
      const modules = [{ id: `${root}/Tree.gss`, source }, { id: `${root}/Other.gss`, source: '.c { color: red; }' }];
      if (replace) session.replaceStylesheet({ id: modules[0]!.id, source: '.old { color: pink; }' });
      for (const module of reverse ? modules.reverse() : modules) expect(session.replaceStylesheet(module).committed).toBe(true);
      return { css: session.finalize().css, schema: session.getScopeSchema(`${root}/Tree.gss`) };
    };
    expect(run('/project', true, true)).toEqual(run('/project', false, false));
    expect(run('/moved', true, true)).toEqual(run('/project', false, false));
  });
});
