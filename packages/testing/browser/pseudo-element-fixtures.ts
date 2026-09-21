import type { PseudoExpectations, ReferenceFixture } from './fixtures.js';

const host = { color: 'rgb(0, 0, 0)', display: 'block', width: '80px', height: '30px', 'margin-left': '0px' };
const before = { content: '"before"', color: 'rgb(0, 128, 0)', display: 'block', width: '11px', height: '7px', 'padding-left': '0px' };
const after = { content: '"after"', color: 'rgb(0, 0, 255)', display: 'block', width: '13px', height: '9px' };
const deepPseudos: PseudoExpectations = {
  '::before': { ...before, color: 'rgb(0, 0, 255)', 'padding-left': '5px' }, '::after': after
};
const directPseudos: PseudoExpectations = { '::before': { ...before, color: 'rgb(255, 0, 0)' }, '::after': after };
const standalonePseudos: PseudoExpectations = { '::before': before, '::after': after };
const treeExpected = { 'pseudo-target': host, 'direct-pseudo': host, 'standalone-pseudo': host, leaf: { color: 'rgb(0, 0, 0)' } };
const treePseudos = { 'pseudo-target': deepPseudos, 'direct-pseudo': directPseudos, 'standalone-pseudo': standalonePseudos };

// Native-equivalent closed-target cases, not a claim that global authored order is GSS precedence.
export const pseudoElementFixtures: readonly ReferenceFixture[] = [
  ...[false, true].flatMap((reverse) => [false, true].map((important) => pseudoPriorityFixture(reverse, important))),
  {
    name: 'pseudo-module-isolation',
    modules: [
      { id: 'PseudoA.gss', source: [
        '.card { color: black; display: block; width: 80px; height: 30px; margin-left: 0; }',
        '.card::before { content: "before A"; color: red !important; display: block; width: 11px; height: 7px; }',
        '.card::before { color: green; }',
        ".card::after { content: 'after A'; color: blue; display: block; width: 13px; height: 9px; }",
        '.empty { color: black; } .empty::before { color: red; }'
      ].join('\n') },
      { id: 'PseudoB.gss', source: [
        '.card { color: black; display: block; width: 80px; height: 30px; margin-left: 0; }',
        '.card::before { content: "before B"; color: green; display: block; width: 17px; height: 5px; }',
        '.card::after { content: "after B"; color: purple; display: block; width: 19px; height: 6px; }'
      ].join('\n') }
    ],
    nodes: [
      { id: 'pseudo-a', moduleId: 'PseudoA.gss', path: ['card'], expected: host, pseudoExpected: {
        '::before': { content: '"before A"', color: 'rgb(255, 0, 0)', display: 'block', width: '11px', height: '7px' },
        '::after': { content: '"after A"', color: 'rgb(0, 0, 255)', display: 'block', width: '13px', height: '9px' }
      } },
      { id: 'pseudo-b', moduleId: 'PseudoB.gss', path: ['card'], expected: host, pseudoExpected: {
        '::before': { content: '"before B"', color: 'rgb(0, 128, 0)', display: 'block', width: '17px', height: '5px' },
        '::after': { content: '"after B"', color: 'rgb(128, 0, 128)', display: 'block', width: '19px', height: '6px' }
      } },
      { id: 'no-content', moduleId: 'PseudoA.gss', path: ['empty'], expected: { color: 'rgb(0, 0, 0)' },
        pseudoExpected: { '::before': { content: 'none', color: 'rgb(255, 0, 0)' }, '::after': { content: 'none', color: 'rgb(0, 0, 0)' } } }
    ]
  },
  {
    name: 'pseudo-descendant-prefix-disabled',
    modules: [{ id: 'PseudoTree.gss', source: [
      '.icon { color: black; display: block; width: 80px; height: 30px; margin-left: 0; }',
      '.icon::before { content: "before"; color: green; display: block; width: 11px; height: 7px; padding-left: 0; }',
      '.icon::after { content: "after"; color: blue; display: block; width: 13px; height: 9px; }',
      '.icon:disabled::after { content: "disabled"; color: purple; }',
      '.outer .icon::before { color: red; }',
      '.middle .icon::before { padding-left: 5px; }',
      '.outer .middle .icon::before { color: blue; }',
      '.outer .middle .extra .icon .leaf { color: black; }'
    ].join('\n') }],
    nodes: [
      { id: 'outer', moduleId: 'PseudoTree.gss', path: ['outer'], expected: {} },
      { id: 'middle', parent: 'outer', moduleId: 'PseudoTree.gss', path: ['outer', 'middle'], expected: {} },
      { id: 'extra', parent: 'middle', moduleId: 'PseudoTree.gss', path: ['outer', 'middle', 'extra'], expected: {} },
      { id: 'pseudo-target', parent: 'extra', tag: 'button', moduleId: 'PseudoTree.gss', path: ['outer', 'middle', 'extra', 'icon'],
        expected: host, pseudoExpected: deepPseudos },
      { id: 'leaf', parent: 'pseudo-target', tag: 'span', moduleId: 'PseudoTree.gss', path: ['outer', 'middle', 'extra', 'icon', 'leaf'],
        expected: { color: 'rgb(0, 0, 0)' } },
      { id: 'direct-pseudo', parent: 'outer', tag: 'button', moduleId: 'PseudoTree.gss', path: ['outer', 'icon'], expected: host, pseudoExpected: directPseudos },
      { id: 'standalone-pseudo', tag: 'button', moduleId: 'PseudoTree.gss', path: ['icon'], expected: host, pseudoExpected: standalonePseudos }
    ],
    phases: [
      { name: 'disabled-entered', changes: [{ node: 'pseudo-target', disabled: true }], expected: treeExpected,
        pseudoExpected: { ...treePseudos, 'pseudo-target': { ...deepPseudos,
          '::after': { ...after, content: '"disabled"', color: 'rgb(128, 0, 128)' } } } },
      { name: 'disabled-exited', changes: [{ node: 'pseudo-target', disabled: false }], expected: treeExpected, pseudoExpected: treePseudos }
    ]
  }
];


