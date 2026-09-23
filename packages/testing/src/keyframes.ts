import type { AtRule, Declaration } from 'postcss';

const number = '(?:0|[1-9][0-9]*)(?:\\.[0-9]+)?';
const reserved = new Set(['initial', 'inherit', 'unset', 'revert', 'revert-layer', 'default', 'none']);
export function referenceAnimationSymbol(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_-]*$/.test(value) && !reserved.has(value.toLowerCase());
}

export function referenceDeclarationValue(declaration: Declaration): string | undefined {
  if (!/^[\t\n\r\f ]*:[\t\n\r\f ]*$/.test(declaration.raws.between ?? ':') ||
    declaration.raws.important?.includes('/*') || /[_*]/.test(declaration.raws.before ?? '')) return undefined;
  return (declaration.raws.value?.raw ?? declaration.value).replace(/^[\t\n\r\f ]+|[\t\n\r\f ]+$/g, '');
}

const animationValues: Readonly<Record<string, RegExp>> = {
  'animation-duration': new RegExp(`^${number}(?:ms|s)$`, 'i'),
  'animation-delay': new RegExp(`^[+-]?${number}(?:ms|s)$`, 'i'),
  'animation-iteration-count': new RegExp(`^(?:${number}|infinite)$`, 'i'),
  'animation-play-state': /^(?:paused|running)$/i,
  'animation-timing-function': /^(?:linear|ease|ease-in|ease-out|ease-in-out|step-start|step-end)$/i,
  'animation-direction': /^(?:normal|reverse|alternate|alternate-reverse)$/i,
  'animation-fill-mode': /^(?:none|forwards|backwards|both)$/i
};
export function referenceAnimationValue(property: string, value: string): boolean {
  return property === 'animation-name' ? referenceAnimationSymbol(value) || /^none$/i.test(value)
    : animationValues[property]?.test(value) ?? false;
}

/** Root resource syntax only: frames are never ownership selectors or Asset declarations. */
export function referenceKeyframes(rule: AtRule): boolean {
  if (!referenceAnimationSymbol(rule.params) || rule.raws.afterName?.includes('/*') || rule.raws.between?.includes('/*') || !rule.nodes) return false;
  const offsets = new Set<number>();
  for (const frame of rule.nodes) {
    if (frame.type === 'comment') continue;
    if (frame.type !== 'rule' || frame.raws.between?.includes('/*')) return false;
    const selector = frame.raws.selector?.raw ?? frame.selector;
    const offset = selector === 'from' ? 0 : selector === 'to' ? 100
      : new RegExp(`^${number}%$`).test(selector) ? Number(selector.slice(0, -1)) : NaN;
    if (!Number.isFinite(offset) || offset > 100 || offsets.has(offset)) return false;
    offsets.add(offset);
    const properties = new Set<string>();
    for (const declaration of frame.nodes) {
      if (declaration.type === 'comment') continue;
      if (declaration.type !== 'decl' || declaration.important || properties.has(declaration.prop)) return false;
      const value = referenceDeclarationValue(declaration);
      if (value === undefined || !(['width', 'height'].includes(declaration.prop)
        ? new RegExp(`^${number}px$`, 'i').test(value)
        : ['color', 'background-color'].includes(declaration.prop) && /^(?:red|blue|green|black|white)$/i.test(value))) return false;
      properties.add(declaration.prop);
    }
  }
  return true;
}
