import { expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

function compile(source: string, config: Omit<Parameters<typeof createGssCompilerSession>[0], 'projectRoot'> = {}) {
  const session = createGssCompilerSession({ projectRoot: '/project', ...config });
  expect(session.replaceStylesheet({ id: '/project/Reuse.gss', source })).toMatchObject({ committed: true, diagnostics: [] });
  return session;
}
function classes(session: ReturnType<typeof compile>, name: string) {
  return session.getScopeSchema('/project/Reuse.gss')!.exports[name]!.selfClassName;
}

it('shares adjacent identical pure occurrences at the earliest positive rank without renumbering the next competitor', () => {
  const session = compile('.a{color:red}.b{color:red}.c{color:blue}');
  expect(classes(session, 'a')).toBe(classes(session, 'b'));
  expect(classes(session, 'a')).toContain('--rank_1');
  expect(classes(session, 'c')).toContain('--rank_3');
  const rules = session.finalize().manifest.rules;
  expect(rules.map(({ value }) => value)).toEqual(['red', 'blue']);
  expect(rules[0]!.origins).toHaveLength(2);
});

it('retains unlike and interleaved writes and early-only membership', () => {
  const session = compile('.early{color:red}.middle{color:blue}.late{color:red}.last{color:red}.next{color:green}');
  expect(classes(session, 'early')).not.toBe(classes(session, 'late'));
  expect(classes(session, 'late')).toBe(classes(session, 'last'));
  expect(classes(session, 'early')).toContain('--rank_1');
  expect(classes(session, 'late')).toContain('--rank_3');
  expect(classes(session, 'next')).toContain('--rank_5');
  expect(session.finalize().manifest.rules.map(({ value }) => value)).toEqual(['red', 'blue', 'red', 'green']);
});

it.each(['.a,.b:hover', '.b:hover,.a', '.a,.b[aria-pressed="true"]', '.b[aria-pressed="true"],.a'])('treats every branch of %s as a whole-bucket barrier', (branches) => {
  const session = compile(`${branches}{color:red}.c{color:red}.d{color:red}`);
  expect(classes(session, 'a')).not.toBe(classes(session, 'c'));
  expect(classes(session, 'c')).toBe(classes(session, 'd'));
  expect(classes(session, 'c')).toContain('--rank_2');
});

it('shares whole pure comma buckets while aggregating all origins', () => {
  const session = compile('.a,.b{color:red}.c,.d{color:red}.e{color:blue}');
  for (const name of ['b', 'c', 'd']) expect(classes(session, name)).toBe(classes(session, 'a'));
  expect(classes(session, 'e')).toContain('--rank_3');
  expect(session.finalize().manifest.rules).toHaveLength(2);
  expect(session.finalize().manifest.rules[0]!.origins).toHaveLength(2);
});

it.each([
  '.a:hover{color:red}.b:hover{color:red}',
  '.a[aria-pressed="true"]{color:red}.b[aria-pressed="true"]{color:red}',
  '.a::before{color:red}.b::before{color:red}',
  '.root .a{color:red}.root .b{color:red}',
  '.root:hover .a{color:red}.root:hover .b{color:red}',
  '.root > .a{color:red}.root > .b{color:red}',
  '.a:has(> .flag){color:red}.b:has(> .flag){color:red}',
  '@media (min-width:1px){.a{color:red}.b{color:red}}',
  '@supports (display:grid){.a{color:red}.b{color:red}}',
  '@container (min-width:1px){.a{color:red}.b{color:red}}'
])('does not contract contextual, owned, runtime, pseudo or wrapped occurrences: %s', (source) => {
  const session = compile(source, { conditions: { media: ['(min-width:1px)'], supports: ['(display:grid)'], container: ['(min-width:1px)'] } });
  expect(session.finalize().manifest.rules.filter(({ property }) => property === 'color')).toHaveLength(2);
});

it('keeps layer, importance and pseudo bands separate and preserves native specificity', () => {
  const session = compile('@layer first{.a{color:red}.b{color:red!important}.c::before{color:red}.d:disabled{color:blue}}@layer second{.e{color:red}.f{color:red}}', { layers: ['first', 'second'] });
  expect(classes(session, 'a')).not.toBe(classes(session, 'b'));
  expect(classes(session, 'a')).not.toBe(classes(session, 'c'));
  expect(classes(session, 'a')).not.toBe(classes(session, 'e'));
  expect(classes(session, 'e')).toBe(classes(session, 'f'));
  expect(session.finalize().manifest.rules.find(({ value }) => value === 'blue')!.selector).toContain(':disabled');
  expect(session.finalize().manifest.rules.find(({ important }) => important)!.value).toBe('red');
});

const directionalProperties = ['margin', 'padding', 'inset', 'scroll-margin', 'scroll-padding'].flatMap((family) => [
  family, ...['top', 'right', 'bottom', 'left'].map((side) => family === 'inset' ? side : `${family}-${side}`),
  ...['inline', 'block'].flatMap((axis) => [`${family}-${axis}`, `${family}-${axis}-start`, `${family}-${axis}-end`])
]);
it.each(directionalProperties)('never compresses directional property %s', (property) => {
  const session = compile(`.a{${property}:1px}.b{${property}:1px}`);
  expect(classes(session, 'a')).toContain('--rank_1');
  expect(classes(session, 'b')).toContain('--rank_2');
  expect(session.finalize().manifest.rules).toHaveLength(2);
});

it.each([
  '.b{margin-left:2px}.c{margin-inline-start:1px}',
  '.a{margin-inline-start:1px}.b{margin-left:2px}.c{margin-inline-start:1px}.d{margin-left:3px}'
])('retains fixed physical priority and both logical/physical writes: %s', (source) => {
  const session = compile(source);
  const selected = new Set(`${classes(session, 'b')} ${classes(session, 'c')}`.split(' '));
  expect(session.finalize().manifest.rules.filter(({ className }) => selected.has(className)).map(({ value }) => value)).toEqual(['1px', '2px']);
});

it('does not canonicalize different value spellings into a reusable run', () => {
  const session = compile('.a{color:red}.b{color:#ff0000}.c{color:red}');
  expect(session.finalize().manifest.rules.map(({ value }) => value)).toEqual(['red', '#ff0000', 'red']);
});

it('keeps source-sensitive asset identities while sharing only identical module-local spelling', () => {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  for (const [id, identity] of [['A', 'asset-a'], ['B', 'asset-b']]) {
    expect(session.replaceStylesheet({ id: `/project/${id}.gss`, source: '.a{background-image:url("./icon.png")}.b{background-image:url("./icon.png")}', assetReferences: [{ url: './icon.png', identity: identity! }] }).committed).toBe(true);
    const exports = session.getScopeSchema(`/project/${id}.gss`)!.exports;
    expect(exports.a!.selfClassName).toBe(exports.b!.selfClassName);
  }
  expect(session.getScopeSchema('/project/A.gss')!.exports.a!.selfClassName).not.toBe(session.getScopeSchema('/project/B.gss')!.exports.a!.selfClassName);
  expect(session.finalize({ resolveAssetUrl: (identity) => `/${identity}.png` }).css).toContain('/asset-a.png');
  expect(session.finalize({ resolveAssetUrl: (identity) => `/${identity}.png` }).css).toContain('/asset-b.png');
});

it('converges reuse, schemas, origins and maps after real mutations, invalid replacement, permutations and relocation', () => {
  const sources = ['.a{color:red}.b{color:red}.c{color:blue}', '.c{color:blue}.a{color:red}.b{color:red}', '.a{color:red}.b{color:red}.c{color:green}'];
  const live = new Map<string, string>();
  const session = createGssCompilerSession({ projectRoot: '/project', atomizationFallback: 'error' });
  const view = (compiler: typeof session, root: string) => {
    const { generation: _generation, ...snapshot } = compiler.finalize(); void _generation;
    return { snapshot, schemas: [...live.keys()].sort().map((id) => compiler.getScopeSchema(`${root}/${id}`)) };
  };
  const assertClean = () => {
    const entries = [...live];
    const permutations = entries.length === 3 ? [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]] : [entries.map((_, i) => i)];
    for (const root of ['/project', '/relocated']) for (const order of permutations) {
      const clean = createGssCompilerSession({ projectRoot: root, atomizationFallback: 'error' });
      for (const index of order) {
        const [id, source] = entries[index]!;
        expect(clean.replaceStylesheet({ id: `${root}/${id}`, source }).committed).toBe(true);
      }
      expect(view(session, '/project')).toEqual(view(clean, root));
    }
  };
  for (const [id, source] of [['A.gss', sources[0]!], ['B.gss', sources[0]!], ['A.gss', sources[1]!], ['C.gss', sources[2]!]]) {
    expect(session.replaceStylesheet({ id: `/project/${id}`, source: source! }).committed).toBe(true);
    live.set(id!, source!); assertClean();
  }
  const before = view(session, '/project');
  expect(session.replaceStylesheet({ id: '/project/A.gss', source: '.a{unsupported-property:1}' }).committed).toBe(false);
  expect(view(session, '/project')).toEqual(before); assertClean();
  expect(session.invalidate('/project/B.gss').changed).toBe(true); live.delete('B.gss'); assertClean();
  expect(session.invalidate('/project/B.gss').changed).toBe(false); assertClean();
  expect(session.replaceStylesheet({ id: '/project/B.gss', source: sources[0]! }).committed).toBe(true);
  live.set('B.gss', sources[0]!); assertClean();
});

