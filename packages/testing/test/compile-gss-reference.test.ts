import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { compileGssReference } from '../src/index.js';

const config = { projectRoot: '/project' };

describe('compileGssReference', () => {
  it('keeps terminal before/after identities on base scope paths without injecting content', () => {
    const source = '.card::before { color: red; } .card .icon::after { color: blue; }';
    const result = compileGssReference({ config, modules: [{ id: 'Pseudo.gss', source }] });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected pseudo reference output');
    const card = result.scopeSchemas['Pseudo.gss']!.exports.card!;
    expect(Object.keys(result.scopeSchemas['Pseudo.gss']!.exports)).toEqual(['card']);
    expect(Object.keys(card.targets)).toEqual(['icon']);
    expect(card.targets.icon!.targets).toEqual({});
    expect(result.css).toBe(`.${card.selfClassName}::before { color: red; } .${card.selfClassName} .${card.targets.icon!.selfClassName}::after { color: blue; }`);
    expect(result.css).not.toContain('content:');
  });

  it('preserves quoted content and current pseudo states without rewriting string or comment classes', () => {
    const source = [
      '.card /* .phantom */ .icon::before { content: "a .icon /* .ghost */"; }',
      ".card .icon:disabled::after { content: '.card'; color: blue !important; }",
      '.icon:checked:disabled::before { content: ""; }',
      '.icon[data-label=".card ::before"] { color: red; }'
    ].join('\n');
    const result = compileGssReference({ config, modules: [{ id: 'Content.gss', source }] });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected content reference output');
    const scopes = result.scopeSchemas['Content.gss']!.exports;
    const card = scopes.card!;
    const icon = scopes.icon!;
    expect(card.targets.icon!.selfClassName).toBe(icon.selfClassName);
    expect(Object.keys(scopes)).toEqual(['card', 'icon']);
    expect(icon.targets).toEqual({});
    expect(result.css).toBe([
      `.${card.selfClassName} /* .phantom */ .${icon.selfClassName}::before { content: "a .icon /* .ghost */"; }`,
      `.${card.selfClassName} .${icon.selfClassName}:disabled::after { content: '.card'; color: blue !important; }`,
      `.${icon.selfClassName}:checked:disabled::before { content: ""; }`,
      `.${icon.selfClassName}[data-label=".card ::before"] { color: red; }`
    ].join('\n'));
  });

  it('retains current and ancestor native states, intersections, duplicate paths and structural prefixes', () => {
    const source = [
      '.control { color: black; }',
      '.control:checked { color: red; }',
      '.control:disabled { color: blue; }',
      '.control:checked:disabled { color: green !important; }',
      '.group:disabled .middle .control { padding-left: 7px; }',
      '.group:checked .middle .control { margin-left: 9px; }'
    ].join('\n');
    const result = compileGssReference({ config, modules: [{ id: 'State.gss', source }] });
    if (!result.success) throw new Error('Expected native state reference output');
    const scopes = result.scopeSchemas['State.gss']!.exports;
    const control = scopes.control!;
    const group = scopes.group!;
    const middle = group.targets.middle!;
    expect(middle.targets.control!.selfClassName).toBe(control.selfClassName);
    expect(Object.keys(scopes)).toEqual(['control', 'group']);
    expect(Object.keys(group.targets)).toEqual(['middle']);
    expect(Object.keys(middle.targets)).toEqual(['control']);
    expect(result.css).toBe(source.replaceAll('.control', `.${control.selfClassName}`)
      .replaceAll('.group', `.${group.selfClassName}`).replaceAll('.middle', `.${middle.selfClassName}`));
  });

  it('preserves data/ARIA equality syntax and string/comment class text without inventing scope paths', () => {
    const source = [
      '.card[data-label = "a .phantom /* .ghost */ :checked"] { color: red; }',
      ".card[aria-expanded='true'] { width: 80px; }",
      '.card[data-mode=ready] /* .notScope */ .middle .icon { padding-left: 7px; }',
      '.card[aria-expanded="true"] .middle .icon { margin-left: 9px; }',
      '.icon[data-empty=""] { height: 20px; }'
    ].join('\n');
    const result = compileGssReference({ config, modules: [{ id: 'Attribute.gss', source }] });
    if (!result.success) throw new Error('Expected attribute reference output');
    const scopes = result.scopeSchemas['Attribute.gss']!.exports;
    const card = scopes.card!;
    const middle = card.targets.middle!;
    const icon = scopes.icon!;
    expect(Object.keys(scopes)).toEqual(['card', 'icon']);
    expect(Object.keys(card.targets)).toEqual(['middle']);
    expect(Object.keys(middle.targets)).toEqual(['icon']);
    expect(middle.targets.icon!.selfClassName).toBe(icon.selfClassName);
    expect(result.css).toBe(source.replaceAll('.card', `.${card.selfClassName}`)
      .replaceAll('.middle', `.${middle.selfClassName}`).replaceAll('.icon', `.${icon.selfClassName}`));
  });

  it('preserves selector comments without treating their text as scope paths', () => {
    const result = compileGssReference({ config, modules: [{ id: 'A.gss',
      source: '.a /* authored .phantom selector comment */ .b { color: red; }'
    }] });
    if (!result.success) throw new Error('Expected reference output');
    const a = result.scopeSchemas['A.gss']!.exports.a!;
    expect(result.css).toBe(`.${a.selfClassName} /* authored .phantom selector comment */ .${a.targets.b!.selfClassName} { color: red; }`);
    expect(Object.keys(a.targets)).toEqual(['b']);
    expect(Object.keys(result.scopeSchemas['A.gss']!.exports)).toEqual(['a']);
  });

  it('rejects comments splitting identifiers rather than inventing a merged class', () => {
    const result = compileGssReference({ config, modules: [{ id: 'A.gss', source: '.a/**/b { color: red; }' }] });
    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty('css');
  });

  it.each([
    '|.card { color: red; }', 'ns|.card { color: red; }', '.a|.b { color: red; }',
    '|.card::before { content: "x"; }', 'ns|.card::after { content: "x"; }',
    '.card::before .icon { color: red; }', '.card::after:disabled { color: red; }',
    '.card::before::after { color: red; }', '.card::before::before { color: red; }',
    '.card::before() { color: red; }', '.card:before { color: red; }',
    '.card::unknown { color: red; }', '.card:hover::before { color: red; }',
    '.card:disabled .icon::after { color: red; }',
    '.card[data-mode=ready]::before { color: red; }',
    '.card[data-mode=ready] .icon::after { color: red; }',
    '.card::before { content: attr(data-label); }', '.card::after { content: "a\\\\b"; }',
    '.card::before { content: "a"; content: "b"; }',
    '.card:hover { color: red; }', '.card:focus { color: red; }',
    '.card:checked() { color: red; }', '.card:not(:checked) { color: red; }',
    '.card:is(:disabled) { color: red; }', '.card:where(:checked) { color: red; }',
    '.card:checked .icon:disabled { color: red; }',
    '.card:checked[data-mode="on"] { color: red; }',
    '.card[data-mode="on"] .icon:checked { color: red; }',
    '.card[data-mode="on"][aria-expanded="true"] { color: red; }',
    '.card[data-mode="on"] .icon[data-mode="on"] { color: red; }',
    '.card[title="on"] { color: red; }', '.card[DATA-mode="on"] { color: red; }',
    '.card[data-="on"] { color: red; }', '.card[data-1mode="on"] { color: red; }',
    '.card[ns|data-mode="on"] { color: red; }', '.card[|data-mode="on"] { color: red; }',
    '.card[*|data-mode="on"] { color: red; }',
    '.card[data-mode="on" i] { color: red; }', '.card[data-mode="on" s] { color: red; }',
    '.card[data-mode~="on"] { color: red; }', '.card[data-mode|="on"] { color: red; }',
    '.card[data-mode^="on"] { color: red; }', '.card[data-mode$="on"] { color: red; }',
    '.card[data-mode*="on"] { color: red; }', '.card[data-mode=123] { color: red; }',
    '.card[data-mode="o\\\\6e"] { color: red; }', '.card[data-mode="a\nb"] { color: red; }',
    '.card[data-mode/**/="on"] { color: red; }',
    '.card > .icon { color: red; }',
    '.card + .icon { color: red; }', '.card ~ .icon { color: red; }',
    '.card.active { color: red; }', '.card, .icon { color: red; }',
    '.card[data-active] { color: red; }', '.card::selection { color: red; }',
    ':global(.card) { color: red; }', '.c\\\\61rd { color: red; }',
    '@media (min-width: 1px) { .card { color: red; } }',
    '@layer base { .card { color: red; } }', '@keyframes spin { to { width: 1px; } }',
    '@font-face { font-family: Test; }', '@import "other.css";',
    '.card { .icon { color: red; } }', '.card { & { color: red; } }',
    '.card { unknown: 1; }', '.card { margin-inline: 1px; }',
    '.card { --tone: red; }', '.card { color: var(--tone); }',
    '.card { background-image: linear-gradient(red, blue); }', '.card { animation: spin 1s; }',
    '.card { color: red; color: blue; }', 'color: red;', '.card { color: red'
  ])('fails unsupported or malformed source without partial output: %s', (source) => {
    const result = compileGssReference({ config, modules: [
      { id: 'AValid.gss', source: '.valid { color: green; }' },
      { id: 'ZInvalid.gss', source }
    ] });
    expect(result).toMatchObject({ success: false, diagnostics: [
      { severity: 'error', id: 'ZInvalid.gss' }
    ] });
    expect(result).not.toHaveProperty('css');
    expect(result).not.toHaveProperty('scopeSchemas');
  });

  it('orders registered media groups globally before source/Module order without changing specificity or grouping', () => {
    const config = { projectRoot: '/project', conditions: { media: ['(min-width: 200px)', '(min-width: 400px)'] } };
    const modules = [
      { id: 'Z.gss', source: '@media (min-width: 400px) { .card { color: blue !important; padding: 1px; padding-left: 3px; } } .card { color: black; } @media (min-width: 200px) { .outer .card { color: red; } .empty {} }' },
      { id: 'A.gss', source: '@media (min-width: 400px) { .card { color: green; } } .card {}' }
    ];
    const result = compileGssReference({ config, modules });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected registered reference output');
    expect(compileGssReference({ config, modules: [...modules].reverse() })).toEqual(result);
    const root = postcss.parse(result.css);
    expect(root.nodes.map((node) => node.type === 'atrule' ? node.params : 'base')).toEqual([
      'base', 'base', '(min-width: 200px)', '(min-width: 400px)', '(min-width: 400px)'
    ]);
    const z = result.scopeSchemas['Z.gss']!.exports;
    expect(z.outer!.targets.card!.selfClassName).toBe(z.card!.selfClassName);
    expect(z.empty!.selfClassName).toBeTruthy();
    expect(z.card!.selfClassName).not.toBe(result.scopeSchemas['A.gss']!.exports.card!.selfClassName);
    expect(result.css).toContain(`.${z.outer!.selfClassName} .${z.card!.selfClassName} { color: red; }`);
    expect(result.css).toContain('color: blue !important; padding: 1px; padding-left: 3px;');
    const reversed = compileGssReference({ config: { ...config, conditions: { media: [...config.conditions.media].reverse() } }, modules });
    if (!reversed.success) throw new Error('Expected reverse configured order');
    expect(postcss.parse(reversed.css).nodes.map((node) => node.type === 'atrule' ? node.params : 'base')).toEqual([
      'base', 'base', '(min-width: 400px)', '(min-width: 400px)', '(min-width: 200px)'
    ]);
  });

  it.each([
    { layers: ['base'] }, { conditions: { media: ['(min-width: 1px)'] } },
    { conditions: { supports: ['(display: grid)'] } },
    { conditions: { container: ['(min-width: 1px)'] } }
  ])('accepts bounded configuration even when registered wrappers are unused: %j', (ordering) => {
    const result = compileGssReference({ config: { ...config, ...ordering }, modules: [{ id: 'Card.gss', source: '.card {}' }] });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected unused registration support');
    expect(result.scopeSchemas['Card.gss']!.exports.card!.selfClassName).toBeTruthy();
    expect(result.css.startsWith('@layer base;')).toBe('layers' in ordering);
  });

  it('uses configured rank under reversed authored wrappers, retaining order inside each group', () => {
    const first = '@media (min-width: 200px) { .card { color: red; } .card { color: green; } }';
    const last = '@media (min-width: 400px) { .card { color: blue; } }';
    const base = '.card { color: black; }';
    const compile = (source: string) => compileGssReference({ config: { ...config, conditions: { media: ['(min-width: 200px)', '(min-width: 400px)'] } }, modules: [{ id: 'Order.gss', source }] });
    const values = (result: ReturnType<typeof compile>) => {
      if (!result.success) throw new Error('Expected configured order');
      const values: string[] = [];
      postcss.parse(result.css).walkDecls('color', (declaration) => { values.push(declaration.value); });
      return values;
    };
    expect(values(compile([base, first, last].join('\n')))).toEqual(['black', 'red', 'green', 'blue']);
    expect(values(compile([last, first, base].join('\n')))).toEqual(['black', 'red', 'green', 'blue']);
  });

  it('rejects unknown condition configuration keys rather than ignoring them', () => {
    const result = compileGssReference({ config: { ...config, conditions: { media: [], unknown: [] } } as typeof config, modules: [] });
    expect(result).toMatchObject({ success: false, diagnostics: [{ reason: 'unsupported-reference-config' }] });
    expect(result).not.toHaveProperty('css');
  });

  it.each(['media', 'supports', 'container'] as const)('keeps registered %s wrappers within configured layers and empty paths', (kind) => {
    const queries = kind === 'supports' ? ['(display: grid)', '(display: gss-unsupported)']
      : kind === 'container' ? ['panel (min-width: 200px)', '(max-width: 400px)'] : ['(min-width: 200px)', '(max-width: 400px)'];
    const source = `@layer late { @${kind} ${queries[1]} { /* .ghost */ .outer .empty {} .card { content: ".card"; color: blue !important; color: green; } } }
      @layer early { @${kind} ${queries[0]} { .card { color: red !important; } } .card { color: black; } }
      .card { color: purple !important; }`;
    const result = compileGssReference({ config: { ...config, layers: ['early', 'late'], conditions: { [kind]: queries } }, modules: [{ id: 'Layer.gss', source }] });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected layered reference');
    const root = postcss.parse(result.css);
    expect(root.nodes.map((node) => node.type === 'atrule' ? [node.name, node.params] : 'rule')).toEqual([
      ['layer', 'early, late'], ['layer', 'early'], 'rule', ['layer', 'early'], ['layer', 'late']
    ]);
    const wrappers: string[] = [];
    root.walkAtRules(kind, (node) => { wrappers.push(node.params); expect(node.parent).toMatchObject({ name: 'layer' }); });
    expect(wrappers).toEqual(queries);
    const scopes = result.scopeSchemas['Layer.gss']!.exports;
    expect(scopes.outer!.targets.empty!.selfClassName).toBeTruthy();
    expect(result.css).toContain('/* .ghost */');
    expect(result.css).toContain('content: ".card"; color: blue !important; color: green;');
    // Native prelude, not declaration/important reversal, controls layer priority.
    const reverse = compileGssReference({ config: { ...config, layers: ['late', 'early'], conditions: { [kind]: queries } }, modules: [{ id: 'Layer.gss', source }] });
    if (!reverse.success) throw new Error('Expected reversed layers');
    expect(reverse.css.replace('@layer late, early;', '@layer early, late;')).toBe(result.css);
  });

  it.each(['not', 'and', 'or', 'NoT', 'AnD', 'OR'])('rejects container operator %s as a name, including unused registrations', (name) => {
    const query = `${name} (min-width: 200px)`;
    for (const source of ['.card {}', `@container ${query} { .card { color: red; } }`]) {
      const result = compileGssReference({
        config: { ...config, conditions: { container: [query] } },
        modules: [{ id: 'Valid.gss', source: '.valid {}' }, { id: 'Container.gss', source }]
      });
      expect(result).toMatchObject({ success: false, diagnostics: [{ reason: 'unsupported-reference-config' }] });
      expect(result).not.toHaveProperty('css');
      expect(result).not.toHaveProperty('scopeSchemas');
    }
  });

  it('does not exclude container operators from configured layer names', () => {
    const layers = ['not', 'and', 'or', 'NoT', 'AnD', 'OR'];
    const result = compileGssReference({
      config: { ...config, layers },
      modules: [{ id: 'Layers.gss', source: layers.map((name) => `@layer ${name} { .card {} }`).join('\n') }]
    });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected valid layer names');
    expect(result.css).toContain('@layer not, and, or, NoT, AnD, OR;');
    expect(result.scopeSchemas['Layers.gss']!.exports.card!.selfClassName).toBeTruthy();
  });

  it.each([
    { layers: ['base.base'] }, { layers: ['base', 'base'] }, { layers: ['initial'] }, { layers: ['default'] },
    { conditions: { media: ['(min-width: 1px)'], supports: ['(display: grid)'] } },
    { conditions: { media: ['(min-width: 1px)', '(min-width: 1px)'] } },
    { conditions: { media: ['screen'] } }, { conditions: { media: ['(min-width: 1px) and (max-width: 2px)'] } },
    { conditions: { media: ['(min-width: 1.5px)'] } }, { conditions: { supports: ['not (display: grid)'] } },
    { conditions: { container: ['style(--theme: dark)'] } }, { conditions: { container: ['none (min-width: 1px)'] } }
  ])('rejects out-of-slice ordering configuration without partial output: %j', (ordering) => {
    const result = compileGssReference({ config: { ...config, ...ordering }, modules: [{ id: 'A.gss', source: '.card {}' }] });
    expect(result).toMatchObject({ success: false, diagnostics: [{ reason: 'unsupported-reference-config' }] });
    expect(result).not.toHaveProperty('css');
    expect(result).not.toHaveProperty('scopeSchemas');
  });

  it.each([
    '@media (min-width: 2px) { .card {} }', '@supports (display: grid) { .card {} }',
    '@media (min-width: 1px) { @media (min-width: 1px) { .card {} } }',
    '@media (min-width: 1px) { @layer base { .card {} } }',
    '@layer base { @layer base { .card {} } }', '@layer base.base { .card {} }',
    '@layer unknown { .card {} }', '@layer { .card {} }', '@layer base;',
    '@media (min-width: 1px);', '@layer base { @import "x.css"; }',
    '@layer base { @media (min-width: 1px) { .card { background-image: image-set(url(x) 1x); } } }',
    '@layer base { @media (min-width: 1px) { .card { .child {} } } }'
  ])('fails unsupported wrappers/resources transactionally: %s', (source) => {
    const result = compileGssReference({ config: { ...config, layers: ['base'], conditions: { media: ['(min-width: 1px)'] } }, modules: [
      { id: 'AValid.gss', source: '.valid {}' }, { id: 'ZInvalid.gss', source }
    ] });
    expect(result).toMatchObject({ success: false, diagnostics: [{ id: 'ZInvalid.gss' }] });
    expect(result).not.toHaveProperty('css');
    expect(result).not.toHaveProperty('scopeSchemas');
  });

  it('rejects unknown asset bindings without invoking a host resolver', () => {
    const result = compileGssReference({ config, modules: [
      { id: 'Card.gss', source: '.card {}', assetReferences: [{ url: 'a.png', identity: 'a' }] }
    ] }, { resolveAssetUrl() { throw new Error('Reference slice must not request resources'); } });
    expect(result.success).toBe(false);
    expect(result.diagnostics[0]?.reason).toBe('invalid-reference-asset-binding');
  });

  it('isolates Modules and calls, preserving order within each Module but not registration order', () => {
    const modules = Object.freeze([
      Object.freeze({ id: '/project/B.gss', source: '.card { color: blue; }' }),
      Object.freeze({ id: '/project/A.gss', source: '.card { color: red; } .empty {}' })
    ]);
    const result = compileGssReference({ config: Object.freeze(config), modules });
    if (!result.success) throw new Error('Expected reference output');
    const a = result.scopeSchemas['/project/A.gss']!;
    const b = result.scopeSchemas['/project/B.gss']!;
    expect(a.exports.card!.selfClassName).not.toBe(b.exports.card!.selfClassName);
    expect(a.exports.empty!.selfClassName).toBeTruthy();
    expect(compileGssReference({ config, modules: [...modules].reverse() })).toEqual(result);
    expect(compileGssReference({ config, modules: [] })).toEqual({
      success: true, css: '', scopeSchemas: {}, diagnostics: []
    });
    expect(compileGssReference({ config, modules })).toEqual(result);
    const relocated = compileGssReference({ config: { projectRoot: '/elsewhere' }, modules: [
      { ...modules[0]!, id: '/elsewhere/B.gss' }, { ...modules[1]!, id: '/elsewhere/A.gss' }
    ] });
    if (!relocated.success) throw new Error('Expected relocated reference output');
    expect(relocated.css).toBe(result.css);
  });

  it.each([
    ['Card.gss', 'Card.gss'], ['/project/Card.gss', 'Card.gss']
  ])('rejects duplicate logical Module identities %s / %s', (first, second) => {
    const result = compileGssReference({ config, modules: [
      { id: first, source: '.a {}' }, { id: second, source: '.b {}' }
    ] });
    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty('css');
    expect(result.diagnostics[0]?.reason).toBe('duplicate-reference-module');
  });

  it('fails an unrelatable absolute Module path', () => {
    const result = compileGssReference({ config, modules: [{ id: 'C:/Card.gss', source: '.card {}' }] });
    expect(result.success).toBe(false);
    expect(result.diagnostics[0]?.reason).toBe('invalid-reference-module-id');
  });

  it.each([
    'margin: 1px 2px 3px 4px; margin-left: 9px;',
    'margin-left: 9px; margin: 1px 2px 3px 4px;',
    'padding: 1px 2px 3px 4px !important; padding-left: 9px;',
    'padding-left: 9px !important; padding: 1px 2px 3px 4px;'
  ])('preserves declaration grouping, order and importance: %s', (declarations) => {
    const source = `/* authored */\n.box { ${declarations} }\n.box { color: red; }`;
    const result = compileGssReference({ config, modules: [{ id: 'Box.gss', source }] });
    if (!result.success) throw new Error('Expected reference output');
    const token = result.scopeSchemas['Box.gss']!.exports.box!.selfClassName;
    expect(result.css).toBe(source.replaceAll('.box', `.${token}`));
    expect(postcss.parse(result.css).nodes.filter((node) => node.type === 'rule')).toHaveLength(2);
  });

  it('retains separate normal and important declarations of the same property', () => {
    const result = compileGssReference({ config, modules: [
      { id: 'Card.gss', source: '.card { color: red !important; color: blue; }' }
    ] });
    if (!result.success) throw new Error('Expected reference output');
    expect(result.css).toContain('color: red !important; color: blue;');
  });

  it('does not invent undeclared paths and safely maps object-prototype class names', () => {
    const result = compileGssReference({ config, modules: [{
      id: '__proto__', source: '.constructor .__proto__ { color: red; } .other {}'
    }] });
    if (!result.success) throw new Error('Expected reference output');
    const exports = result.scopeSchemas.__proto__!.exports;
    expect(Object.keys(exports)).toEqual(['constructor', 'other']);
    expect(Object.keys(exports['constructor']!.targets)).toEqual(['__proto__']);
    expect(exports.other!.targets).toEqual({});
  });

  it('maps descendant paths to authored class tokens without pruning general rules', () => {
    const result = compileGssReference({ config, modules: [{ id: 'Tree.gss', source: [
      '.icon { display: block; color: green; }',
      '.son .icon { padding: 2px; }',
      '.father .icon { color: red; }',
      '.father .son .icon { color: blue; }'
    ].join('\n') }] });
    if (!result.success) throw new Error('Expected reference output');
    const schema = result.scopeSchemas['Tree.gss']!.exports;
    const father = schema.father!;
    const son = father.targets.son!;
    const icon = son.targets.icon!;
    expect(icon.selfClassName).toBe(schema.icon!.selfClassName);
    expect(son.selfClassName).toBe(schema.son!.selfClassName);
    expect(father.targets.icon!.selfClassName).toBe(icon.selfClassName);
    expect(icon.targets).toEqual({});
    const rules = postcss.parse(result.css).nodes;
    expect(rules.map((rule) => rule.type === 'rule' ? rule.selector : '')).toEqual([
      `.${icon.selfClassName}`, `.${son.selfClassName} .${icon.selfClassName}`,
      `.${father.selfClassName} .${icon.selfClassName}`,
      `.${father.selfClassName} .${son.selfClassName} .${icon.selfClassName}`
    ]);
    expect(result.css).toContain('color: green');
    expect(result.css).toContain('color: red');
    expect(result.css).toContain('color: blue');
  });

  it('preserves an ownership rule and maps its namespaced class', () => {
    const result = compileGssReference({ config, modules: [
      { id: '/project/Card.gss', source: '.card { color: red; display: block; }' }
    ] });
    expect(result.success).toBe(true);
    if (!result.success) throw new Error('Expected reference output');
    expect(result.diagnostics).toEqual([]);
    const schema = result.scopeSchemas['/project/Card.gss']!;
    expect(schema.moduleId).toBe('/project/Card.gss');
    const className = schema.exports.card!.selfClassName;
    expect(className).toMatch(/^gss_ref_[a-zA-Z0-9_]+$/);
    expect(result.css).toBe(`.${className} { color: red; display: block; }`);
    expect(postcss.parse(result.css).nodes).toHaveLength(1);
  });
});
