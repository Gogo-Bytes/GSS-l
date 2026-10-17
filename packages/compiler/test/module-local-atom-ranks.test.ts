import { describe, expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

const forward = '.button:hover { background-color: red; } .button[aria-pressed="true"] { background-color: blue; }';
const reverse = '.button[aria-pressed="true"] { background-color: blue; } .button:hover { background-color: red; }';

function compile(source: string) {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  expect(session.replaceStylesheet({ id: '/project/A.gss', source })).toMatchObject({ committed: true, diagnostics: [] });
  return session;
}

// Public session seam: CSS/manifest emission order and exported classes, never planner internals.
function values(session: ReturnType<typeof compile>, target = 'button', id = '/project/A.gss') {
  const classes = session.getScopeSchema(id)!.exports[target]!.selfClassName.split(' ');
  return session.finalize().manifest.rules.filter((rule) => classes.includes(rule.className) && rule.property === 'background-color').map((rule) => rule.value);
}

describe('module-local atom rank versions', () => {
  it('admits current hover/pressed ties in authored order without changing base specificity', () => {
    const base = '.button { background-color: gray; } ';
    expect(values(compile(base + forward))).toEqual(['gray', 'red', 'blue']);
    expect(values(compile(base + reverse))).toEqual(['gray', 'blue', 'red']);
  });
});

describe('rank closure, isolation and reuse through the public session', () => {
  it('orders three live predicates and prunes only repeated closed predicates', () => {
    const source = '.button:hover { background-color: pink; } ' + forward + ' .button:focus { background-color: green; }';
    expect(values(compile(source))).toEqual(['red', 'blue', 'green']);
  });

  it('ranks both-important ties without modifying native importance', () => {
    const session = compile(forward.replaceAll(';', ' !important;'));
    expect(values(session)).toEqual(['red', 'blue']);
    expect(session.finalize().manifest.rules.every((rule) => rule.important)).toBe(true);
  });

  it('preserves asymmetric importance and stronger specificity while versioning competing normal effects', () => {
    const session = compile(forward.replace('red;', 'red !important;') + ' .root .button:focus { background-color: green; }');
    expect(session.finalize().css).toContain('--rank_');
    const strong = session.finalize().manifest.rules.find((rule) => rule.value === 'green')!;
    expect(strong.selector.split(`.${strong.className}`).length - 1).toBe(2);
    expect(session.finalize().manifest.rules.find((rule) => rule.value === 'red')!.important).toBe(true);
  });

  it('includes an equal-specificity base competitor instead of leaving an unranked class active', () => {
    const session = compile(forward + ' .root .button { background-color: green; }');
    const classes = session.getScopeSchema('/project/A.gss')!.exports.root!.targets.button!.selfClassName.split(' ');
    const rules = session.finalize().manifest.rules.filter((rule) => classes.includes(rule.className));
    expect(rules.map((rule) => rule.value)).toEqual(['red', 'blue', 'green']);
    expect(rules.every((rule) => rule.className.includes('--rank_'))).toBe(true);
    expect(rules.at(-1)!.selector).toBe(`.${rules.at(-1)!.className}.${rules.at(-1)!.className}`);
  });

  it('orders module-wide occurrences without conflating repeated semantics at later ordinals', () => {
    const source = forward.replaceAll('button', 'a') + reverse.replaceAll('button', 'b') +
      forward.replaceAll('button', 'same') + '.alone:hover { background-color: red; }';
    const session = compile(source);
    expect(values(session, 'a')).toEqual(['red', 'blue']);
    expect(values(session, 'b')).toEqual(['blue', 'red']);
    const schema = session.getScopeSchema('/project/A.gss')!;
    expect(schema.exports.a!.selfClassName).not.toBe(schema.exports.same!.selfClassName);
    expect(schema.exports.alone!.selfClassName).toContain('--rank_');
    expect(session.finalize().manifest.rules).toHaveLength(7);
  });

  it('keeps version identities stable when unrelated rules shift authored ordinals', () => {
    const session = compile(forward);
    const classes = session.getScopeSchema('/project/A.gss')!.exports.button!.selfClassName;
    expect(session.replaceStylesheet({ id: '/project/A.gss', source: '.unrelated { width: 7px; } ' + forward }).committed).toBe(true);
    expect(session.getScopeSchema('/project/A.gss')!.exports.button!.selfClassName).toBe(classes);
    expect(values(session)).toEqual(['red', 'blue']);
  });

  it('shares versions across modules without depending on registration order', () => {
    const make = (ids: string[]) => {
      const session = createGssCompilerSession({ projectRoot: '/project' });
      for (const name of ids) expect(session.replaceStylesheet({ id: `/project/${name}.gss`, source: name === 'B' ? reverse : forward }).committed).toBe(true);
      return session;
    };
    const session = make(['A', 'B', 'C']);
    expect(values(session)).toEqual(['red', 'blue']);
    expect(values(session, 'button', '/project/B.gss')).toEqual(['blue', 'red']);
    expect(session.getScopeSchema('/project/A.gss')!.exports.button!.selfClassName).toBe(session.getScopeSchema('/project/C.gss')!.exports.button!.selfClassName);
    expect(session.finalize()).toEqual(make(['C', 'B', 'A']).finalize());
    expect(session.finalize().manifest.rules).toHaveLength(4);
  });
});

const unsupported = [
  { name: 'other property', source: forward.replaceAll('background-color', 'color'), message: 'Coactive descendant conditions assign ambiguous color on button.' },
  { name: 'media band', source: `@media (min-width: 1px) { ${forward} }` },
  { name: 'layer band', source: `@layer theme { ${forward} }` },
  { name: 'functional refinement', source: forward + ' .button:where(:focus) { background-color: green; }' },
  { name: 'is refinement', source: forward + ' .button:is(:focus) { background-color: green; }' },
  { name: 'compound refinement', source: forward + ' .button:hover:focus { background-color: green; }' },
  { name: 'unapproved live state', source: forward + ' .button:active { background-color: green; }' },
  { name: 'ancestor', source: forward + ' .root:hover .button { background-color: green; }', target: 'root.button' },
  { name: 'runtime relation', source: forward + ' .root > .button { background-color: green; }', target: 'root.button' },
  { name: 'observation', source: forward + ' .button:has(.child) { background-color: green; }' },
  { name: 'shorthand', source: forward + ' .button { background: green; }' },
  { name: 'pseudo competitor', source: forward + ' .button::before { background-color: green; }' },
  { name: 'different-anchor external background', source: forward + ' .root :global([aria-pressed="true"]) { background-color: green; }' },
  { name: 'different-anchor external shorthand', source: forward + ' .root :global([aria-pressed="true"]) { background: green; }' }
];

describe.each(['error', 'preserve-module'] as const)('bounded rank rejection under %s fallback', (atomizationFallback) => {
  it('allows a noncompeting external property on a different anchor', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', atomizationFallback });
    expect(session.replaceStylesheet({ id: '/project/A.gss', source: forward +
      ' .root :global([aria-pressed="true"]) { color: green; }' })).toMatchObject({ committed: true, diagnostics: [] });
    expect(values(session)).toEqual(['red', 'blue']);
    expect(session.finalize().manifest.rules.some((rule) => rule.property === 'color' && rule.value === 'green')).toBe(true);
  });

  it.each(['background-color', 'background'])('keeps previously admitted external %s input without a rank seed', (property) => {
    const session = createGssCompilerSession({ projectRoot: '/project', atomizationFallback });
    expect(session.replaceStylesheet({ id: '/project/A.gss', source:
      `.button:hover { background-color: red; } .root :global([aria-pressed="true"]) { ${property}: green; }`
    })).toMatchObject({ committed: true, diagnostics: [] });
    expect(session.finalize().css).toContain('--rank_');
    expect(session.finalize().manifest.rules.map((rule) => rule.value)).toEqual(['red', 'green']);
  });

  it('preserves the earlier external-selector validation diagnostic', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', atomizationFallback });
    expect(session.replaceStylesheet({ id: '/project/A.gss', source: forward }).committed).toBe(true);
    const before = session.finalize();
    const result = session.replaceStylesheet({ id: '/project/A.gss', source: forward +
      ' .root:hover :global([aria-pressed="true"]) { background-color: green; }' });
    expect(result.committed).toBe(false);
    expect(result.diagnostics).toEqual([{
      code: 'GSS1101', severity: 'error', phase: 'validate', id: '/project/A.gss', reason: 'capability-not-registered',
      message: 'External targets currently require a pure owned descendant path and an external class descendant.'
    }]);
    expect(session.finalize()).toEqual(before);
  });

  it.each(unsupported)('preserves exact GSS1205 and last-good state: $name', ({ source, message, target }) => {
    const session = createGssCompilerSession({ projectRoot: '/project', atomizationFallback });
    expect(session.replaceStylesheet({ id: '/project/A.gss', source: forward }).committed).toBe(true);
    const before = session.finalize();
    const schema = session.getScopeSchema('/project/A.gss');
    const result = session.replaceStylesheet({ id: '/project/A.gss', source });
    expect(result.committed).toBe(false);
    expect(result.diagnostics).toEqual([{
      code: 'GSS1205', severity: 'error', phase: 'resolve', id: '/project/A.gss', reason: 'ambiguous-coactive-state-conflict',
      message: message ?? `Coactive descendant conditions assign ambiguous background-color on ${target ?? 'button'}.`
    }]);
    expect(session.finalize()).toEqual(before);
    expect(session.getScopeSchema('/project/A.gss')).toEqual(schema);
  });
});