it('does not assume a single authored node has only a single uncomplicated target binding', () => {
  const session = compile('.a{color:red}.root .a{display:block}.b{color:red}.c{color:red}');
  expect(classes(session, 'a')).not.toBe(classes(session, 'b'));
  expect(classes(session, 'b')).toBe(classes(session, 'c'));
  expect(classes(session, 'b')).toContain('--rank_2');
});

it('shares identical important writes within their band without crossing a normal competitor', () => {
  const session = compile('.a{color:red!important}.b{color:red!important}.c{color:blue}');
  expect(classes(session, 'a')).toBe(classes(session, 'b'));
  expect(classes(session, 'a')).toContain('--rank_1');
  expect(session.finalize().manifest.rules.map(({ value, important }) => [value, important])).toEqual([['blue', false], ['red', true]]);
});

it('keeps equal property ranks at different output slots distinct across modules and converges after replacement', () => {
  const sources = [
    '.a{margin-left:1px}.x{margin-inline-start:2px}',
    '.b{margin-left:1px}.x{margin-inline-start:2px}.y{margin-inline-start:3px}.z{margin-inline-start:4px}'
  ];
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const replace = (index: number, source: string) => {
    expect(session.replaceStylesheet({ id: `/project/${index}.gss`, source }).committed).toBe(true);
  };
  sources.forEach((source, index) => replace(index, source));
  const a = session.getScopeSchema('/project/0.gss')!.exports.a!.selfClassName;
  const b = session.getScopeSchema('/project/1.gss')!.exports.b!.selfClassName;
  expect(a).toContain('--rank_1--order_2');
  expect(b).toContain('--rank_1--order_4');
  expect(a).not.toBe(b);
  const rules = session.finalize().manifest.rules;
  const lastLogical = rules.findIndex(({ property, value }) => property === 'margin-inline-start' && value === '4px');
  expect(rules.findIndex(({ className }) => className === b)).toBeGreaterThan(lastLogical);
  const { generation: _generation, ...before } = session.finalize(); void _generation;
  expect(session.replaceStylesheet({ id: '/project/1.gss', source: '.b{margin:1px;margin-inline-start:2px}' }).committed).toBe(false);
  const { generation: _failedGeneration, ...failed } = session.finalize(); void _failedGeneration;
  expect(failed).toEqual(before);
  replace(1, sources[0]!);
  replace(1, sources[1]!);
  const clean = createGssCompilerSession({ projectRoot: '/project' });
  for (const index of [1, 0]) expect(clean.replaceStylesheet({ id: `/project/${index}.gss`, source: sources[index]! }).committed).toBe(true);
  const { generation: _liveGeneration, ...live } = session.finalize(); void _liveGeneration;
  const { generation: _cleanGeneration, ...fresh } = clean.finalize(); void _cleanGeneration;
  expect(live).toEqual(fresh);
  expect(session.getScopeSchema('/project/1.gss')).toEqual(clean.getScopeSchema('/project/1.gss'));
});
