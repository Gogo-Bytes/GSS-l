import type { ParsedDeclaration, ParsedStyleRule } from './parsed-stylesheet.js';
import { propertiesMayOverlapForModuleOrder } from './module-order-policy.js';

const sides = ['top', 'right', 'bottom', 'left'] as const;
const boxShorthands = ['margin', 'padding', 'inset', 'scroll-margin', 'scroll-padding'] as const;
// Expansion eligibility is separate from the property-effect registry: known
// effects alone do not prove value distribution or alias isolation is safe.
const boxExpansions = [...boxShorthands.flatMap((family) =>
  ([undefined, 'inline', 'block'] as const).map((axis) => {
    const shorthand = axis ? `${family}-${axis}` : family;
    return {
      shorthand,
      properties: axis ? ['start', 'end'].map((side) => `${shorthand}-${side}`) :
        sides.map((side) => family === 'inset' ? side : `${family}-${side}`),
      nonnegative: family === 'padding' || family === 'scroll-padding',
      allowPercentage: family !== 'scroll-margin',
      allowFontLength: true,
      allowCrossScope: true,
      isolateAliases: axis !== undefined || family.startsWith('scroll-')
    };
  })
), {
  shorthand: 'border-width',
  properties: sides.map((side) => `border-${side}-width`),
  nonnegative: true,
  allowPercentage: false,
  allowFontLength: false,
  allowCrossScope: false,
  isolateAliases: true
}];

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
  return boxExpansions.reduce((current, policy) => expandBox(current, policy), rules);
}

function expandBox(rules: readonly ParsedStyleRule[], policy: typeof boxExpansions[number]): readonly ParsedStyleRule[] {
  const { shorthand, properties, nonnegative, allowPercentage, allowFontLength, allowCrossScope, isolateAliases } = policy;
  const declarations = [...new Set(rules.flatMap((rule) => rule.declarations))];
  const isSide = (property: string) => properties.includes(property);
  // Padding, scroll-padding and border widths require nonnegative values. Keep
  // unsupported values intact rather than partially applying invalid shorthands.
  // Accepted percentages and font lengths remain unevaluated for the browser.
  const safeLength = (value: string) =>
    (length.test(value) || (allowFontLength && fontLength.test(value)) || (allowPercentage && percentage.test(value))) &&
    (!nonnegative || !value.startsWith('-'));
  // Scroll boxes, logical axes and border widths require alias isolation even
  // within one rule. Logical expansion writes start/end, never mapped physical
  // sides. See PROPERTY-ORDER-DESIGN.md for the fallback and direction contract.
  if (isolateAliases && declarations.some(({ property }) =>
    property !== shorthand && !isSide(property) && propertiesMayOverlapForModuleOrder(property, shorthand))) return rules;
  // Cross-scope ranks preserve authored order only with proven static competing
  // values and no other participating alias.
  const crossScopeSafe = allowCrossScope && rules.every((rule) => rule.nodes.length === 1 && rule.layer === 'unlayered' && rule.conditions.length === 0) &&
    declarations.some(({ property }) => isSide(property)) && declarations.every(({ property, value }) => {
      if (property === shorthand) {
        const values = value.trim().split(/\s+/);
        return values.length <= properties.length && values.every(safeLength);
      }
      if (isSide(property)) return safeLength(value);
      return !propertiesMayOverlapForModuleOrder(property, shorthand);
    });
  // Same-rule-only expansion must not change competition with another authored
  // rule. Selector-list branches share declaration objects and remain eligible.
  const competingDeclarations = allowCrossScope ? [] : declarations.filter(({ property }) =>
    propertiesMayOverlapForModuleOrder(property, shorthand));
  const expanded = new Map<ParsedDeclaration, readonly ParsedDeclaration[]>();
  return rules.map((rule) => {
    if (competingDeclarations.some((entry) => !rule.declarations.includes(entry))) return rule;
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
