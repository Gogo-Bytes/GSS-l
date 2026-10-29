import type { ParsedDeclaration, ParsedStyleRule } from './parsed-stylesheet.js';
import { propertiesMayOverlapForModuleOrder } from './module-order-policy.js';

const sides = ['top', 'right', 'bottom', 'left'] as const;
const boxShorthands = ['margin', 'padding', 'inset', 'scroll-margin', 'scroll-padding'] as const;
// Deliberately limited to values whose grammar and serialization need no CSS
// value evaluation. Unknown syntax and var() remain on the existing path.
const length = /^(?:[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)px|[+-]?0(?:\.0+)?)$/i;
const percentage = /^[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)%$/;
const fontLength = /^[+-]?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:em|rem)$/i;

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
  return boxShorthands.reduce((current, family) => {
    const physical = expandFamily(current, family);
    const inline = expandFamily(physical, family, 'inline');
    return expandFamily(inline, family, 'block');
  }, rules);
}

function expandFamily(rules: readonly ParsedStyleRule[], family: typeof boxShorthands[number], axis?: 'inline' | 'block'): readonly ParsedStyleRule[] {
  const shorthand = axis ? `${family}-${axis}` : family;
  const declarations = [...new Set(rules.flatMap((rule) => rule.declarations))];
  const properties = axis ? ['start', 'end'].map((side) => `${shorthand}-${side}`) :
    sides.map((side) => family === 'inset' ? side : `${family}-${side}`);
  const isSide = (property: string) => properties.includes(property);
  // Padding and scroll-padding reject negative lengths; a partially expanded invalid shorthand
  // would incorrectly apply its otherwise valid sides.
  const nonnegative = family === 'padding' || family === 'scroll-padding';
  // Percentages remain unevaluated for the browser; scroll-margin only accepts lengths.
  const safeLength = (value: string) =>
    (length.test(value) || fontLength.test(value) || (family !== 'scroll-margin' && percentage.test(value))) &&
    (!nonnegative || !value.startsWith('-'));
  // Scroll boxes and logical axes require isolation from potential aliases even
  // within one rule. Logical expansion writes start/end, never mapped physical
  // sides. See PROPERTY-ORDER-DESIGN.md for the fallback and direction contract.
  if ((axis || family.startsWith('scroll-')) && declarations.some(({ property }) =>
    property !== shorthand && !isSide(property) && propertiesMayOverlapForModuleOrder(property, shorthand))) return rules;
  // Cross-scope ranks preserve authored order only with proven static competing
  // values and no other participating alias.
  const crossScopeSafe = rules.every((rule) => rule.nodes.length === 1 && rule.layer === 'unlayered' && rule.conditions.length === 0) &&
    declarations.some(({ property }) => isSide(property)) && declarations.every(({ property, value }) => {
      if (property === shorthand) {
        const values = value.trim().split(/\s+/);
        return values.length <= properties.length && values.every(safeLength);
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
    if (values.length > properties.length || values.some((value) => !safeLength(value))) return rule;
    let replacement = expanded.get(declaration);
    if (!replacement) {
      const [first, second = first, third = first, fourth = second] = values;
      const distributed = [first, second, third, fourth];
      replacement = properties.map((property, index) => ({
        ...declaration, property, value: distributed[index]!
      }));
      expanded.set(declaration, replacement);
    }
    return { ...rule, declarations: rule.declarations.flatMap((entry) => entry === declaration ? replacement! : [entry]) };
  });
}
