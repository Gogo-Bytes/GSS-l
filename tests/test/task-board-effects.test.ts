import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createGssCompilerSession } from '@gss-l/compiler';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../acceptance/task-board/', import.meta.url));

describe('unchanged task-board business modules', () => {
  it('atomizes Board and lazy Detail without fallback or preserved business rules', () => {
    const session = createGssCompilerSession({ projectRoot: root });
    for (const name of ['Board.gss', 'Detail.gss']) {
      const id = `${root}${name}`;
      expect(session.replaceStylesheet({ id, source: readFileSync(id, 'utf8') })).toMatchObject({
        committed: true, diagnostics: [], module: { compilationMode: 'atomic', fallbackReasons: [] }
      });
    }
    const { manifest, report } = session.finalize();
    expect(manifest.modules).toEqual(['Board.gss', 'Detail.gss']);
    expect(manifest.moduleDetails).toHaveLength(2);
    expect(manifest.moduleDetails.every((module) => module.compilationMode === 'atomic' && module.fallbackReasons.length === 0)).toBe(true);
    expect(manifest.preservedRules).toEqual([]);
    expect(report).toMatchObject({ atomicModules: 2, preservedModules: 0, atomicCoverage: 1 });
    for (const property of ['box-shadow', 'letter-spacing', 'text-transform', 'outline-offset']) {
      expect(manifest.rules.some((rule) => rule.property === property)).toBe(true);
    }
    expect(manifest.rules.some((rule) => rule.sources.includes('Detail.gss'))).toBe(true);
  });
});