it('converges actual replacement/deletion/invalidation histories including maps, schema and relocation', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const live = new Map<string, string>();
  const view = (compiler: typeof session, root: string) => {
    const { generation: _generation, ...snapshot } = compiler.finalize();
    void _generation;
    return { snapshot, schemas: [...live.keys()].sort().map((id) => compiler.getScopeSchema(`${root}/${id}`)) };
  };
  const assertClean = () => {
    for (const root of ['/project', '/relocated']) {
      const clean = createGssCompilerSession({ projectRoot: root });
      for (const [id, source] of [...live].reverse()) expect(clean.replaceStylesheet({ id: `${root}/${id}`, source }).committed).toBe(true);
      expect(view(session, '/project')).toEqual(view(clean, root));
    }
  };
  const replace = (id: string, source: string) => {
    expect(session.replaceStylesheet({ id: `/project/${id}`, source }).committed).toBe(true);
    live.set(id, source); assertClean();
  };
  replace('A.gss', forward);
  replace('B.gss', reverse);
  replace('A.gss', reverse);
  replace('A.gss', reverse.replace('red', 'purple'));
  replace('A.gss', '.unrelated { width: 3px; } ' + forward);
  replace('A.gss', '.button:hover { background-color: red; }');
  replace('A.gss', forward);
  session.invalidate('/project/B.gss'); live.delete('B.gss'); assertClean();
  replace('B.gss', reverse);
  session.invalidate('/project/A.gss'); live.delete('A.gss'); assertClean();
  session.invalidate('/project/B.gss'); live.delete('B.gss'); assertClean();
  expect(session.finalize().manifest.rules).toEqual([]);
  replace('A.gss', forward);
});
