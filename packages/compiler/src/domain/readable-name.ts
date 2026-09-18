export type PureDeclarationIdentity = {
  layer: 'unlayered';
  condition: 'base';
  state: 'self';
  property: string;
  value: string;
  important: boolean;
};

export type ContextualRelationIdentity = {
  moduleId: string;
  relation: 'child';
  sourcePath: readonly string[];
  targetPath: readonly string[];
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

export function createReadableSourceMarker(
  moduleId: string,
  path: readonly string[]
): string {
  return [
    'gss-s',
    `module_${encodeNamePart(moduleId)}`,
    `path_${encodePath(path)}`
  ].join('--');
}

export function createReadableTargetMarker(identity: ContextualRelationIdentity): string {
  return [
    'gss-t',
    `module_${encodeNamePart(identity.moduleId)}`,
    `relation_${identity.relation}`,
    `source_${encodePath(identity.sourcePath)}`,
    `target_${encodePath(identity.targetPath)}`
  ].join('--');
}

function encodePath(path: readonly string[]): string {
  return encodeNamePart(path.join('/'));
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
