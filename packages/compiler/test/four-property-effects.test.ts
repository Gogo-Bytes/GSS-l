import { describe, expect, it } from 'vitest';
import { createGssCompilerSession } from '../src/index.js';

const properties = [
  { property: 'box-shadow', first: '0 1px 3px red', second: 'inset 0 2px 4px blue' },
  { property: 'letter-spacing', first: '2px', second: '-1px' },
  { property: 'text-transform', first: 'uppercase', second: 'lowercase' },
  { property: 'outline-offset', first: '2px', second: '4px' },
  { property: 'aspect-ratio', first: '1 / 1', second: '16 / 9' },
  { property: 'box-sizing', first: 'content-box', second: 'border-box' },
  { property: 'accent-color', first: 'red', second: 'blue' },
  { property: 'filter', first: 'none', second: 'blur(2px)' },
  { property: 'backdrop-filter', first: 'none', second: 'blur(2px)' },
  { property: 'clip-path', first: 'none', second: 'circle(50%)' },
  { property: 'content-visibility', first: 'visible', second: 'auto' },
  { property: 'scroll-behavior', first: 'auto', second: 'smooth' },
  { property: 'pointer-events', first: 'auto', second: 'none' },
  { property: 'user-select', first: 'auto', second: 'none' },
  { property: 'touch-action', first: 'auto', second: 'none' },
  { property: 'will-change', first: 'auto', second: 'transform' },
  { property: 'resize', first: 'none', second: 'both' },
  { property: 'appearance', first: 'auto', second: 'none' },
  { property: 'color-scheme', first: 'normal', second: 'dark' },
  { property: 'isolation', first: 'auto', second: 'isolate' },
  { property: 'mix-blend-mode', first: 'normal', second: 'multiply' },
  { property: 'box-decoration-break', first: 'slice', second: 'clone' },
  { property: 'image-rendering', first: 'auto', second: 'pixelated' },
  { property: 'shape-rendering', first: 'auto', second: 'crispEdges' },
  { property: 'text-rendering', first: 'auto', second: 'optimizeLegibility' },
  { property: 'scrollbar-gutter', first: 'auto', second: 'stable' },
  { property: 'text-indent', first: '0', second: '1em' },
  { property: 'word-spacing', first: 'normal', second: '0.2em' },
  { property: 'text-wrap-mode', first: 'wrap', second: 'nowrap' },
  { property: 'text-wrap-style', first: 'auto', second: 'pretty' },
  { property: 'hyphens', first: 'manual', second: 'auto' },
  { property: 'line-break', first: 'auto', second: 'strict' },
  { property: 'tab-size', first: '8', second: '4' },
  { property: 'text-orientation', first: 'mixed', second: 'upright' },
  { property: 'text-shadow', first: 'none', second: '1px 1px red' },
  { property: 'caret-color', first: 'auto', second: 'red' },
  { property: 'fill', first: 'black', second: 'red' },
  { property: 'fill-opacity', first: '1', second: '0.5' },
  { property: 'stroke', first: 'none', second: 'blue' },
  { property: 'stroke-width', first: '1', second: '2' },
  { property: 'stroke-opacity', first: '1', second: '0.5' },
  { property: 'stroke-linecap', first: 'butt', second: 'round' },
  { property: 'stroke-linejoin', first: 'miter', second: 'round' },
  { property: 'paint-order', first: 'normal', second: 'stroke fill' },
  { property: 'vector-effect', first: 'none', second: 'non-scaling-stroke' },
  { property: 'background-blend-mode', first: 'normal', second: 'multiply' },
  { property: 'text-decoration-skip-ink', first: 'auto', second: 'none' },
  { property: 'border-collapse', first: 'separate', second: 'collapse' },
  { property: 'border-spacing', first: '0', second: '4px' },
  { property: 'caption-side', first: 'top', second: 'bottom' },
  { property: 'empty-cells', first: 'show', second: 'hide' },
  { property: 'contain', first: 'none', second: 'layout' },
  { property: 'container-type', first: 'normal', second: 'inline-size' },
  { property: 'container-name', first: 'none', second: 'sidebar' },
  { property: 'contain-intrinsic-size', first: 'none', second: '300px' },
  { property: 'animation-composition', first: 'replace', second: 'add' },
  { property: 'font-synthesis', first: 'auto', second: 'none' },
  { property: 'view-transition-name', first: 'none', second: 'hero' },
  { property: 'view-transition-class', first: 'none', second: 'hero' },
  { property: 'anchor-name', first: 'none', second: '--target' },
  { property: 'anchor-scope', first: 'none', second: '--target' },
  { property: 'position-anchor', first: 'auto', second: '--target' },
  { property: 'position-area', first: 'none', second: 'top' },
  { property: 'position-visibility', first: 'always', second: 'anchors-visible' },
  { property: 'field-sizing', first: 'content-box', second: 'fixed' },
  { property: 'interpolate-size', first: 'numeric-only', second: 'allow-keywords' },
  { property: 'corner-shape', first: 'round', second: 'bevel' },
  { property: 'inline-size', first: 'auto', second: '20px' },
  { property: 'block-size', first: 'auto', second: '20px' },
  { property: 'border-start-start-radius', first: '0px', second: '8px' },
  { property: 'border-end-end-radius', first: '0px', second: '8px' },
  { property: 'scroll-snap-type', first: 'none', second: 'x mandatory' },
  { property: 'scroll-snap-align', first: 'none', second: 'start' },
  { property: 'scroll-snap-stop', first: 'normal', second: 'always' },
  { property: 'scrollbar-color', first: 'auto', second: 'red blue' },
  { property: 'scrollbar-width', first: 'auto', second: 'thin' },
  { property: 'text-size-adjust', first: 'auto', second: 'none' },
  { property: 'forced-color-adjust', first: 'auto', second: 'none' },
  { property: 'print-color-adjust', first: 'economy', second: 'exact' },
  { property: 'backface-visibility', first: 'visible', second: 'hidden' },
  { property: 'transform-style', first: 'flat', second: 'preserve-3d' },
  { property: 'perspective', first: 'none', second: '500px' },
  { property: 'perspective-origin', first: 'center', second: 'left top' },
  { property: 'overflow-clip-margin', first: '0', second: '10px' },
  { property: 'field-sizing', first: 'fixed', second: 'content' },
  { property: 'interpolate-size', first: 'numeric-only', second: 'allow-keywords' },
  { property: 'ruby-position', first: 'over', second: 'under' },
  { property: 'ruby-align', first: 'space-around', second: 'center' }
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
