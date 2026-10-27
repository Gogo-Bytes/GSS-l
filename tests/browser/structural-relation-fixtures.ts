import type { ScopeSchema } from '@gss-l/compiler';
import type { ReferenceFixture } from './fixtures.js';

type StructuralFixture = ReferenceFixture & {
  reference: { css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>> };
};
const scopeSchemas: Readonly<Record<string, ScopeSchema>> = {
  'Relations.gss': { moduleId: 'Relations.gss', exports: {
    input: { selfClassName: 'input', targets: { label: { selfClassName: 'label', targets: {} } } },
    spacer: { selfClassName: 'spacer', targets: {} }
  } }
};
const red = { color: 'rgb(255, 0, 0)' };
const blue = { color: 'rgb(0, 0, 255)' };
const black = { color: 'rgb(0, 0, 0)' };

// Hand-authored ADR-0013 goldens, NOT compileGssReference coverage. Native authored
// order alone is not the GSS oracle: the specified narrower winner is explicitly last.
const siblingFixtures: readonly StructuralFixture[] = [false, true].flatMap((reverse) =>
  ['', ':checked', '[data-mode=ready]'].map((predicate): StructuralFixture => {
    const rules = [`.input${predicate} + .label { color: red; }`, `.input${predicate} ~ .label { color: blue; }`];
    const active = { adjacent: red, distant: blue };
    const inactive = { adjacent: black, distant: black };
    const changes = (on: boolean) => ['source', 'earlier-source'].map((node) => predicate === ':checked'
      ? { node, checked: on } : { node, attributes: { 'data-mode': on ? 'ready' : null } });
    return {
      name: `structural-sibling-${predicate === '' ? 'base' : predicate === ':checked' ? 'state' : 'attribute'}-${reverse ? 'reversed' : 'forward'}`,
      modules: [{ id: 'Relations.gss', source: '.input .label { color: black; } .spacer {}\n' + (reverse ? [...rules].reverse() : rules).join('\n') }],
      reference: { css: `.label { color: black; } .input${predicate} ~ .label { color: blue; } .input${predicate} + .label { color: red; }`, scopeSchemas },
      nodes: [
        { id: 'earlier-source', tag: 'input', moduleId: 'Relations.gss', path: ['input'], expected: {} },
        { id: 'source', tag: 'input', moduleId: 'Relations.gss', path: ['input'], expected: {} },
        { id: 'adjacent', moduleId: 'Relations.gss', path: ['input', 'label'], expected: predicate ? black : red },
        { id: 'spacer', moduleId: 'Relations.gss', path: ['spacer'], expected: {} },
        { id: 'distant', moduleId: 'Relations.gss', path: ['input', 'label'], expected: predicate ? black : blue }
      ],
      phases: predicate ? [
        { name: 'entered', changes: changes(true), expected: active },
        { name: 'earlier-witness-only', changes: [changes(false)[0]!], expected: { adjacent: blue, distant: blue } },
        { name: 'exited', changes: changes(false), expected: inactive },
        { name: 'restored', changes: changes(true), expected: active }
      ] : []
    };
  })
);

const sharedEffectFixtures: readonly StructuralFixture[] = ['forward', 'reverse', 'single-Module'].map((order) => {
  const a = { id: 'A.gss', source: '.a:where(:checked) { margin: 1px; } .x + .y { width: 1px; }' };
  const b = { id: 'B.gss', source: '.b { margin-left: 2px; } .b:where(:checked) { margin: 1px; }' };
  const modules = order === 'single-Module' ? [{ id: 'A.gss', source: a.source + b.source }] : order === 'reverse' ? [b, a] : [a, b];
  const bModule = order === 'single-Module' ? 'A.gss' : 'B.gss';
  return {
    name: `structural-unrelated-shared-effect-${order}`,
    modules,
    setupCss: 'input { margin: 0; }',
    reference: {
      css: '.b { margin-left: 2px; } .a:where(:checked), .b:where(:checked) { margin: 1px; }',
      scopeSchemas: Object.fromEntries(modules.map(({ id }) => [id, { moduleId: id, exports: {
        a: { selfClassName: 'a', targets: {} }, b: { selfClassName: 'b', targets: {} }
      } }]))
    },
    nodes: [
      { id: 'a', tag: 'input', moduleId: 'A.gss', path: ['a'], expected: {} },
      { id: 'b', tag: 'input', moduleId: bModule, path: ['b'], expected: { 'margin-left': '2px' } }
    ],
    phases: [
      { name: 'checked', changes: [{ node: 'a', checked: true }, { node: 'b', checked: true }], expected: { b: { 'margin-left': '1px' } } },
      { name: 'restored', changes: [{ node: 'a', checked: false }, { node: 'b', checked: false }], expected: { b: { 'margin-left': '2px' } } }
    ]
  };
});

