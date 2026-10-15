import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { describe, expect, it } from 'vitest';

describe('MVP playground catalog', () => {
  it('serves existing native fixtures and explicitly separate Compiler-only cases through Vite', async () => {
    const server = await createServer({
      configFile: fileURLToPath(new URL('../playground/vite.config.ts', import.meta.url)),
      logLevel: 'silent', server: { middlewareMode: true }
    });
    try {
      const { default: fixtures } = await server.ssrLoadModule('virtual:reference-fixtures');
      expect(fixtures).toHaveLength(123);
      expect(fixtures.some((fixture: { name: string }) => fixture.name === 'ownership-module-isolation')).toBe(true);
      const { default: cases } = await server.ssrLoadModule('virtual:playground-compiler');
      expect(cases).toHaveLength(110);
      expect(cases.every((entry: { level: string }) => entry.level === 'compiler-only')).toBe(true);
      expect(cases.find((entry: { id: string }) => entry.id === 'pseudo-before').committed).toBe(true);
      expect(cases.find((entry: { id: string }) => entry.id === 'duplicate-property').committed).toBe(false);
      expect(cases.find((entry: { id: string }) => entry.id === 'session-lifecycle').lifecycle.checks).toEqual({
        sharedRule: true, firstOwnerRemoval: true, rollback: true, noStaleRed: true, converged: true, finalCleanup: true
      });
      for (const pseudo of ['before', 'after', 'placeholder', 'marker', 'file-selector-button', 'backdrop', 'first-line', 'first-letter', 'selection']) {
        expect(cases.some((entry: { id: string }) => entry.id === `pseudo-${pseudo}`)).toBe(true);
      }
      for (const state of ['hover', 'focus', 'focus-visible', 'focus-within', 'active', 'disabled', 'checked']) {
        expect(cases.some((entry: { id: string }) => entry.id === `state-${state}`)).toBe(true);
        expect(cases.some((entry: { id: string }) => entry.id === `ancestor-${state}`)).toBe(true);
      }
      const { default: adapter } = await server.ssrLoadModule('virtual:playground-adapter');
      expect(adapter).toHaveLength(14);
      expect(adapter.find((entry: { id: string }) => entry.id === 'direct').code).toContain('styles.card.title.self');
      expect(adapter.find((entry: { id: string }) => entry.id === 'mutable-alias').diagnostics[0].code).toBe('GSS2103');
      expect(adapter.find((entry: { id: string }) => entry.id === 'alias-member-boundary').boundary).toContain('untouched without a diagnostic');
    } finally { await server.close(); }
  });
});
