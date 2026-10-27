import type { ParsedDeclaration, ParsedStyleRule } from './parsed-stylesheet.js';

const sides = ['top', 'right', 'bottom', 'left'] as const;
// Deliberately limited to values whose grammar and serialization need no CSS
// value evaluation. Unknown syntax and var() remain on the existing path.
const length = /^(?:[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)px|[+-]?0(?:\.0+)?)$/i;

export function expandSafeMarginRules(rules: readonly ParsedStyleRule[]): readonly ParsedStyleRule[] {
  const expanded = new Map<ParsedDeclaration, readonly ParsedDeclaration[]>();
  return rules.map((rule) => {
    const margins = rule.declarations.filter(({ property }) => property === 'margin');
    const longhands = rule.declarations.filter(({ property }) => sides.some((side) => property === `margin-${side}`));
    if (margins.length !== 1 || longhands.length === 0 ||
      longhands.some(({ value }) => !length.test(value))) return rule;
    const declaration = margins[0]!;
    const values = declaration.value.trim().split(/\s+/);
    if (values.length > 4 || values.some((value) => !length.test(value))) return rule;
    let replacement = expanded.get(declaration);
    if (!replacement) {
      const [top, right = top, bottom = top, left = right] = values;
      replacement = [top, right, bottom, left].map((value, index) => ({
        ...declaration, property: `margin-${sides[index]}`, value: value!
      }));
      expanded.set(declaration, replacement);
    }
    return { ...rule, declarations: rule.declarations.flatMap((entry) => entry === declaration ? replacement! : [entry]) };
  });
}
