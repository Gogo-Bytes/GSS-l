import { describe, expect, it } from 'vitest';
import { createGssCompilerSession, type GssCompilerConfig, type ReplaceStylesheetInput } from '../src/index.js';

const root = '/project';
const sources = {
  'a.gss': [
    '@font-face { font-family: Example; src: url("./face.woff2"); } .card { color: red; }',
    '.card { color: blue; }'
  ],
  'b.gss': [
    '@font-face { font-family: Example; src: url("./face.woff2"); } .badge { color: red; }',
    '.badge { padding-left: 2px; }'
  ],
  'c.gss': [
    '@keyframes pulse { to { opacity: 1; } } .motion { animation-name: pulse; }',
    '.motion { opacity: 0.5; }'
  ],
  'd.gss': [
    '.fallback { unregistered-shorthand: value; color: green; }',
    '.fallback { color: green; }'
  ]
} as const;

type ModuleId = keyof typeof sources;
const ids = Object.keys(sources).sort() as ModuleId[];
const invalid = '.broken { color: red; color: blue; }';

function random(seed: number): () => number {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
}

function withoutGeneration(snapshot: ReturnType<ReturnType<typeof createGssCompilerSession>['finalize']>) {
  return { css: snapshot.css, manifest: snapshot.manifest, report: snapshot.report };
}

const assetCensus: readonly (readonly Omit<ReplaceStylesheetInput, 'id'>[])[] = [
  [
    { source: '@font-face { font-family: Bound; src: url("./face.woff2"); } .card { display: flex; }',
      assetReferences: [{ url: './face.woff2', identity: 'fonts/shared.woff2' }] },
    { source: '.card { background-image: url("./image.svg"); }',
      assetReferences: [{ url: './image.svg', identity: 'images/one.svg' }] }
  ],
  [
    { source: '@font-face { font-family: Bound; src: url("../alias.woff2"); } .badge { color: red; }',
      assetReferences: [{ url: '../alias.woff2', identity: 'fonts/shared.woff2' }] },
    { source: '@font-face { font-family: Other; src: url("./other.woff2"); } .badge { color: blue; }',
      assetReferences: [{ url: './other.woff2', identity: 'fonts/other.woff2' }] }
  ],
  [
    { source: '@keyframes pulse { to { background-image: url("./frame.svg"); } } .motion { animation-name: pulse; }',
      assetReferences: [{ url: './frame.svg', identity: 'images/frame.svg' }] },
    { source: '.motion { opacity: 0.5; }' }
  ],
  [
    { source: '.fallback { flex-direction: column; background-image: url("./image.svg"); }',
      assetReferences: [{ url: './image.svg', identity: 'images/one.svg' }] },
    { source: '.fallback { display: flex; }' }
  ],
  [
    { source: '@property --tone { syntax: "<color>"; inherits: false; initial-value: red; } .tone { color: var(--tone); }' },
    { source: '.tone { color: green; }' }
  ],
  [
    { source: '@property --tone { syntax: "<color>"; inherits: false; initial-value: red; } .theme { color: var(--tone); }' },
    { source: '.theme { background-image: url("../alias.svg"); }',
      assetReferences: [{ url: '../alias.svg', identity: 'images/one.svg' }] }
  ]
];

const targetCases = [
  { name: 'Safari 6', stages: [{ safari: '6.0' }] },
  { name: 'Safari 17', stages: [{ safari: '17.0' }] },
  { name: 'ordered modern/old', stages: [{ safari: '17.0' }, { safari: '6.0' }] }
];

