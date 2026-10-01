export type PureDeclarationIdentity = {
  layer: string;
  condition: string;
  state: string;
  pseudoElement?: string;
  ownership?: { moduleId: string; path: readonly string[]; specificity: number };
  property: string;
  value: string;
  assetValue?: true;
  important: boolean;
};

export type ObservedRelationIdentity = {
  moduleId: string;
  layer?: string;
  condition?: string;
  subjectPath: readonly string[];
  relation: 'descendant' | 'child' | 'adjacent' | 'general-sibling';
  observedClass?: string;
  observedState?: string;
  observedResidual?: string;
};

export type ContextualRelationIdentity = {
  moduleId: string;
  layer?: string;
  condition?: string;
  relations: readonly ('descendant' | 'child' | 'adjacent' | 'general-sibling')[];
  authoredPath?: readonly string[];
  sourceState?: string;
  sourceAttribute?: string;
  sourcePath: readonly string[];
  targetPath: readonly string[];
};

export function createReadableScopeMarker(moduleId: string, path: readonly string[]): string {
  return [
    'gss-s',
    `module_${encodeNamePart(moduleId)}`,
    `path_${path.map(encodeNamePart).join('_2e_')}`
  ].join('--');
}

export function createReadableKeyframesName(moduleId: string, authoredName: string): string {
  return [
    'gss-k',
    `module_${encodeNamePart(moduleId)}`,
    `name_${encodeNamePart(authoredName)}`
  ].join('--');
}

export function createReadableAtomicName(identity: PureDeclarationIdentity): string {
  return [
    'gss-a',
    `layer_${encodeNamePart(identity.layer)}`,
    `condition_${encodeNamePart(identity.condition)}`,
    `state_${encodeNamePart(identity.state)}`,
    identity.pseudoElement
      ? `pseudo_${encodeNamePart(identity.pseudoElement)}`
      : undefined,
    `property_${encodeNamePart(identity.property)}`,
    `${identity.assetValue ? 'asset-value' : 'value'}_${encodeNamePart(identity.value)}`,
    `importance_${identity.important ? 'important' : 'normal'}`,
    ...(identity.ownership ? [
      `module_${encodeNamePart(identity.ownership.moduleId)}`,
      `target_${encodePath(identity.ownership.path)}`,
      `specificity_${identity.ownership.specificity}`
    ] : [])
  ].filter((part): part is string => part !== undefined).join('--');
}

export function createReadableHasSubjectMarker(identity: ObservedRelationIdentity): string {
  return [
    'gss-hs',
    `module_${encodeNamePart(identity.moduleId)}`,
    identity.layer && identity.layer !== 'unlayered'
      ? `layer_${encodeNamePart(identity.layer)}`
      : undefined,
    identity.condition && identity.condition !== 'base'
      ? `condition_${encodeNamePart(identity.condition)}`
      : undefined,
    `subject_${encodePath(identity.subjectPath)}`,
    `relation_${encodeNamePart(identity.relation)}`,
    identity.observedState ? `state_${encodeNamePart(identity.observedState)}` : undefined,
    renderObservedNamePart(identity)
  ].filter((part): part is string => part !== undefined).join('--');
}

export function createReadableObservedMarker(identity: ObservedRelationIdentity): string {
  return [
    'gss-ho',
    `module_${encodeNamePart(identity.moduleId)}`,
    identity.layer && identity.layer !== 'unlayered'
      ? `layer_${encodeNamePart(identity.layer)}`
      : undefined,
    identity.condition && identity.condition !== 'base'
      ? `condition_${encodeNamePart(identity.condition)}`
      : undefined,
    `subject_${encodePath(identity.subjectPath)}`,
    `relation_${encodeNamePart(identity.relation)}`,
    identity.observedState ? `state_${encodeNamePart(identity.observedState)}` : undefined,
    renderObservedNamePart(identity)
  ].filter((part): part is string => part !== undefined).join('--');
}

function renderObservedNamePart(identity: ObservedRelationIdentity): string {
  return identity.observedClass
    ? `observed_${encodeNamePart(identity.observedClass)}`
    : `residual_${encodeNamePart(identity.observedResidual ?? '')}`;
}

export function createReadableSourceMarker(
  moduleId: string,
  path: readonly string[],
  condition?: string,
  layer?: string
): string {
  return [
    'gss-s',
    `module_${encodeNamePart(moduleId)}`,
    layer && layer !== 'unlayered'
      ? `layer_${encodeNamePart(layer)}`
      : undefined,
    condition && condition !== 'base'
      ? `condition_${encodeNamePart(condition)}`
      : undefined,
    `path_${encodePath(path)}`
  ].filter((part): part is string => part !== undefined).join('--');
}

export function createReadableTargetMarker(identity: ContextualRelationIdentity): string {
  return [
    'gss-t',
    `module_${encodeNamePart(identity.moduleId)}`,
    identity.layer && identity.layer !== 'unlayered'
      ? `layer_${encodeNamePart(identity.layer)}`
      : undefined,
    identity.condition && identity.condition !== 'base'
      ? `condition_${encodeNamePart(identity.condition)}`
      : undefined,
    `relation_${encodeRelations(identity.relations)}`,
    identity.sourceState ? `state_${encodeNamePart(identity.sourceState)}` : undefined,
    identity.sourceAttribute
      ? `condition_${encodeNamePart(identity.sourceAttribute)}`
      : undefined,
    ...(identity.authoredPath ? [`authored_${encodePath(identity.authoredPath)}`] : []),
    `source_${encodePath(identity.sourcePath)}`,
    `target_${encodePath(identity.targetPath)}`
  ].filter((part): part is string => part !== undefined).join('--');
}

