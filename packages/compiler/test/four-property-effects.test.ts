import { describe, expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

const properties = [
  { property: 'box-shadow', first: '0 1px 3px red', second: 'inset 0 2px 4px blue' },
  { property: 'letter-spacing', first: '2px', second: '-1px' },
  { property: 'text-transform', first: 'uppercase', second: 'lowercase' },
  { property: 'outline-offset', first: '2px', second: '4px' }
] as const;
const importancePairs = [[false, false], [false, true], [true, false], [true, true]] as const;
const declaration = (property: string, value: string, important: boolean) =>
  `${property}: ${value}${important ? ' !important' : ''};`;

function compile(source: string) {
  const session = createGssCompilerSession({ projectRoot: '/project' });
  const result = session.replaceStylesheet({ id: '/project/effects.gss', source });
  expect(result).toMatchObject({
    committed: true, diagnostics: [], module: { compilationMode: 'atomic', fallbackReasons: [] }
  });
  const snapshot = session.finalize();
  expect(snapshot.manifest.preservedRules).toEqual([]);
  expect(snapshot.report).toMatchObject({ atomicModules: 1, preservedModules: 0 });
  return { result, snapshot };
}

describe('four independent property effects through the compiler session', () => {
  for (const { property, first, second } of properties) {
    it.each(importancePairs)(`${property} resolves source order and importance (%s, %s)`, (firstImportant, secondImportant) => {
      const winnerIsFirst = firstImportant && !secondImportant;
      const { snapshot } = compile(
        `.item { ${declaration(property, first, firstImportant)} } .item { ${declaration(property, second, secondImportant)} }`
      );
      expect(snapshot.manifest.rules).toHaveLength(1);
      expect(snapshot.manifest.rules[0]).toMatchObject({
        property, value: winnerIsFirst ? first : second,
        important: winnerIsFirst ? firstImportant : secondImportant
      });
      expect(snapshot.css).toContain(declaration(property, winnerIsFirst ? first : second, firstImportant || secondImportant));
    });

    it.each([false, true])(`${property} resolves ownership specificity before later source order (important: %s)`, (important) => {
      const { result, snapshot } = compile(
        `.root .item { ${declaration(property, first, important)} } .item { ${declaration(property, second, important)} }`
      );
      const targetClasses = result.module!.scopeSchema.exports.root!.targets.item!.selfClassName.split(' ');
      expect(snapshot.manifest.rules.filter((rule) => targetClasses.includes(rule.className)))
        .toMatchObject([{ property, value: first, important }]);
    });

    it(`${property} does not bypass unknown-property whole-module fallback or strict rejection`, () => {
      const source = `.item { ${property}: ${first}; future-property: 1; }`;
      const session = createGssCompilerSession({ projectRoot: '/project' });
      expect(session.replaceStylesheet({ id: '/project/effects.gss', source })).toMatchObject({
        committed: true,
        module: { compilationMode: 'preserved', fallbackReasons: [
          { property: 'future-property', reason: 'property-effect-not-registered' }
        ] },
        diagnostics: [{ code: 'GSS1104', severity: 'warning' }]
      });
      expect(session.finalize().manifest.rules).toEqual([]);
      expect(session.finalize().css).toContain(`${property}: ${first};`);
      const strict = createGssCompilerSession({ projectRoot: '/project', atomizationFallback: 'error' });
      expect(strict.replaceStylesheet({ id: '/project/effects.gss', source })).toMatchObject({ committed: false });
      expect(strict.finalize().css).toBe('');
    });
  }

  // CSS UI 3 §4.1/4.5, Fonts 3 §3.7, Backgrounds 3 §2.10/3.4/6.1:
  // these independent properties are not shorthand subproperties or reset-only effects.
  const shorthandPairs = [
    ['outline-offset', '2px', 'outline', '3px solid blue', 'outline-color', 'red'],
    ['letter-spacing', '2px', 'font', '16px serif', 'font-weight', '700'],
    ['text-transform', 'uppercase', 'font', '16px serif', 'font-weight', '700'],
    ['box-shadow', '0 1px 3px red', 'border', '1px solid blue', 'border-top-color', 'red'],
    ['box-shadow', '0 1px 3px red', 'background', 'blue', 'background-color', 'red']
  ] as const;
  for (const [property, value, shorthand, shorthandValue, resetProperty, resetValue] of shorthandPairs) {
    for (const shorthandFirst of [false, true]) {
      it.each(importancePairs)(`${shorthand} never resets ${property}, but resets ${resetProperty} (shorthand first: ${shorthandFirst}; importance: %s, %s)`, (important, shorthandImportant) => {
        const independent = declaration(property, value, important);
        const reset = declaration(resetProperty, resetValue, important);
        const sh = declaration(shorthand, shorthandValue, shorthandImportant);
        const { snapshot } = compile(`.item { ${shorthandFirst ? `${sh} ${independent} ${reset}` : `${independent} ${reset} ${sh}`} }`);
        expect(snapshot.css).toContain(independent);
        expect(snapshot.css).toContain(sh);
        const resetSurvives = shorthandFirst ? important || !shorthandImportant : important && !shorthandImportant;
        expect(snapshot.css.includes(`\n  ${reset}\n`)).toBe(resetSurvives);
        expect(snapshot.manifest.rules).toHaveLength(resetSurvives ? 3 : 2);
      });
    }
  }
});
