import { describe, expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

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
