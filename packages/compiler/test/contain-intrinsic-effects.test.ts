import { describe, expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';
import { classifyPropertyEffect } from '../src/domain/property-effects.js';

// CSS Sizing 4 §5.2: the shorthand sets the physical width and height.
// https://www.w3.org/TR/css-sizing-4/#intrinsic-size-override
const longhands = ['contain-intrinsic-width', 'contain-intrinsic-height'] as const;

describe('contained intrinsic physical size effects', () => {
  it('classifies the shorthand as its two physical effects', () => {
    expect(classifyPropertyEffect('contain-intrinsic-size')).toEqual({
      kind: 'shorthand', effects: [...longhands]
    });
    for (const property of longhands) {
      expect(classifyPropertyEffect(property)).toEqual({ kind: 'longhand', effects: [property] });
    }
  });

  for (const property of longhands) {
    for (const shorthandFirst of [false, true]) {
      it.each([[false, false], [false, true], [true, false], [true, true]])(
        `${property} retains only effective declarations (shorthand first: ${shorthandFirst}, importance: %s/%s)`,
        (shorthandImportant, longhandImportant) => {
          const session = createGssCompilerSession({ projectRoot: '/project' });
          const sh = `contain-intrinsic-size: 100px 200px${shorthandImportant ? ' !important' : ''};`;
          const lh = `${property}: 300px${longhandImportant ? ' !important' : ''};`;
          const result = session.replaceStylesheet({ id: 'Size.gss', source:
            `.item { ${shorthandFirst ? `${sh} ${lh}` : `${lh} ${sh}`} }`
          });
          expect(result).toMatchObject({ committed: true, diagnostics: [], module: { compilationMode: 'atomic' } });
          const { manifest, css } = session.finalize();
          // The shorthand still provides the other axis even when one longhand wins.
          expect(css).toContain(sh);
          const longhandWins = longhandImportant !== shorthandImportant
            ? longhandImportant : shorthandFirst;
          expect(manifest.rules.map((rule) => rule.property)).toEqual(
            longhandWins ? ['contain-intrinsic-size', property] : ['contain-intrinsic-size']
          );
          if (longhandWins) expect(css).toContain(lh);
          expect(manifest.preservedRules).toEqual([]);
        }
      );
    }
  }

  it('reclaims a fully overridden shorthand but retains both physical longhands', () => {
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id: 'Size.gss', source:
      '.item { contain-intrinsic-size: 100px 200px; contain-intrinsic-width: 300px; contain-intrinsic-height: 400px; }'
    })).toMatchObject({ committed: true, diagnostics: [], module: { compilationMode: 'atomic' } });
    expect(session.finalize().manifest.rules.map((rule) => rule.property).sort()).toEqual([...longhands].sort());
  });

  it('retains whole-module fallback and strict rejection for unregistered logical aliases', () => {
    const source = '.item { contain-intrinsic-size: 100px; contain-intrinsic-inline-size: 200px; }';
    const session = createGssCompilerSession({ projectRoot: '/project' });
    expect(session.replaceStylesheet({ id: 'Size.gss', source })).toMatchObject({
      committed: true, module: { compilationMode: 'preserved', fallbackReasons: [
        { property: 'contain-intrinsic-inline-size', reason: 'property-effect-not-registered' }
      ] }
    });
    expect(session.finalize().manifest.rules).toEqual([]);
    const strict = createGssCompilerSession({ projectRoot: '/project', atomizationFallback: 'error' });
    expect(strict.replaceStylesheet({ id: 'Size.gss', source })).toMatchObject({ committed: false });
    expect(strict.finalize().css).toBe('');
  });
});
