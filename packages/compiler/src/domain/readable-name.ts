export type PureDeclarationIdentity = {
  layer: 'unlayered';
  condition: 'base';
  state: 'self';
  property: string;
  value: string;
  important: boolean;
};

export function createReadableAtomicName(identity: PureDeclarationIdentity): string {
  return [
    'gss-a',
    `layer_${encodeNamePart(identity.layer)}`,
    `condition_${encodeNamePart(identity.condition)}`,
    `state_${encodeNamePart(identity.state)}`,
    `property_${encodeNamePart(identity.property)}`,
    `value_${encodeNamePart(identity.value)}`,
    `importance_${identity.important ? 'important' : 'normal'}`
  ].join('--');
}

function encodeNamePart(value: string): string {
  let encoded = '';
  for (const character of value.normalize('NFC')) {
    encoded += /[A-Za-z0-9]/.test(character)
      ? character
      : `_${character.codePointAt(0)?.toString(16)}_`;
  }
  return encoded || 'empty';
}
