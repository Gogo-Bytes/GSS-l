import { fixtures as composition, states } from './composition-fixtures.mjs';
export { states };
const red = 'rgb(255, 0, 0)', blue = 'rgb(0, 0, 255)', green = 'rgb(0, 128, 0)', black = 'rgb(0, 0, 0)', gray = 'rgb(128, 128, 128)';
const expected = (extra) => ({ background: gray, color: black, border: black, ...extra });
const one = (name, source, nativeCss, scopes, value, extra = {}) => ({ name, source, nativeCss, scopes,
  stateNames: ['idle'], expected: [expected(value)], ...extra });
export const fixedFixtures = [...composition];
for (const reverse of [false, true]) {
  const branch = reverse ? '.a:focus,.a:where(:checked)' : '.a:where(:checked),.a:focus';
  fixedFixtures.push(one(`predicate-comma-${reverse}`, `.a:where(:checked):where(:disabled){color:blue} ${branch}{color:red}`,
    '.a:where(:checked){color:red} .a:where(:checked):where(:disabled){color:blue}', ['a'], { color: blue },
    { template: '<input id="target" type="checkbox" checked disabled class="{{a}}">', checked: true, disabled: true }));
  // Keep the original native-appearance checkbox too. Its UA border may use
  // currentColor; only blue is literal, while every computed field/pixel must
  // still equal the independently authored native-control reference.
  fixedFixtures.push(one(`predicate-native-control-${reverse}`, `.a:where(:checked):where(:disabled){color:blue} ${branch}{color:red}`,
    '.a:where(:checked){color:red} .a:where(:checked):where(:disabled){color:blue}', ['a'], {},
    { template: '<input id="target" type="checkbox" checked disabled class="{{a}}">', checked: true, disabled: true,
      nativeAppearance: true, expected: [{color:blue}] }));
  const pseudo = reverse ? '.a::after,.a::before' : '.a::before,.a::after';
  fixedFixtures.push(one(`pseudo-comma-${reverse}`, `${pseudo}{color:red} .b::before{color:blue}`,
    '.a::before,.a::after{color:red} .b::before{color:blue}', ['a', 'b'], { color: blue }, { pseudo: '::before', after: red }));
  const runtime = reverse ? '.root .item,.root > .item' : '.root > .item,.root .item';
  for (const child of [false, true]) {
    const template = `<div class="{{root}}">${child ? '' : '<div>'}<button id="target" class="{{root.item}}">target</button>${child ? '' : '</div>'}</div>`;
    fixedFixtures.push(one(`runtime-comma-${reverse}-${child}`, `.root > .item{margin-left:2px} ${runtime}{margin:1px}`,
      '.root-item{margin:1px}', ['root.item'], { marginLeft: '1px' }, { template }));
    const rules = ['.root > .item{color:blue}', '.root .item{color:red}'];
    fixedFixtures.push(one(`structure-only-${reverse}-${child}`, (reverse ? rules.reverse() : rules).join(' '),
      '.root-item{color:red} .root > .root-item{color:blue}', ['root.item'], { color: child ? blue : red }, { template }));
  }
  for (const kind of ['external', 'has']) {
    const rules = ['.button:hover{background-color:red}', kind === 'external' ? '.root :global([aria-pressed="true"]){background-color:green}' : '.button:has(:global(.external)){background-color:green}'];
    const native = ['.button:hover{background-color:red}', kind === 'external' ? '.root [aria-pressed="true"]{background-color:green}' : '.button:has(.external){background-color:green}'];
    fixedFixtures.push(one(`opaque-${kind}-${reverse}`, (reverse ? rules.reverse() : rules).join(' '),
      (reverse ? native.reverse() : native).join(' '), ['button'], {}, {
        template: '<div class="{{root}}"><button id="target" class="{{button}}"><span class="external">target</span></button></div>',
        stateNames: ['pressed', 'both'], expected: [expected({background:green}), expected({background:reverse ? red : green})], opaque: kind
      }));
  }
  // This is source-last, not an ownership edge: predicate implication cannot
  // forget the different authored ownership context. Both native strengths are 2.
  const base = '.root .button{background-color:green}', predicates = '.button:hover{background-color:red} .button[aria-pressed="true"]{background-color:blue}';
  fixedFixtures.push(one(`ownership-guard-source-tie-${reverse}`, reverse ? base + predicates : predicates + base,
    reverse ? '.root-button.root-button{background-color:green} .root-button:hover{background-color:red} .root-button[aria-pressed="true"]{background-color:blue}' : '.root-button:hover{background-color:red} .root-button[aria-pressed="true"]{background-color:blue} .root-button.root-button{background-color:green}',
    ['root.button'], {}, { stateNames: ['idle','hover','pressed','both'], expected: (reverse ? [green,red,blue,blue] : [green,green,green,green]).map((background) => expected({background})) }));
  for (const declarations of ['margin-left:2px;margin:1px', 'margin:1px;margin-left:2px']) {
    const selectors = reverse ? '.b,.a' : '.a,.b';
    fixedFixtures.push(one(`declaration-ordinal-${reverse}-${declarations.startsWith('margin-left')}`, `${selectors}{${declarations}}`, `${selectors}{${declarations}}`, ['a','b'],
      {marginLeft:declarations.startsWith('margin-left') ? '1px' : '2px'}));
  }
}
for (const child of [false, true]) {
  fixedFixtures.push(one(`structure-three-${child}`, '.root > .item{color:blue} .b{color:green} .root .item{color:red}',
    '.b{color:green} .root-item{color:red} .root > .root-item{color:blue}', ['root.item','b'], {color:child ? blue : red},
    {template:`<div class="{{root}}">${child ? '' : '<div>'}<button id="target" class="{{root.item b}}">target</button>${child ? '' : '</div>'}</div>`}));
}
fixedFixtures.push(
  one('unrelated-structure-simple-color', '.a{color:red} .x > .y{width:7px} .b{color:blue}', '.a{color:red} .b{color:blue}', ['a','b'], {color:blue}),
  one('nested-partial-shorthand', '.root .item{margin-left:2px} .item{margin:1px}', '.root-item{margin:1px;margin-left:2px}', ['root.item'], {marginLeft:'2px'}, {corruptNested:true}),
  one('nested-partial-simple-fallback', '.root .item{margin-left:2px} .item{margin:1px}', '.item{margin:1px}', ['item'], {marginLeft:'1px'}),
  one('early-red-with-blue', '.early{color:red} .middle{color:blue} .late{color:red}', '.early{color:red} .middle{color:blue} .late{color:red}', ['early','middle'], {color:blue}),
  one('late-red-with-blue', '.early{color:red} .middle{color:blue} .late{color:red}', '.early{color:red} .middle{color:blue} .late{color:red}', ['middle','late'], {color:red}),
  one('shared-comma-red-with-blue', '.early,.other{color:red} .middle{color:blue}', '.early,.other{color:red} .middle{color:blue}', ['other','middle'], {color:blue}),
  one('repeated-predicate-pruning', '.a:hover{background-color:pink} .a:hover{background-color:red} .b:hover{background-color:blue}', '.a:hover{background-color:pink} .a:hover{background-color:red} .b:hover{background-color:blue}', ['a','b'], {},
    {stateNames:['idle','hover'],expected:[expected({}),expected({background:blue})]}),
  one('runtime-adjacent-refinement', '.a ~ .b{color:red} .a + .b{color:blue}', '.a ~ .a-b{color:red} .a + .a-b{color:blue}', ['a.b'], {color:blue},
    {template:'<span class="{{a}}">witness</span><button id="target" class="{{a.b}}">target</button>'}),
  one('runtime-predicate-comma', '.a:where(:checked):where(:disabled) + .b{color:blue} .a:where(:checked) + .b,.a:focus + .b{color:red}',
    '.a:where(:checked) + .a-b{color:red} .a:where(:checked):where(:disabled) + .a-b{color:blue}', ['a.b'], {color:blue},
    {template:'<input type="checkbox" checked disabled class="{{a}}"><button id="target" class="{{a.b}}">target</button>'})
);

