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

  it('uses the supplied modern target for the bounded result', () => {
    const session = createGssCompilerSession({ projectRoot: '/project',
      compatibilityTargetStages: [{ safari: '17.0' }] });
    expect(session.replaceStylesheet({ id, source: '.card { display: flex; }' }).committed).toBe(true);
    expect(session.finalize().css).toContain('display: flex;');
    expect(session.finalize().css).not.toContain('display: -webkit-');
  });

  it.each([
    [{ chrome: '40.0' }, 'display: flex;'],
    [{ firefox: '30.0' }, 'display: flex;'],
    [{ ios_saf: '9.0' }, 'display: flex;']
  ])('supports the bounded host target families without ambient discovery: %j', (target, expected) => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: [target] });
    expect(session.replaceStylesheet({ id, source: '.card { display: flex; }' })).toMatchObject({
      committed: true, module: { compilationMode: 'atomic' }
    });
    expect(session.finalize().css).toContain(expected);
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

  it('isolates compatibility preserved fallback to one Module in a multi-Module census', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari });
    expect(session.replaceStylesheet({ id: '/project/fallback.gss', source: '.card { flex-direction: column; color: red; }' })).toMatchObject({
      committed: true, module: { compilationMode: 'preserved' }
    });
    expect(session.replaceStylesheet({ id: '/project/atomic.gss', source: '.card { color: blue; }' })).toMatchObject({
      committed: true, module: { compilationMode: 'atomic' }
    });
    const snapshot = session.finalize();
    expect(snapshot.manifest.moduleDetails).toEqual([
      expect.objectContaining({ id: 'atomic.gss', compilationMode: 'atomic' }),
      expect.objectContaining({ id: 'fallback.gss', compilationMode: 'preserved' })
    ]);
    expect(snapshot.css).toContain('.gss-s--module_fallback_2e_gss--path_card');
    expect(snapshot.css).toContain('gss-a--layer_unlayered--condition_base--state_self--property_color--value_blue');
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

  it('retains transformed preserved fallback declarations alongside bound Assets', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari });
    const result = session.replaceStylesheet({ id, source:
      '.card { flex-direction: column; background-image: url("./a.svg"); }',
      assetReferences: [{ url: './a.svg', identity: 'asset-a' }] });
    expect(result).toMatchObject({ committed: true, module: { compilationMode: 'preserved',
      fallbackReasons: [{ property: 'flex-direction', reason: 'compatibility-sequence-unatomizable' }] } });
    const snapshot = session.finalize({ resolveAssetUrl: (identity) => {
      expect(identity).toBe('asset-a');
      return '/assets/asset-a.svg';
    } });
    expect(snapshot.css).toContain('-webkit-flex-direction: column;');
    expect(snapshot.css).toContain('url("/assets/asset-a.svg")');
    expect(snapshot.manifest.moduleDetails).toEqual([expect.objectContaining({
      id: 'card.gss', compilationMode: 'preserved',
      fallbackReasons: [{ property: 'flex-direction', reason: 'compatibility-sequence-unatomizable' }]
    })]);
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

  it.each([
    [{ opera: '80.0' }],
    [{}],
    [{ safari: '256.0' }]
  ])('rejects unsupported or out-of-range host targets transactionally: %j', (target) => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: [target] });
    expect(session.replaceStylesheet({ id, source: '.card { display: flex; }' })).toMatchObject({
      committed: false, generation: 0, diagnostics: [{ code: 'GSS1101', reason: 'invalid-compatibility-target' }]
    });
    expect(session.finalize().css).toBe('');
  });

  it('retains bound Asset identity through target transformation and final URL rendering', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari });
    const result = session.replaceStylesheet({ id, source: '.card { background-image: url("./a.svg"); }',
      assetReferences: [{ url: './a.svg', identity: 'asset-a' }] });
    expect(result).toMatchObject({ committed: true, module: { compilationMode: 'atomic', dependencies: ['./a.svg'] } });
    const first = session.finalize({ resolveAssetUrl: (identity) => {
      expect(identity).toBe('asset-a');
      return '/assets/one.svg';
    } });
    const second = session.finalize({ resolveAssetUrl: (identity) => {
      expect(identity).toBe('asset-a');
      return '/assets/two.svg';
    } });
    expect(first.css).toContain('url("/assets/one.svg")');
    expect(second.css).toContain('url("/assets/two.svg")');
    expect(first.manifest.rules.map(({ className, selector, property, sources }) =>
      ({ className, selector, property, sources }))).toEqual(second.manifest.rules.map(
      ({ className, selector, property, sources }) => ({ className, selector, property, sources })));
    expect(first.css).not.toContain('./a.svg');
  });

  it('preserves target-expanded keyframe resources and their references', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari });
    const result = session.replaceStylesheet({ id, source:
      '@keyframes move { to { opacity: 1; } } .card { animation-name: move; }' });
    expect(result).toMatchObject({ committed: true });
    const css = session.finalize().css;
    expect(css).toContain('@-webkit-keyframes');
    expect(css).toContain('@keyframes');
    expect(css).toContain('-webkit-animation-name:');
    expect(css).not.toContain('animation-name: move;');
    expect(session.finalize().manifest.resources).toHaveLength(1);
  });

  it('keeps prefixed resource pairs stable across ordered host stages', () => {
    const session = createGssCompilerSession({ projectRoot: '/project',
      compatibilityTargetStages: [{ safari: '17.0' }, { safari: '6.0' }] });
    const result = session.replaceStylesheet({ id, source:
      '@keyframes move { to { opacity: 1; } } .card { animation-name: move; }' });
    expect(result.committed).toBe(true);
    const css = session.finalize().css;
    expect(css).toContain('@-webkit-keyframes');
    expect(css).toContain('@keyframes');
  });

  it('keeps target-expanded keyframe Assets isolated across Modules and cleans them up', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari });
    const source = (url: string) =>
      `@keyframes move { to { background-image: url("${url}"); } } .card { animation-name: move; }`;
    expect(session.replaceStylesheet({ id: '/project/a.gss', source: source('./a.svg'),
      assetReferences: [{ url: './a.svg', identity: 'asset-a' }] }).committed).toBe(true);
    expect(session.replaceStylesheet({ id: '/project/b.gss', source: source('./b.svg'),
      assetReferences: [{ url: './b.svg', identity: 'asset-b' }] }).committed).toBe(true);

    let snapshot = session.finalize({ resolveAssetUrl: (identity) => `/assets/${identity}.svg` });
    expect(snapshot.manifest.resources).toHaveLength(2);
    expect(snapshot.css).toContain('url("/assets/asset-a.svg")');
    expect(snapshot.css).toContain('url("/assets/asset-b.svg")');
    expect(snapshot.css).toContain('-webkit-animation-name:');
    expect(snapshot.manifest.resources.map(({ sources }) => sources)).toEqual([['a.gss'], ['b.gss']]);

    expect(session.invalidate('/project/a.gss')).toMatchObject({ changed: true });
    snapshot = session.finalize({ resolveAssetUrl: (identity) => `/assets/${identity}.svg` });
    expect(snapshot.manifest.resources).toHaveLength(1);
    expect(snapshot.manifest.resources[0]?.sources).toEqual(['b.gss']);
    expect(snapshot.css).not.toContain('asset-a.svg');
    expect(snapshot.css).toContain('asset-b.svg');
  });

  it('preserves registered condition wrappers around target-expanded keyframe Assets', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari,
      conditions: { media: ['(min-width: 1px)'] } });
    const result = session.replaceStylesheet({ id, source: `
      @media (min-width: 1px) {
        @keyframes move { to { background-image: url("./a.svg"); } }
      }
      .card { animation-name: move; }
    `, assetReferences: [{ url: './a.svg', identity: 'asset-a' }] });
    expect(result.committed).toBe(true);
    let snapshot = session.finalize({ resolveAssetUrl: () => '/assets/asset-a.svg' });
    const mediaBlock = snapshot.css.slice(snapshot.css.indexOf('@media (min-width: 1px)'));
    expect(mediaBlock).toContain('@media (min-width: 1px) {\n  @-webkit-keyframes');
    expect(mediaBlock).toContain('    background-image: url("/assets/asset-a.svg");');
    expect(snapshot.manifest.resources).toHaveLength(1);

    expect(session.invalidate(id)).toMatchObject({ changed: true });
    snapshot = session.finalize({ resolveAssetUrl: () => '/assets/asset-a.svg' });
    expect(snapshot.css).toBe('');
    expect(snapshot.manifest.resources).toHaveLength(0);
  });

  it.each([undefined, oldSafari])('rejects duplicate conditional keyframe names before identity sorting (%s)', (stages) => {
    const session = createGssCompilerSession({ projectRoot: '/project',
      conditions: { media: ['(min-width: 0px)', '(max-width: 1000px)'] },
      ...(stages ? { compatibilityTargetStages: stages } : {}) });
    expect(session.replaceStylesheet({ id, source: '.card { color: red; }' }).committed).toBe(true);
    const previous = session.finalize();
    const result = session.replaceStylesheet({ id, source: `
      @media (min-width: 0px) { @keyframes spin { to { opacity: 0; } } }
      @media (max-width: 1000px) { @keyframes spin { to { opacity: 1; } } }
      .card { animation-name: spin; }
    ` });
    expect(result).toMatchObject({ committed: false, generation: 1,
      diagnostics: [{ code: 'GSS1301', reason: 'conflicting-global-resource' }] });
    expect(session.finalize()).toEqual(previous);
  });

  it('retains target-expanded font and custom-property resources', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari });
    const result = session.replaceStylesheet({ id, source:
      '@font-face { font-family: "X"; src: url("./x.woff2") format("woff2"); } @property --theme { syntax: "<color>"; inherits: false; initial-value: red; } .card { color: var(--theme); }',
      assetReferences: [{ url: './x.woff2', identity: 'font-x' }] });
    expect(result).toMatchObject({ committed: true });
    const css = session.finalize({ resolveAssetUrl: () => '/assets/x.woff2' }).css;
    expect(css).toContain('@font-face');
    expect(css).toContain('url("/assets/x.woff2")');
    expect(css).toContain('@property --theme');
    expect(css).toContain('color: var(--theme);');
    expect(session.finalize({ resolveAssetUrl: () => '/assets/x.woff2' }).manifest.resources).toHaveLength(2);
  });

  it('rejects unproved preserved selectors with target-expanded resources or Assets without partial output', () => {
    const session = createGssCompilerSession({ projectRoot: '/project', compatibilityTargetStages: oldSafari });
    expect(session.replaceStylesheet({ id, source: '.card { color: red; }' }).committed).toBe(true);
    const previous = session.finalize();
    for (const input of [
      { id, source: '@keyframes move { to { opacity: 1; } } .card:not(:global(.external)) { flex-direction: column; animation-name: move; }' },
      { id, source: '.card:not(:global(.external)) { flex-direction: column; background-image: url("./a.svg"); }',
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