function pseudoPriorityFixture(reverse: boolean, important: boolean): ReferenceFixture {
  const moduleId = 'PseudoPriority.gss';
  const priority = [
    `.icon:disabled::before { color: blue${important ? ' !important' : ''}; }`,
    '.outer .middle .icon::before { content: "before"; color: red; }'
  ];
  const host = { color: 'rgb(0, 0, 0)' };
  const expected = { deep: host, unrelated: host, standalone: host };
  const initial: PseudoExpectations = {
    '::before': { content: '"before"', color: 'rgb(255, 0, 0)' },
    '::after': { content: '"after"', color: 'rgb(0, 128, 0)' }
  };
  const disabled: PseudoExpectations = {
    '::before': { content: '"before"', color: 'rgb(0, 0, 255)' },
    '::after': { content: '"after"', color: 'rgb(128, 0, 128)' }
  };
  const restored = { deep: initial, unrelated: initial, standalone: initial };
  return {
    name: `pseudo-authored-priority-${reverse ? 'reverse' : 'forward'}-${important ? 'important' : 'normal'}`,
    modules: [{ id: moduleId, source: [
      '.icon { color: black; }',
      // Identical red declarations at different priorities must not strengthen the standalone atom.
      '.icon::before { content: "before"; color: red; display: block; }',
      '.icon::after { content: "after"; color: green; display: block; }',
      '.icon:disabled::after { color: purple; }',
      ...(reverse ? priority.reverse() : priority),
      '.unrelated .icon { color: black; }'
    ].join('\n') }],
    nodes: [
      { id: 'outer', moduleId, path: ['outer'], expected: {} },
      { id: 'middle', parent: 'outer', moduleId, path: ['outer', 'middle'], expected: {} },
      { id: 'deep', parent: 'middle', tag: 'button', moduleId, path: ['outer', 'middle', 'icon'], expected: host, pseudoExpected: initial },
      { id: 'other', moduleId, path: ['unrelated'], expected: {} },
      { id: 'unrelated', parent: 'other', tag: 'button', moduleId, path: ['unrelated', 'icon'], expected: host, pseudoExpected: initial },
      { id: 'standalone', tag: 'button', moduleId, path: ['icon'], expected: host, pseudoExpected: initial }
    ],
    phases: [
      { name: 'disabled-entered', changes: ['deep', 'unrelated', 'standalone'].map((node) => ({ node, disabled: true })), expected,
        pseudoExpected: { deep: { ...disabled, '::before': important ? disabled['::before']! : initial['::before']! }, unrelated: disabled, standalone: disabled } },
      { name: 'disabled-restored', changes: ['deep', 'unrelated', 'standalone'].map((node) => ({ node, disabled: false })), expected,
        pseudoExpected: restored }
    ]
  };
}
