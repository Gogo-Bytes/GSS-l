import { hasRegisteredConditions, type RuleOrderConfig } from './rule-order-planner.js';
import { getOwnershipPath } from './ownership-path.js';
import type { GssDiagnostic } from '../public-types.js';
import type { ParsedDeclaration, ParsedStyleRule } from './parsed-stylesheet.js';
import { effectsOfProperty, isRegisteredPropertyEffect } from './property-effects.js';
import { propertiesMayOverlapForModuleOrder } from './module-order-policy.js';
import { isLocalElementRule, isObservedRule, isPseudoElementRule, isPureOwnershipRule } from './rule-classification.js';

export function declarationSequence(declaration: ParsedDeclaration): readonly ParsedDeclaration[] {
  const { fallbacks, ...last } = declaration;
  return [...(fallbacks ?? []).map(value => ({ ...last, ...value })), last];
}

export function groupAdjacentDeclarations(rules: readonly ParsedStyleRule[]): readonly ParsedStyleRule[] {
  const groups = new Map<ParsedDeclaration, ParsedDeclaration>();
  return rules.map(rule => {
    const declarations: ParsedDeclaration[] = [];
    for (const declaration of rule.declarations) {
      const previous = declarations.at(-1);
      if (previous?.property === declaration.property && previous.important === declaration.important) {
        const group = groups.get(declaration) ?? { ...declaration, fallbacks: [
          ...(previous.fallbacks ?? []), { value: previous.value, source: previous.source }
        ] };
        groups.set(declaration, group);
        declarations[declarations.length - 1] = group;
      } else declarations.push(declaration);
    }
    return declarations.length === rule.declarations.length ? rule : { ...rule, declarations };
  });
}

export function planDeclarationSequences(id: string, rules: readonly ParsedStyleRule[], order: RuleOrderConfig) {
  const repeated = new Map<ParsedStyleRule, ParsedDeclaration[]>();

  for (const rule of rules) {
    const seen = new Set<string>();
    for (const declaration of rule.declarations) {
      const key = `${declaration.property}\0${declaration.important ? 'important' : 'normal'}`;
      if (seen.has(key)) {
        const duplicates = repeated.get(rule) ?? [];
        duplicates.push(declaration);
        repeated.set(rule, duplicates);
      }
      seen.add(key);
    }
  }
  const orderedRules = new Set<ParsedStyleRule>();
  const diagnostics: GssDiagnostic[] = [];
  const external = rules.filter(r => r.externalTarget || r.externalCondition);
  // Every write has a single originating element; an external class only qualifies that element.
  const flatMixed = external.length > 0 && external.length < rules.length && rules.every(rule =>
    rule.nodes.length === 1 && (isLocalElementRule(rule) || (!!rule.externalCondition && isPureOwnershipRule(rule))) &&
    hasRegisteredConditions(rule.conditions, order) && (rule.layer === null || order.layers?.includes(rule.layer)) &&
    rule.declarations.every(d => isRegisteredPropertyEffect(d.property)));
  if (flatMixed) return { orderedRules: new Set(rules), diagnostics, flatMixed };
  if (!repeated.size && !external.length) return { orderedRules, diagnostics, flatMixed };
  // A pseudo-element has its own cascade. Different scope names, however, can be composed on a single element.
  const subject = (rule: ParsedStyleRule) => rule.nodes.at(-1)?.pseudoElement;
  const overlaps = (a: ParsedStyleRule, b: ParsedStyleRule) => a.declarations.some(d => !isRegisteredPropertyEffect(d.property) ||
    b.declarations.some(other => propertiesMayOverlapForModuleOrder(d.property, other.property)));
  // :has() tests the element receiving the writes; its observed node is not a separate cascade subject.
  for (const repeatedSubject of new Set([...repeated.keys()].map(subject))) {
    const candidates = new Set<ParsedStyleRule>();
    const outside: ParsedStyleRule[] = [];
    for (const rule of rules) {
      if (subject(rule) !== repeatedSubject) continue;
      const supported = !rule.hasExplicitGlobal && (isLocalElementRule(rule) || isObservedRule(rule) || isPseudoElementRule(rule));
      if (supported && rule.declarations.every(d => isRegisteredPropertyEffect(d.property))) candidates.add(rule);
      else outside.push(rule);
    }
    // Keep connected writers together: pruning an intermediate shorthand can affect more than the repeated property.
    for (const rule of outside) for (const local of candidates) {
      if (!overlaps(rule, local)) continue;
      candidates.delete(local);
      outside.push(local);
    }
    for (const rule of candidates) orderedRules.add(rule);
  }
  // Native external selectors carry their own specificity. Only their ties need authored slots, within one wrapper context.
  const pending = new Set(external);
  for (const first of external) {
    if (!pending.delete(first)) continue;
    const component = [first];
    for (const rule of component) for (const other of pending) {
      if (!overlaps(rule, other) && !overlaps(other, rule)) continue;
      pending.delete(other);
      component.push(other);
    }
    if (component.length === 1 && !repeated.has(first)) {
      const writes = first.declarations.flatMap(d => effectsOfProperty(d.property));
      if (new Set(writes).size === writes.length) continue;
    }
    // Across registered layers the emitted @layer prelude decides precedence, including its reversal for !important.
    const orderedLayers = component.every(rule => rule.layer === first.layer) ||
      component.every(rule => rule.layer === null || order.layers?.includes(rule.layer));
    const orderedConditions = component.every(rule => JSON.stringify(rule.conditions) === JSON.stringify(first.conditions)) ||
      component.every(rule => hasRegisteredConditions(rule.conditions, order));
    if (!orderedLayers || !orderedConditions || !component.every(rule => rule.declarations.every(d => isRegisteredPropertyEffect(d.property)) && !rules.some(other => !other.externalTarget &&
        !other.externalCondition && subject(other) === subject(rule) && overlaps(other, rule)))) continue;
    for (const rule of component) orderedRules.add(rule);
  }
  for (const [rule, duplicates] of repeated) {
    if (orderedRules.has(rule)) continue;
    for (const declaration of duplicates) {
      diagnostics.push({
        code: 'GSS1204', severity: 'error', phase: 'resolve', id,
        message: `Duplicate declaration for ${declaration.property} in ${getOwnershipPath(rule.nodes).map((name) => `.${name}`).join(' ')}.`,
        ...(declaration.source.sourceId === id ? {
          range: { start: declaration.source.start, end: declaration.source.end }
        } : {}),
        reason: 'duplicate-exact-property',
        suggestion: 'Keep same-property, same-importance fallbacks adjacent or express feature fallback with @supports.'
      });
    }
  }
  return { orderedRules, diagnostics, flatMixed };
}
