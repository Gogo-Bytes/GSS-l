import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { createGssCompilerSession } from '../src/index.js';

const id = '/project/Relations.gss';
function colorRules(css: string) {
  const rules: { selector: string; value: string; important: boolean }[] = [];
  postcss.parse(css).walkRules((rule) => {
    rule.walkDecls('color', (declaration) => { rules.push({ selector: rule.selector, value: declaration.value, important: Boolean(declaration.important) }); });
  });
  return rules;
}

describe('Compiler structural relation implication', () => {
  it.each(['forward', 'reverse', 'single-Module'])('keeps shared descendant effect order independent of unrelated structural planning: %s', (order) => {
    const a = { id: '/project/A.gss', source: '.a:where(:checked) { margin: 1px; } .x + .y { width: 1px; }' };
    const b = { id: '/project/B.gss', source: '.b { margin-left: 2px; } .b:where(:checked) { margin: 1px; }' };
    const modules = order === 'single-Module' ? [{ id, source: a.source + b.source }] : order === 'reverse' ? [b, a] : [a, b];
    const session = createGssCompilerSession({ projectRoot: '/project' });
    for (const module of modules) expect(session.replaceStylesheet(module).committed).toBe(true);
    const clean = session.finalize();
    const schemas = modules.map((module) => session.getScopeSchema(module.id));
    const effects: string[] = [];
    postcss.parse(clean.css).walkDecls(/^margin(?:-left)?$/, (declaration) => { effects.push(declaration.prop); });
    expect(effects).toEqual(['margin-left', 'margin']);
    for (const module of modules) {
      expect(session.replaceStylesheet({ id: module.id, source: '.temporary { color: red; }' }).committed).toBe(true);
      expect(session.replaceStylesheet(module).committed).toBe(true);
      expect(session.finalize().css).toBe(clean.css);
      expect(modules.map((entry) => session.getScopeSchema(entry.id))).toEqual(schemas);
    }
    const reversed = createGssCompilerSession({ projectRoot: '/project' });
    for (const module of [...modules].reverse()) expect(reversed.replaceStylesheet(module).committed).toBe(true);
    expect(reversed.finalize().css).toBe(clean.css);
  });

  it.each([false, true])('accepts an equal-specificity full intersection on a unique adjacent witness (reverse=%s)', (reverse) => {
    const rules = [
      '.input:where(:checked) + .label { color: red; }',
      '.input:where(:disabled) + .label { color: blue; }',
      '.input:where(:checked):where(:disabled) + .label { color: green; }'
    ];
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source: (reverse ? rules.reverse() : rules).join('\n') });
    expect(result.diagnostics).toEqual([]);
    expect(result.committed).toBe(true);
    expect(result.module!.compilationMode).toBe('atomic');
    expect(colorRules(session.finalize().css).at(-1)!.value).toBe('green');
  });

  it.each([
    '.input:checked + .label { color: red; } .input:disabled ~ .label { color: blue; }',
    '.input:checked + .label { color: red; } .input .label:has(:checked) { color: blue; }',
    '.root .input:checked ~ .label { color: red; } .root .input .label:has(.observed) { color: blue; }',
    '.input[data-mode=on] ~ .label { color: red; } .input[data-mode=off] ~ .label { color: blue; }',
    '.input:checked ~ .label { color: red; } .input:not(:checked) ~ .label { color: blue; }',
    '.input > .label { color: red; } .input + .label { color: blue; }',
    '.input:checked .label { color: red; } .input:disabled + .label { color: blue; }',
    '.input:checked > .middle ~ .label { color: red; } .input:not(:checked) > .middle ~ .label { color: blue; }',
    '.input:checked + .label { margin: 1px; } .input:disabled ~ .label { margin-left: 2px; }'
  ])('rejects incomparable coactive effects transactionally: %s', (source) => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id, source: '.input + .label { color: green; }' }).committed).toBe(true);
    const before = session.finalize();
    const schema = session.getScopeSchema(id);
    // Unknown effects must not hide ambiguity by triggering whole-Module preservation.
    for (const extra of ['', ' .unrelated { unknown-effect: 1; }']) {
      const rejected = session.replaceStylesheet({ id, source: source + extra });
      expect(rejected.committed).toBe(false);
      expect(rejected.diagnostics).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'GSS1205', phase: 'resolve' })]));
      expect(session.getScopeSchema(id)).toEqual(schema);
      expect(session.finalize()).toEqual(before);
    }
  });
  it.each([':checked', '[data-mode=ready]', ':checked:disabled', ':where(:checked)'])('retains state/attribute refinements on their real source: %s', (predicate) => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id, source: `.input${predicate} + .label { color: red; } .input ~ .label { color: blue; }` }).committed).toBe(true);
    const rules = colorRules(session.finalize().css);
    expect(rules.map(({ value }) => value)).toEqual(['blue', 'red']);
    expect(rules[1]!.selector).toContain(predicate.startsWith('[') ? '[data-mode="ready"] +' : `${predicate} +`);
    expect(session.getScopeSchema(id)!.exports.input!.selfClassName).not.toBe('');
  });

  it.each([
    '.input:checked + .label { color: red; } .input:not(:checked) + .label { color: blue; }',
    '.input[data-mode=on] > .middle + .label { color: red; } .input[data-mode=off] > .middle + .label { color: blue; }',
    '.input:checked + .label { color: red; } .input:disabled + .label { color: blue; } .input:checked:disabled + .label { color: green; }'
  ])('accepts proved unique-witness exclusions or covering intersections: %s', (source) => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source });
    expect(result.diagnostics).toEqual([]);
    expect(result.committed).toBe(true);
    expect(result.module!.compilationMode).toBe('atomic');
  });

  it.each([
    '.input + .label { color: red; } .input .label:has(:checked) { color: blue; }',
    '.input:checked:disabled + .label { color: red; } .input .label:has(:checked) { color: blue; }',
    '.root .input:checked + .label { color: red; } .root .input .label:has(:checked) { color: blue !important; }',
    '.root .input:checked + .label { color: red !important; } .root .input .label:has(:checked) { color: blue; }',
    '.input + .label { color: red; } .input .label:has(button) { color: blue; }',
    '.input:checked + .label { color: red; } .input .label:has(button) { color: blue; }',
    '.input:checked + .label { color: red; } .input .label:has(:checked) { color: red; }',
    '.input:checked + .label { color: red; } .input .label:has(:checked) { width: 3px; }',
    '.input:checked + .label { color: red; } .other:has(:checked) { color: blue; }',
    '.input:checked + .label { color: red; } .input .label:has(:checked) { color: blue; } .input .label { color: green !important; }'
  ])('preserves valid structural/observed coexistence without an observed solver: %s', (source) => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    const result = session.replaceStylesheet({ id, source });
    expect(result.diagnostics).toEqual([]);
    expect(result.committed).toBe(true);
    expect(result.module!.compilationMode).toBe('atomic');
    expect(session.finalize().css).toContain(':has(');
  });

  it('accepts a necessarily coactive important winner without requiring one source witness', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id, source: '.input .label { color: green !important; } .input:checked ~ .label { color: red; } .input:disabled ~ .label { color: blue; }' }).committed).toBe(true);
    expect(colorRules(session.finalize().css).find(({ value }) => value === 'green')!.important).toBe(true);
  });

  it.each([
    '.input:checked ~ .label { color: red; } .input:disabled ~ .label { color: blue; } .input:checked:disabled ~ .label { color: green; }',
    '.input:where(:checked) ~ .label { color: red; } .input:where(:disabled) ~ .label { color: blue; } .input:where(:checked):where(:disabled) ~ .label { color: green; }',
    '.input:where(:checked) + .label { color: red; } .input:where(:disabled) + .label { color: blue; } .input:where(:checked):where(:disabled):where(:hover) + .label { color: green; }',
    '.input:checked > .middle + .label { color: red; } .input .middle:disabled + .label { color: blue; }',
    '.input + .middle ~ .label { color: red; } .input ~ .middle + .label { color: blue; }',
    '.input:checked + .label { color: red; } .input:disabled + .label { color: blue; } .input:checked:disabled:hover + .label { color: green; }'
  ])('does not confuse a possible common witness with full coactivity coverage: %s', (source) => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id, source }).committed).toBe(false);
    expect(session.finalize().css).toBe('');
    expect(session.getScopeSchema(id)).toBeUndefined();
  });

  it.each([
    ['.input + .label { color: red; } .input ~ .label { color: blue !important; }', ' ~ ', true],
    ['.input + .label { color: red; } .input:checked ~ .label { color: blue; }', ':checked ~ ', false],
    ['.input:checked + .label { color: red !important; } .input:disabled ~ .label { color: blue; }', ':disabled ~ ', false]
  ] as const)('retains native importance/specificity precedence: %s', (source, selector, important) => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id, source }).committed).toBe(true);
    const blue = colorRules(session.finalize().css).find(({ value }) => value === 'blue')!;
    expect(blue.selector).toContain(selector);
    expect(blue.important).toBe(important);
  });

  it('keeps configured layers/conditions ahead of relation ordering', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', layers: ['early', 'late'], conditions: { media: ['(min-width: 1px)', '(min-width: 2px)'] } });
    expect(session.replaceStylesheet({ id, source: '@layer early { @media (min-width: 1px) { .input + .label { color: red; } } } @layer late { @media (min-width: 2px) { .input ~ .label { color: blue; } } }' }).committed).toBe(true);
    expect(colorRules(session.finalize().css).map(({ value }) => value)).toEqual(['red', 'blue']);
  });

  it.each([
    ['input', 'label', 'red', 'blue'],
    ['z', 'a', 'blue', 'red'],
    ['a', 'z', 'green', 'black']
  ])('is name/value/registration independent and converges after replacement: %s/%s', (sourceName, targetName, adjacent, general) => {
    const source = `.${sourceName} + .${targetName} { color: ${adjacent}; } .${sourceName} ~ .${targetName} { color: ${general}; }`;
    const outputs: string[] = [];
    for (const reverse of [false, true]) {
      const session = createGssCompilerSession({ projectRoot: '/project' });
      const modules = [{ id, source }, { id: '/project/Other.gss', source: '.other { width: 4px; }' }];
      for (const module of reverse ? [...modules].reverse() : modules) expect(session.replaceStylesheet(module).committed).toBe(true);
      const clean = session.finalize().css;
      const schema = session.getScopeSchema(id);
      expect(colorRules(clean).map(({ value }) => value)).toEqual([general, adjacent]);
      expect(session.replaceStylesheet({ id, source: `.${sourceName} > .${targetName} { color: orange; }` }).committed).toBe(true);
      expect(session.replaceStylesheet({ id, source }).committed).toBe(true);
      expect(session.finalize().css).toEqual(clean);
      expect(session.getScopeSchema(id)).toEqual(schema);
      outputs.push(clean);
    }
    expect(outputs[0]).toBe(outputs[1]);
  });

  it('proves a longer runtime suffix refines the aligned shorter suffix without inventing ownership ancestry', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id, source: '.input > .middle + .label { color: red; } .input .middle ~ .label { color: blue; }' }).committed).toBe(true);
    expect(colorRules(session.finalize().css).map(({ value }) => value)).toEqual(['blue', 'red']);
  });

  it('resolves equivalent structural predicates only inside their closed authored group', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id, source: [
      '.input:checked:disabled + .label { color: blue; margin: 1px; }',
      '.input:disabled:checked + .label { color: red; margin-left: 2px; }'
    ].join('\n') }).committed).toBe(true);
    expect(colorRules(session.finalize().css).map(({ value }) => value)).toEqual(['red']);
    expect(session.finalize().css).toContain('margin: 1px');
    expect(session.finalize().css).toContain('margin-left: 2px');
  });

  it('emits general sibling before adjacent sibling, independent of authored order (ADR-0013)', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    for (const source of [
      '.input + .label { color: red; } .input ~ .label { color: blue; }',
      '.input ~ .label { color: blue; } .input + .label { color: red; }'
    ]) {
      expect(session.replaceStylesheet({ id, source }).committed).toBe(true);
      const schema = session.getScopeSchema(id)!;
      const rules = colorRules(session.finalize().css);
      expect(rules.map(({ value }) => value)).toEqual(['blue', 'red']);
      expect(rules[0]!.selector).toContain(' ~ ');
      expect(rules[1]!.selector).toContain(' + ');
      for (const rule of rules) {
        const target = rule.selector.split('.').at(-1)!;
        expect(schema.exports.input!.targets.label!.selfClassName.split(' ')).toContain(target);
      }
    }
  });
});
