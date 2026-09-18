const propertyEffects: Readonly<Record<string, readonly string[]>> = {
  margin: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'],
  'margin-top': ['margin-top'],
  'margin-right': ['margin-right'],
  'margin-bottom': ['margin-bottom'],
  'margin-left': ['margin-left'],
  padding: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'],
  'padding-top': ['padding-top'],
  'padding-right': ['padding-right'],
  'padding-bottom': ['padding-bottom'],
  'padding-left': ['padding-left']
};

export function effectsOfProperty(property: string): readonly string[] {
  return propertyEffects[property] ?? [property];
}

export function comparePropertyRenderOrder(left: string, right: string): number {
  if (left === right) return 0;
  const leftEffects = new Set(effectsOfProperty(left));
  const rightEffects = new Set(effectsOfProperty(right));
  const leftContainsRight = [...rightEffects].every((effect) => leftEffects.has(effect));
  const rightContainsLeft = [...leftEffects].every((effect) => rightEffects.has(effect));
  if (leftContainsRight && !rightContainsLeft) return -1;
  if (rightContainsLeft && !leftContainsRight) return 1;
  return left.localeCompare(right);
}
