import type { ParsedDeclaration, ParsedStyleRule } from './parsed-stylesheet.js';
import { propertiesMayOverlapForModuleOrder } from './module-order-policy.js';

const sides = ['top', 'right', 'bottom', 'left'] as const;
// Deliberately limited to values whose grammar and serialization need no CSS
// value evaluation. Unknown syntax and var() remain on the existing path.
const length = /^(?:[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)px|[+-]?0(?:\.0+)?)$/i;

/** Discard only padding declarations proven invalid at parse time. A var()
 * declaration is not invalid until computed-value time and must remain. */
export function discardInvalidStaticPadding(rules: readonly ParsedStyleRule[]): readonly ParsedStyleRule[] {
  return rules.map((rule) => {
    const declarations = rule.declarations.filter(({ property, value }) => {
      const max = property === 'padding' ? 4 :
        property === 'padding-inline' || property === 'padding-block' ? 2 :
        /^padding-(?:top|right|bottom|left|inline-start|inline-end|block-start|block-end)$/.test(property) ? 1 : 0;
      if (!max) return true;
      const values = value.trim().split(/\s+/);
      if (values.length > max || !values.every((entry) => length.test(entry))) return true;
      return !values.some((entry) => /px$/i.test(entry) && Number.parseFloat(entry) < 0);
    });
    return declarations.length === rule.declarations.length ? rule : { ...rule, declarations };
  });
}

export function expandSafeBoxRules(rules: readonly ParsedStyleRule[]): readonly ParsedStyleRule[] {
  return (['margin', 'padding'] as const).reduce((current, property) => expandFamily(current, property), rules);
}

function expandFamily(rules: readonly ParsedStyleRule[], shorthand: 'margin' | 'padding'): readonly ParsedStyleRule[] {
  const declarations = [...new Set(rules.flatMap((rule) => rule.declarations))];
  const isSide = (property: string) => sides.some((side) => property === `${shorthand}-${side}`);
  // Padding rejects negative lengths; a partially expanded invalid shorthand
  // would incorrectly apply its otherwise valid sides.
  const safeLength = (value: string) => length.test(value) && (shorthand === 'margin' || !value.startsWith('-'));
  // Cross-scope ranks preserve authored order only with proven static competing
  // values and no other participating alias.
  const crossScopeSafe = rules.every((rule) => rule.path.length === 1 && rule.layer === 'unlayered' && rule.conditions.length === 0) &&
    declarations.some(({ property }) => isSide(property)) && declarations.every(({ property, value }) => {
      if (property === shorthand) {
        const values = value.trim().split(/\s+/);
        return values.length <= 4 && values.every(safeLength);
      }
      if (isSide(property)) return safeLength(value);
      return !propertiesMayOverlapForModuleOrder(property, shorthand);
    });
  const expanded = new Map<ParsedDeclaration, readonly ParsedDeclaration[]>();
  return rules.map((rule) => {
    const shorthands = rule.declarations.filter(({ property }) => property === shorthand);
    const longhands = rule.declarations.filter(({ property }) => isSide(property));
    if (shorthands.length !== 1 || (!crossScopeSafe && longhands.length === 0) ||
      longhands.some(({ value }) => !safeLength(value))) return rule;
    const declaration = shorthands[0]!;
    const values = declaration.value.trim().split(/\s+/);
    if (values.length > 4 || values.some((value) => !safeLength(value))) return rule;
    let replacement = expanded.get(declaration);
    if (!replacement) {
      const [top, right = top, bottom = top, left = right] = values;
      replacement = [top, right, bottom, left].map((value, index) => ({
        ...declaration, property: `${shorthand}-${sides[index]}`, value: value!
      }));
      expanded.set(declaration, replacement);
    }
    return { ...rule, declarations: rule.declarations.flatMap((entry) => entry === declaration ? replacement! : [entry]) };
  });
}