export function createReadableContextMarker(
  identity: ContextualRelationIdentity,
  position: number,
  path: readonly string[]
): string {
  return [
    'gss-c',
    `module_${encodeNamePart(identity.moduleId)}`,
    identity.layer && identity.layer !== 'unlayered'
      ? `layer_${encodeNamePart(identity.layer)}`
      : undefined,
    identity.condition && identity.condition !== 'base'
      ? `condition_${encodeNamePart(identity.condition)}`
      : undefined,
    `relation_${encodeRelations(identity.relations)}`,
    identity.sourceState ? `state_${encodeNamePart(identity.sourceState)}` : undefined,
    identity.sourceAttribute
      ? `condition_${encodeNamePart(identity.sourceAttribute)}`
      : undefined,
    `position_${position}`,
    `path_${encodePath(path)}`,
    `target_${encodePath(identity.targetPath)}`
  ].filter((part): part is string => part !== undefined).join('--');
}

function encodeRelations(relations: ContextualRelationIdentity['relations']): string {
  return encodeNamePart(relations.join('/'));
}

function encodePath(path: readonly string[]): string {
  return encodeNamePart(path.join('/'));
}

export function encodeReadableNamePart(value: string): string {
  let encoded = '';
  for (const character of value.normalize('NFC')) {
    encoded += /[A-Za-z0-9]/.test(character)
      ? character
      : `_${character.codePointAt(0)?.toString(16)}_`;
  }
  // A lone underscore cannot encode a nonempty character (underscores encode as _5f_).
  return encoded || '_';
}

const encodeNamePart = encodeReadableNamePart;

export function decodeReadableAtomicName(name: string): PureDeclarationIdentity | undefined {
  const parts = name.split('--');
  if (parts.shift() !== 'gss-a') return undefined;
  const fields = new Map<string, string>();
  const allowed = new Set([
    'layer', 'condition', 'state', 'pseudo', 'property', 'value', 'asset-value',
    'importance', 'module', 'target', 'specificity'
  ]);
  for (const part of parts) {
    const separator = part.indexOf('_');
    if (separator <= 0) return undefined;
    const key = part.slice(0, separator);
    if (!allowed.has(key) || fields.has(key)) return undefined;
    const value = decodeReadableNamePart(part.slice(separator + 1));
    if (value === undefined) return undefined;
    fields.set(key, value);
  }

  const required = ['layer', 'condition', 'state', 'property', 'importance'];
  if (required.some((key) => !fields.has(key))) return undefined;
  const hasValue = fields.has('value');
  const hasAssetValue = fields.has('asset-value');
  if (hasValue === hasAssetValue) return undefined;
  const importance = fields.get('importance');
  if (importance !== 'normal' && importance !== 'important') return undefined;
  const ownershipKeys = ['module', 'target', 'specificity'];
  const ownershipCount = ownershipKeys.filter((key) => fields.has(key)).length;
  if (ownershipCount !== 0 && ownershipCount !== ownershipKeys.length) return undefined;
  const specificity = fields.get('specificity');
  if (specificity !== undefined && !/^(?:0|[1-9][0-9]*)$/.test(specificity)) return undefined;

  const identity: PureDeclarationIdentity = {
    layer: fields.get('layer')!,
    condition: fields.get('condition')!,
    state: fields.get('state')!,
    property: fields.get('property')!,
    value: (hasAssetValue ? fields.get('asset-value') : fields.get('value'))!,
    important: importance === 'important',
    ...(fields.has('pseudo') ? { pseudoElement: fields.get('pseudo')! } : {}),
    ...(hasAssetValue ? { assetValue: true as const } : {}),
    ...(ownershipCount === ownershipKeys.length ? {
      ownership: {
        moduleId: fields.get('module')!,
        path: fields.get('target') === '' ? [] : fields.get('target')!.split('/'),
        specificity: Number(specificity)
      }
    } : {})
  };
  return identity;
}

export function decodeReadableNamePart(encoded: string): string | undefined {
  if (encoded === '_') return '';
  if (!encoded || !/^[A-Za-z0-9_]+$/.test(encoded)) return undefined;

  let decoded = '';
  for (let index = 0; index < encoded.length;) {
    const character = encoded[index]!;
    if (character !== '_') {
      decoded += character;
      index += 1;
      continue;
    }

    const end = encoded.indexOf('_', index + 1);
    if (end < 0) return undefined;
    const hex = encoded.slice(index + 1, end);
    if (!/^[0-9a-f]+$/i.test(hex)) return undefined;
    const codePoint = Number.parseInt(hex, 16);
    if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
      return undefined;
    }
    decoded += String.fromCodePoint(codePoint);
    index = end + 1;
  }

  return decoded.normalize('NFC');
}
