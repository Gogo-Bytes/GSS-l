import { describe, expect, it } from 'vitest';
import postcss from 'postcss';
import { compileGssReference } from '../src/index.js';

const config = { projectRoot: '/project' };

describe('compileGssReference', () => {
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
    '.card[data-active] { color: red; }', '.card::before { color: red; }',
    ':global(.card) { color: red; }', '.c\\\\61rd { color: red; }',
    '@media (min-width: 1px) { .card { color: red; } }',
    '@layer base { .card { color: red; } }', '@keyframes spin { to { width: 1px; } }',
    '@font-face { font-family: Test; }', '@import "other.css";',
    '.card { .icon { color: red; } }', '.card { & { color: red; } }',
    '.card { unknown: 1; }', '.card { margin-inline: 1px; }',
    '.card { --tone: red; }', '.card { color: var(--tone); }',
    '.card { background-image: url(image.png); }', '.card { animation: spin 1s; }',
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

  it.each([
    { layers: ['base'] }, { conditions: { media: ['(min-width: 1px)'] } },
    { conditions: { supports: ['(display: grid)'] } },
    { conditions: { container: ['(min-width: 1px)'] } }
  ])('rejects configured ordering rather than substituting native source order: %j', (ordering) => {
    const result = compileGssReference({ config: { ...config, ...ordering }, modules: [
      { id: 'Card.gss', source: '.card { color: red; }' }
    ] });
    expect(result.success).toBe(false);
    expect(result).not.toHaveProperty('css');
    expect(result.diagnostics[0]?.reason).toBe('unsupported-reference-config');
  });

  it('rejects asset bindings without invoking a host resolver', () => {
    const result = compileGssReference({ config, modules: [
      { id: 'Card.gss', source: '.card {}', assetReferences: [{ url: 'a.png', identity: 'a' }] }
    ] }, { resolveAssetUrl() { throw new Error('Reference slice must not request resources'); } });
    expect(result.success).toBe(false);
    expect(result.diagnostics[0]?.reason).toBe('unsupported-reference-assets');
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