const intersectionFixtures: readonly StructuralFixture[] = [false, true].map((reverse) => {
  const rules = [
    '.input:where(:checked) + .label { color: red; }',
    '.input:where(:disabled) + .label { color: blue; }',
    '.input:where(:checked):where(:disabled) + .label { color: green; }'
  ];
  return {
    name: `structural-equal-specificity-intersection-${reverse ? 'reversed' : 'forward'}`,
    modules: [{ id: 'Relations.gss', source: '.input .label { color: black; }' + (reverse ? [...rules].reverse() : rules).join('\n') }],
    reference: {
      css: '.label.label { color: black; } .input:where(:checked) + .label { color: red; } .input:where(:disabled) + .label { color: blue; } .input:where(:checked):where(:disabled) + .label { color: green; }',
      scopeSchemas
    },
    nodes: [
      { id: 'source', tag: 'input', moduleId: 'Relations.gss', path: ['input'], expected: {} },
      { id: 'target', moduleId: 'Relations.gss', path: ['input', 'label'], expected: black }
    ],
    phases: [
      { name: 'checked', changes: [{ node: 'source', checked: true }], expected: { target: red } },
      { name: 'intersection', changes: [{ node: 'source', disabled: true }], expected: { target: { color: 'rgb(0, 128, 0)' } } },
      { name: 'disabled', changes: [{ node: 'source', checked: false }], expected: { target: blue } },
      { name: 'restored', changes: [{ node: 'source', disabled: false }], expected: { target: black } }
    ]
  };
});

export const structuralRelationFixtures: readonly StructuralFixture[] = [
  ...siblingFixtures,
  ...sharedEffectFixtures,
  ...intersectionFixtures,
  ...['state', 'attribute', 'importance', 'specificity'].map((kind): StructuralFixture => {
    const predicate = kind === 'attribute' ? '[data-mode=ready]' : ':checked';
    const important = kind === 'importance';
    const specific = kind === 'specificity';
    const source = specific
      ? '.input + .label { color: red; } .input:checked ~ .label { color: blue; }'
      : important ? '.input + .label { color: red; } .input ~ .label { color: blue !important; }'
        : `.input${predicate} + .label { color: red; } .input ~ .label { color: blue; }`;
    const reference = specific
      ? '.input:checked ~ .label { color: blue; } .input + .label { color: red; }'
      : important ? '.input ~ .label { color: blue !important; } .input + .label { color: red; }'
        : `.input ~ .label { color: blue; } .input${predicate} + .label { color: red; }`;
    const baseline = specific ? red : blue;
    const entered = important || specific ? blue : red;
    const change = (on: boolean) => kind === 'attribute'
      ? { node: 'source', attributes: { 'data-mode': on ? 'ready' : null } }
      : { node: 'source', checked: on };
    return {
      name: `structural-sibling-${kind}-priority`,
      modules: [{ id: 'Relations.gss', source }],
      reference: { css: reference, scopeSchemas },
      nodes: [
        { id: 'source', tag: 'input', moduleId: 'Relations.gss', path: ['input'], expected: {} },
        { id: 'adjacent', moduleId: 'Relations.gss', path: ['input', 'label'], expected: baseline }
      ],
      phases: [
        { name: 'entered', changes: [change(true)], expected: { adjacent: entered } },
        { name: 'restored', changes: [change(false)], expected: { adjacent: baseline } }
      ]
    };
  }),
  {
    name: 'structural-mixed-suffix-implication',
    modules: [{ id: 'Relations.gss', source: '.input > .middle + .label { color: red; } .input .middle ~ .label { color: blue; } .spacer {}' }],
    reference: {
      css: '.middle ~ .label { color: blue; } .input > .middle + .label { color: red; }',
      scopeSchemas: { 'Relations.gss': { moduleId: 'Relations.gss', exports: {
        input: { selfClassName: 'input', targets: { middle: { selfClassName: 'middle', targets: { label: { selfClassName: 'label', targets: {} } } } } },
        spacer: { selfClassName: 'spacer', targets: {} }
      } } }
    },
    nodes: [
      { id: 'parent', moduleId: 'Relations.gss', path: ['input'], expected: {} },
      { id: 'middle', parent: 'parent', moduleId: 'Relations.gss', path: ['input', 'middle'], expected: {} },
      { id: 'adjacent', parent: 'parent', moduleId: 'Relations.gss', path: ['input', 'middle', 'label'], expected: red },
      { id: 'spacer', parent: 'parent', moduleId: 'Relations.gss', path: ['spacer'], expected: {} },
      { id: 'distant', parent: 'parent', moduleId: 'Relations.gss', path: ['input', 'middle', 'label'], expected: blue }
    ]
  }
];

