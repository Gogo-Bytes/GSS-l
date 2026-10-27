import type { ParsedDeclaration, ParsedStyleRule } from './parsed-stylesheet.js';
import { propertiesMayOverlapForModuleOrder } from './module-order-policy.js';

const sides = ['top', 'right', 'bottom', 'left'] as const;
// Deliberately limited to values whose grammar and serialization need no CSS
// value evaluation. Unknown syntax and var() remain on the existing path.
const length = /^(?:[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)px|[+-]?0(?:\.0+)?)$/i;

export function expandSafeMarginRules(rules: readonly ParsedStyleRule[]): readonly ParsedStyleRule[] {
  const declarations = [...new Set(rules.flatMap((rule) => rule.declarations))];
  const isSide = (property: string) => sides.some((side) => property === `margin-${side}`);
  // Cross-scope ranks can preserve authored order here because every competing
  // margin effect has a proven static value and no other alias participates.
  const crossScopeSafe = rules.every((rule) => rule.path.length === 1 && rule.layer === 'unlayered' && rule.conditions.length === 0) &&
    declarations.some(({ property }) => isSide(property)) && declarations.every(({ property, value }) => {
      if (property === 'margin') {
        const values = value.trim().split(/\s+/);
        return values.length <= 4 && values.every((entry) => length.test(entry));
      }
      if (isSide(property)) return length.test(value);
      return !propertiesMayOverlapForModuleOrder(property, 'margin');
    });
  const expanded = new Map<ParsedDeclaration, readonly ParsedDeclaration[]>();
  return rules.map((rule) => {
    const margins = rule.declarations.filter(({ property }) => property === 'margin');
    const longhands = rule.declarations.filter(({ property }) => isSide(property));
    if (margins.length !== 1 || (!crossScopeSafe && longhands.length === 0) ||
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
