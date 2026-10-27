import { describe, expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

const id = '/project/Motion.gss';
const media = ['(max-width: 400px)', '(min-width: 401px)', '(min-width: 400px)',
  '(max-width: 1000px)', '(min-width: 1001px)', '(min-width: 100000px)',
  '(max-width: 100001px)', '(min-width: 100002px)',
  '(max-width: 400.5px)', '(min-width: 401.5px)',
  'screen and (max-width: 400px)'];
const config = { projectRoot: '/project', layers: ['base'],
  conditions: { media, supports: ['(display: grid)'] } };
const name = 'gss-k--module_Motion_2e_gss--name_pulse';
const source = (first: string, second: string, firstWidth = 10, secondWidth = 30) => `
  @media ${first} { @keyframes pulse { from { width: ${firstWidth}px; } to { width: 20px; } } }
  @media ${second} { @keyframes pulse { from { width: ${secondWidth}px; } to { width: 40px; } } }
  .motion { animation-name: pulse; animation-duration: 1s; animation-play-state: paused; }
`;
const accepted = source('(max-width: 400px)', '(min-width: 401px)');

describe('disjoint Module-local keyframe definitions', () => {
  it('keeps both registered width wrappers and one static reference without an authored-order winner', () => {
    const session = createGssCompilerSession(config);
    const result = session.replaceStylesheet({ id, source: accepted });
    expect(result).toMatchObject({ committed: true, diagnostics: [] });
    const snapshot = session.finalize();
    expect(snapshot.css).toContain(`@media (max-width: 400px) {\n  @keyframes ${name}`);
    expect(snapshot.css).toContain(`@media (min-width: 401px) {\n  @keyframes ${name}`);
    expect(snapshot.css).toContain(`animation-name: ${name};`);
    expect(snapshot.css.match(new RegExp(`@keyframes ${name}`, 'g'))).toHaveLength(2);
    expect(snapshot.manifest.resources.filter((resource) => resource.kind === 'keyframes'))
      .toMatchObject([{ name, sources: ['Motion.gss'] }, { name, sources: ['Motion.gss'] }]);
    const origins = snapshot.manifest.resources.filter((resource) => resource.kind === 'keyframes')
      .map((resource) => resource.origins[0]?.range.start);
    expect(origins).toHaveLength(2);
    expect(new Set(origins).size).toBe(2);

    const reversed = createGssCompilerSession(config);
    expect(reversed.replaceStylesheet({ id, source: `
      @media (min-width: 401px) { @keyframes pulse { from { width: 30px; } to { width: 40px; } } }
      @media (max-width: 400px) { @keyframes pulse { from { width: 10px; } to { width: 20px; } } }
      .motion { animation-name: pulse; animation-duration: 1s; animation-play-state: paused; }
    ` }).committed).toBe(true);
    expect(reversed.finalize().css).toBe(snapshot.css);
  });

  it.each([
    ['overlap at a shared boundary', source('(max-width: 400px)', '(min-width: 400px)')],
    ['same-direction bounds', source('(max-width: 400px)', '(max-width: 1000px)')],
    ['third non-exclusive variant', `${accepted}
      @media (min-width: 1001px) { @keyframes pulse { to { width: 50px; } } }`],
    ['fractional bounds', source('(max-width: 400.5px)', '(min-width: 401.5px)')],
    ['too-large bounds', source('(max-width: 100001px)', '(min-width: 100002px)')],
    ['compound width query', source('screen and (max-width: 400px)', '(min-width: 401px)')],
    ['unregistered width query', source('(max-width: 450px)', '(min-width: 451px)')],
    ['base plus media', `@keyframes pulse { to { width: 10px; } }
      @media (min-width: 401px) { @keyframes pulse { to { width: 30px; } } }
      .motion { animation-name: pulse; }`],
    ['layered variants', `@layer base { ${accepted} }`],
    ['cross-kind conditions', `@media (max-width: 400px) { @keyframes pulse { to { width: 10px; } } }
      @supports (display: grid) { @keyframes pulse { to { width: 30px; } } }
      .motion { animation-name: pulse; }`]
  ])('keeps %s fail-closed with prior CSS, schema and generation', (_, invalid) => {
    const session = createGssCompilerSession(config);
    expect(session.replaceStylesheet({ id, source: accepted }).committed).toBe(true);
    const before = session.finalize();
    const schema = session.getScopeSchema(id);
    const result = session.replaceStylesheet({ id, source: invalid });
    expect(result).toMatchObject({ committed: false, generation: 1,
      diagnostics: [{ code: 'GSS1301', reason: 'conflicting-global-resource' }] });
    expect(session.finalize()).toEqual(before);
    expect(session.getScopeSchema(id)).toEqual(schema);
  });

  it('replaces, invalidates and restores both variants without retaining stale resource frames', () => {
    const session = createGssCompilerSession(config);
    expect(session.replaceStylesheet({ id: '/project/Other.gss', source: '.other { color: green; }' }).committed).toBe(true);
    expect(session.replaceStylesheet({ id, source: accepted }).committed).toBe(true);
    const initial = session.finalize();
    const updated = session.replaceStylesheet({ id, source: source('(max-width: 400px)', '(min-width: 401px)', 12, 32) });
    expect(updated).toMatchObject({ committed: true, diagnostics: [] });
    expect(session.finalize().css).not.toContain('width: 10px;');
    expect(session.finalize().css).not.toContain('width: 30px;');
    expect(session.finalize().css).toContain('width: 12px;');
    expect(session.finalize().css).toContain('width: 32px;');
    expect(session.invalidate(id)).toMatchObject({ changed: true });
    expect(session.finalize().css).not.toContain('@keyframes');
    expect(session.finalize().css).toContain('color: green;');
    expect(session.replaceStylesheet({ id, source: accepted }).committed).toBe(true);
    expect(session.finalize().css).toBe(initial.css);
  });
});