// Ownership prefix classes contribute specificity, not invented DOM ancestors.
// Repeated literal classes below independently encode that accepted ownership rule.
export const structuralObservedFixtures: readonly StructuralFixture[] = [
  'observed-specificity', 'structural-specificity', 'observed-important', 'structural-important'
].map((kind): StructuralFixture => {
  const structuralSpecific = kind === 'structural-specificity';
  const observedSpecific = kind === 'observed-specificity';
  const predicate = observedSpecific ? ':where(:checked)' : structuralSpecific ? ':checked:disabled' : ':checked';
  const structuralImportant = kind === 'structural-important' ? ' !important' : '';
  const observedImportant = kind === 'observed-important' ? ' !important' : '';
  const both = kind.startsWith('structural') ? red : blue;
  return {
    name: `structural-observed-${kind}`,
    modules: [{ id: 'Relations.gss', source: [
      '.root .input .label { color: black; } .observed {}',
      `.root .input${predicate} + .label { color: red${structuralImportant}; }`,
      `.root .input .label:has(:checked) { color: blue${observedImportant}; }`
    ].join('\n') }],
    reference: {
      css: `.label.label.label { color: black; } .input.input${predicate} + .label { color: red${structuralImportant}; } .label.label.label:has(:checked) { color: blue${observedImportant}; }`,
      scopeSchemas: { 'Relations.gss': { moduleId: 'Relations.gss', exports: {
        root: { selfClassName: 'root', targets: { input: { selfClassName: 'input', targets: { label: { selfClassName: 'label', targets: {} } } } } },
        observed: { selfClassName: 'observed', targets: {} }
      } } }
    },
    nodes: [
      { id: 'root', moduleId: 'Relations.gss', path: ['root'], expected: {} },
      { id: 'source', parent: 'root', tag: 'input', moduleId: 'Relations.gss', path: ['root', 'input'], expected: {} },
      { id: 'target', parent: 'root', moduleId: 'Relations.gss', path: ['root', 'input', 'label'], expected: black },
      { id: 'observed', parent: 'target', tag: 'input', moduleId: 'Relations.gss', path: ['observed'], expected: {} }
    ],
    phases: [
      { name: 'observed-only', changes: [{ node: 'observed', checked: true }], expected: { target: blue } },
      { name: 'both', changes: [{ node: 'source', checked: true, disabled: structuralSpecific }], expected: { target: both } },
      { name: 'structural-only', changes: [{ node: 'observed', checked: false }], expected: { target: red } },
      { name: 'restored', changes: [{ node: 'source', checked: false, disabled: false }], expected: { target: black } }
    ]
  };
});