// Authored shorthand remains the native oracle; expected four-side values are literal.
for (const [label, value, ordinary, overridden] of [
  ['one', '1px', '1px 1px 1px 1px', '1px 1px 1px 9px'],
  ['two', '1px 2px', '1px 2px 1px 2px', '1px 2px 1px 9px'],
  ['three', '1px 2px 3px', '1px 2px 3px 2px', '1px 2px 3px 9px'],
  ['four', '1px 2px 3px 4px', '1px 2px 3px 4px', '1px 2px 3px 9px'],
  ['zero', '0 +0.0 0px', '0px 0px 0px 0px', '0px 0px 0px 9px']
]) for (const reverse of [false, true]) {
  const declarations = reverse ? `border-left-width:9px;border-width:${value}` : `border-width:${value};border-left-width:9px`;
  fixedFixtures.push(one(`border-width-${label}-${reverse}`, `.a,.b{${declarations}}`, `.a,.b{${declarations}}`, ['a','b'],
    { borderWidths: reverse ? ordinary : overridden }, { expandedBorderWidth: true, corruptBorderWidth: label === 'four' && !reverse }));
}
for (const importance of ['short', 'long', 'both']) for (const reverse of [false, true]) {
  const short = `border-width:1px 2px${importance !== 'long' ? '!important' : ''}`;
  const long = `border-left-width:9px${importance !== 'short' ? '!important' : ''}`;
  const declarations = (reverse ? [long, short] : [short, long]).join(';');
  fixedFixtures.push(one(`border-width-important-${importance}-${reverse}`, `.a{${declarations}}`, `.a{${declarations}}`, ['a'],
    { borderWidths: importance === 'short' || (importance === 'both' && reverse) ? '1px 2px 1px 2px' : '1px 2px 1px 9px' },
    { expandedBorderWidth: true }));
}
for (const [label, source, scopes, borderWidths] of [
  ['cross-scope', '.a{border-width:1px;border-left-width:9px}.b{border-right-width:3px}', ['a','b'], '1px 3px 1px 9px'],
  ['logical', '.a{border-inline-start-width:3px;border-width:1px;border-left-width:9px}', ['a'], '1px 1px 1px 9px'],
  ['variable', '.a{border-width:var(--widths,1px);border-left-width:9px}', ['a'], '1px 1px 1px 9px']
]) fixedFixtures.push(one(`border-width-retained-${label}`, source, source, scopes, { borderWidths }, { expandedBorderWidth: false }));

