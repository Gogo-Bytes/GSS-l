import { describe, expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

const id = '/project/card.gss';
const oldSafari = [{ safari: '6.0' }];

describe('host-resolved compatibility targets', () => {
  it('keeps a transformed declaration sequence in one semantic atom', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari });
    expect(session.replaceStylesheet({ id, source: '.card { display: flex; }' })).toMatchObject({
      committed: true, module: { compilationMode: 'atomic', fallbackReasons: [] }
    });
    const snapshot = session.finalize();
    expect(snapshot.css).toContain('{\n  display: -webkit-box;\n  display: -webkit-flex;\n  display: flex;\n}');
    expect(snapshot.manifest.rules).toHaveLength(1);
    expect(snapshot.manifest.rules[0]).toMatchObject({ property: 'display', value: 'flex' });
    expect(session.replaceStylesheet({ id, source: '.card { display: flex; }' }).committed).toBe(true);
    expect(session.finalize().css).toBe(snapshot.css);
  });

  it('uses the supplied modern target instead of ambient project or process configuration', () => {
    const session = createGssCompilerSession({ projectRoot: '/project',
      compatibilityTargetStages: [{ safari: '17.0' }] });
    expect(session.replaceStylesheet({ id, source: '.card { display: flex; }' }).committed).toBe(true);
    expect(session.finalize().css).toContain('display: flex;');
    expect(session.finalize().css).not.toContain('display: -webkit-');
  });

  it('keeps important physical alternatives together and leaves authored identity semantic', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari });
    expect(session.replaceStylesheet({ id, source: '.card { display: flex !important; }' }).committed).toBe(true);
    expect(session.finalize().css).toContain('display: -webkit-box !important;\n  display: -webkit-flex !important;\n  display: flex !important;');
    expect(session.finalize().manifest.rules).toMatchObject([{ property: 'display', value: 'flex', important: true }]);
  });

  it('keeps target-generated value fallbacks together without making their values separate atoms', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari });
    expect(session.replaceStylesheet({ id, source: '.card { background: linear-gradient(red, blue); }' }).committed).toBe(true);
    const snapshot = session.finalize();
    expect(snapshot.manifest.rules).toHaveLength(1);
    expect(snapshot.manifest.rules[0]).toMatchObject({ property: 'background', value: 'linear-gradient(red, blue)' });
    expect(snapshot.css).toContain('background: -webkit-gradient(');
    expect(snapshot.css).toContain('background: -webkit-linear-gradient(');
    expect(snapshot.css).toContain('background: linear-gradient(');
  });

  it('preserves the entire Module when a generated vendor property cannot be proved atomizable', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari });
    const result = session.replaceStylesheet({ id, source: '.card { flex-direction: column; color: red; }' });
    expect(result).toMatchObject({ committed: true, module: { compilationMode: 'preserved',
      fallbackReasons: [{ property: 'flex-direction', reason: 'compatibility-sequence-unatomizable' }] },
    diagnostics: [{ code: 'GSS1104', reason: 'module-preserved-fallback' }] });
    const css = session.finalize().css;
    expect(css).toContain('-webkit-box-orient: vertical;');
    expect(css).toContain('-webkit-flex-direction: column;');
    expect(css).toContain('flex-direction: column;');
    expect(css.indexOf('color: red;')).toBeGreaterThan(css.indexOf('flex-direction: column;'));
  });

  it.each([
    '.editor:has(:global(.external)) { flex-direction: column; }',
    '.editor:not(:global(.external)) { flex-direction: column; }'
  ])('rejects a global selector before entering unsafe preserved rendering: %s', (unsafe) => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari });
    expect(session.replaceStylesheet({ id, source: '.editor { color: red; }' }).committed).toBe(true);
    const previous = session.finalize();
    expect(session.replaceStylesheet({ id, source: unsafe })).toMatchObject({ committed: false,
      generation: 1, diagnostics: [{ code: 'GSS1101', reason: 'capability-not-registered' }] });
    expect(session.finalize()).toEqual(previous);
  });

  it('rejects an unsafe sequence in strict mode and retains last-known-good', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari,
      atomizationFallback: 'error' });
    expect(session.replaceStylesheet({ id, source: '.card { color: red; }' }).committed).toBe(true);
    const previous = session.finalize();
    expect(session.replaceStylesheet({ id, source: '.card { flex-direction: column; }' })).toMatchObject({
      committed: false, generation: 1, diagnostics: [{ code: 'GSS1101', reason: 'capability-not-registered' }]
    });
    expect(session.finalize()).toEqual(previous);
  });

  it('snapshots ordered host stages and never follows a later caller mutation', () => {
    const stages = [{ safari: '17.0' }, { safari: '6.0' }];
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: stages });
    stages[1]!.safari = '17.0';
    expect(session.replaceStylesheet({ id, source: '.card { display: flex; }' }).committed).toBe(true);
    expect(session.finalize().css).toContain('display: -webkit-box;');
  });

  it('rejects target-enabled resource and bound Asset Modules without partial output', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari });
    expect(session.replaceStylesheet({ id, source: '.card { color: red; }' }).committed).toBe(true);
    const previous = session.finalize();
    for (const input of [
      { id, source: '@keyframes move { to { opacity: 1; } } .card { animation-name: move; }' },
      { id, source: '.card { background-image: url("./a.svg"); }',
        assetReferences: [{ url: './a.svg', identity: 'asset-a' }] }
    ]) {
      expect(session.replaceStylesheet(input)).toMatchObject({ committed: false, generation: 1,
        diagnostics: [{ code: 'GSS1101', reason: 'capability-not-registered' }] });
      expect(session.finalize()).toEqual(previous);
    }
  });

  it('rejects an invalid host target transactionally rather than reading Browserslist', () => {
    const session = createGssCompilerSession({ projectRoot: '/project',
      compatibilityTargetStages: [{ safari: 'not-a-version' }] });
    expect(session.replaceStylesheet({ id, source: '.card { display: flex; }' })).toMatchObject({
      committed: false, generation: 0, diagnostics: [{ code: 'GSS1101', reason: 'invalid-compatibility-target' }]
    });
    expect(session.finalize().css).toBe('');
  });
});