describe.each(targetCases)('target-aware bound resource census: $name', ({ stages }) => {
  it.each([7, 19, 101, 4099])('converges after every mutation with seed %i', (seed) => {
    const config: GssCompilerConfig = { projectRoot: root, compatibilityTargetStages: stages };
    const session = createGssCompilerSession(config);
    const live = new Map<number, Omit<ReplaceStylesheetInput, 'id'>>();
    const visited = new Set<string>();
    const actions = new Set<number>();
    const next = random(seed);
    let generation = 0;
    for (let step = 0; step < 240; step++) {
      const slot = (next() >>> 16) % assetCensus.length;
      const id = `${root}/${slot}.gss`;
      const action = (next() >>> 16) % 5;
      actions.add(action);
      if (action === 0) {
        const changed = live.delete(slot);
        if (changed) generation++;
        expect(session.invalidate(id)).toEqual({ id, changed, generation });
      } else if (action === 1 || action === 2) {
        const previous = session.finalize({ resolveAssetUrl: (identity) => `/one/${identity}` });
        const failed = session.replaceStylesheet(action === 1
          ? { id, source: '@property --leak { syntax: "<color>"; inherits: false; initial-value: blue; } ' + invalid }
          : { id, source: '.bad { background-image: url("bad.svg"); }', assetReferences: [
            { url: 'bad.svg', identity: 'bad-one.svg' }, { url: 'bad.svg', identity: 'bad-two.svg' }
          ] });
        expect(failed).toMatchObject({ committed: false, generation,
          diagnostics: [{ code: action === 1 ? 'GSS1204' : 'GSS1501' }] });
        expect(session.finalize({ resolveAssetUrl: (identity) => `/one/${identity}` })).toEqual(previous);
      } else {
        const variant = (next() >>> 16) % 2;
        const input = assetCensus[slot]![variant]!;
        visited.add(`${slot}:${variant}`);
        expect(session.replaceStylesheet({ id, ...input })).toMatchObject({ committed: true, generation: ++generation });
        live.set(slot, input);
      }

      // Reverse order is deliberately different from the mutation-history census.
      const clean = createGssCompilerSession(config);
      for (const [slot, input] of [...live].sort(([a], [b]) => b - a)) {
        expect(clean.replaceStylesheet({ id: `${root}/${slot}.gss`, ...input }).committed).toBe(true);
      }
      for (const deployment of ['one', 'two']) {
        const resolved: string[] = [];
        const snapshot = session.finalize({ resolveAssetUrl: (identity) => {
          resolved.push(identity);
          return `/${deployment}/${identity}`;
        } });
        expect(snapshot.generation).toBe(generation);
        expect(withoutGeneration(snapshot)).toEqual(withoutGeneration(clean.finalize({
          resolveAssetUrl: (identity) => `/${deployment}/${identity}`
        })));
        const assets = [...new Set([...live.values()].flatMap((input) =>
          (input.assetReferences ?? []).map(({ identity }) => identity)))].sort();
        expect(resolved.sort()).toEqual(assets);
        expect(snapshot.css).not.toContain('--leak');
        expect(snapshot.css).not.toContain('bad-one.svg');
      }
      for (const [slot] of live) {
        expect(session.getScopeSchema(`${root}/${slot}.gss`)).toEqual(clean.getScopeSchema(`${root}/${slot}.gss`));
      }
    }
    expect([...actions].sort()).toEqual([0, 1, 2, 3, 4]);
    expect(visited.size).toBe(assetCensus.length * 2);
    for (const slot of live.keys()) session.invalidate(`${root}/${slot}.gss`);
    expect(session.finalize().css).toBe('');
    expect(session.finalize().manifest.resources).toEqual([]);
  });
});

describe('full-census snapshot convergence through the public session', () => {
  it.each([1, 7, 19, 37, 101, 4099])('rebuilds the same live set after seeded mutation history %i', (seed) => {
    const next = random(seed);
    const session = createGssCompilerSession({ projectRoot: root });
    const live = new Map<ModuleId, string>();
    const visited = new Set<ModuleId>();
    const actions = new Set<number>();
    let generation = 0;

    for (let step = 0; step < 36; step++) {
      const name = ids[(next() >>> 16) % ids.length]!;
      const id = `${root}/${name}`;
      const action = (next() >>> 16) % 5;
      visited.add(name);
      actions.add(action);
      if (action === 0) {
        const result = session.invalidate(id);
        const changed = live.delete(name);
        if (changed) generation++;
        expect(result).toMatchObject({ changed, generation });
      } else {
        const source = action === 1 ? invalid : sources[name][(next() >>> 16) % sources[name].length]!;
        const result = session.replaceStylesheet({ id, source });
        if (source === invalid) {
          expect(result).toMatchObject({ committed: false, generation, diagnostics: [{ code: 'GSS1204' }] });
        } else {
          expect(result).toMatchObject({
            committed: true,
            diagnostics: source.includes('unregistered-shorthand')
              ? [{ code: 'GSS1104', reason: 'module-preserved-fallback' }] : []
          });
          live.set(name, source);
          generation++;
          expect(result.generation).toBe(generation);
        }
      }

      const clean = createGssCompilerSession({ projectRoot: root });
      for (const [moduleId, source] of [...live].sort(([left], [right]) => left.localeCompare(right))) {
        expect(clean.replaceStylesheet({ id: `${root}/${moduleId}`, source }).committed).toBe(true);
      }
      const snapshot = session.finalize();
      expect(snapshot.generation).toBe(generation);
      expect(withoutGeneration(snapshot)).toEqual(withoutGeneration(clean.finalize()));
      expect(snapshot.manifest.modules).toEqual([...live.keys()].sort());
      const fontOwners = ['a.gss', 'b.gss'].filter((moduleId) =>
        live.get(moduleId as ModuleId)?.includes('@font-face'));
      expect(snapshot.manifest.resources.filter(({ kind }) => kind === 'font-face')).toEqual(
        fontOwners.length ? [{ kind: 'font-face', name: 'Example|normal|normal|normal|all', sources: fontOwners }] : []
      );
      expect((snapshot.css.match(/@font-face/g) ?? []).length).toBe(fontOwners.length ? 1 : 0);
    }
    expect([...visited].sort()).toEqual(ids);
    expect([...actions].sort()).toEqual([0, 1, 2, 3, 4]);
  });
});