// Reuse must preserve arbitrary same-module subsets, not merely the all-class case.
const physicalReuseSource = '.a{margin-left:1px}.b{margin-left:1px}.middle{margin-left:9px}.late{margin-left:1px}';
for (const [label, scopes, marginLeft] of [
  ['pair', ['a', 'b'], '1px'], ['early', ['a', 'middle'], '9px'],
  ['second', ['b', 'middle'], '9px'], ['late', ['middle', 'late'], '1px'],
  ['all', ['a', 'b', 'middle', 'late'], '1px']
]) fixedFixtures.push(one(`physical-reuse-${label}`, physicalReuseSource, physicalReuseSource, scopes,
  { marginLeft }, { sharedScopes: ['a', 'b'], distinctScopes: ['a', 'late'], corruptPhysicalReuse: label === 'early' }));
for (const [label, source] of [
  ['logical', '.a{margin-left:1px}.b{margin-left:1px}.x{margin-inline-start:2px}'],
  ['shorthand', '.a{margin-left:1px}.b{margin-left:1px}.x{margin:var(--space,3px)}']
]) fixedFixtures.push(one(`physical-reuse-barrier-${label}`, source, source, ['a', 'b'],
  { marginLeft: '1px' }, { distinctScopes: ['a', 'b'] }));

// Same ordered condition chains share; the browser independently evaluates them.
for (const [kind, activeQuery, inactiveQuery] of [
  ['media', '(min-width:1px)', '(max-width:1px)'],
  ['supports', '(display:grid)', '(display:gss-invalid-display)'],
  ['container', '(min-width:1px)', '(max-width:1px)']
]) for (const [label, query, scopes, marginLeft] of [
  ['early', activeQuery, ['a', 'b', 'middle'], '9px'],
  ['late', activeQuery, ['middle', 'late'], '1px'],
  ['inactive', inactiveQuery, ['a', 'b', 'middle', 'late'], '0px']
]) {
  const source = `@${kind} ${query}{${physicalReuseSource}}`;
  fixedFixtures.push(one(`conditional-reuse-${kind}-${label}`, source, source, scopes, { marginLeft }, {
    compilerConfig: { conditions: { [kind]: [query] } },
    template: `<div style="container-type:inline-size;width:400px"><button id="target" class="{{${scopes.join(' ')}}}">target</button></div>`,
    sharedScopes: ['a', 'b'], distinctScopes: ['a', 'late'], corruptPhysicalReuse: label === 'early'
  }));
}
const nestedReuseSource = `@media (min-width:1px){@supports (display:grid){${physicalReuseSource}}}`;
fixedFixtures.push(one('conditional-reuse-nested', nestedReuseSource, nestedReuseSource, ['a', 'b', 'middle'], { marginLeft: '9px' }, {
  compilerConfig: { conditions: { media: ['(min-width:1px)'], supports: ['(display:grid)'] } },
  sharedScopes: ['a', 'b'], distinctScopes: ['a', 'late']
}));
