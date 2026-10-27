export type PureDeclarationIdentity = {
  /** Module-local tie version; absent identities retain their historical spelling. */
  atomRank?: number;
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
    `path_${path.length ? encodePath(path) : ''}`
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
    identity.atomRank === undefined ? undefined : `rank_${identity.atomRank}`,
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

function escapePathSegment(segment: string, separator: string): string {
  return segment.replaceAll('\\', '\\\\').replaceAll(separator, `\\${separator}`);
}

function encodePath(path: readonly string[]): string {
  return encodeNamePart(path.map((segment) => escapePathSegment(segment, '/')).join('/'));
}

function decodePath(value: string): string[] | undefined {
  if (value === '') return [];
  const path: string[] = [];
  let segment = '';
  for (let index = 0; index < value.length; index++) {
    const character = value[index]!;
    if (character === '\\') {
      const escaped = value[++index];
      if (escaped !== '\\' && escaped !== '/') return undefined;
      segment += escaped;
    } else if (character === '/') {
      if (!segment) return undefined;
      path.push(segment);
      segment = '';
    } else {
      segment += character;
    }
  }
  if (!segment) return undefined;
  path.push(segment);
  return path;
}

export function encodeReadableNamePart(value: string): string {
  let encoded = '';
  for (const character of value) {
    encoded += /[A-Za-z0-9]/.test(character)
      ? character
      : `_${character.codePointAt(0)?.toString(16)}_`;
  }
  // A lone underscore cannot encode a nonempty character (underscores encode as _5f_).
  return encoded || '_';
}

const encodeNamePart = encodeReadableNamePart;

export type ReadableScopeSourceIdentity = {
  moduleId: string;
  path: readonly string[];
  layer?: string;
  condition?: string;
};

/** Partial inverse for emitted gss-s markers; invalid and noncanonical spellings are rejected. */
export function decodeReadableScopeSourceMarker(name: string): ReadableScopeSourceIdentity | undefined {
  const parts = name.split('--');
  if (parts[0] !== 'gss-s') return undefined;
  let index = 1;
  const take = (key: string): string | undefined => {
    const part = parts[index];
    if (!part?.startsWith(`${key}_`)) return undefined;
    index += 1;
    return decodeReadableNamePart(part.slice(key.length + 1));
  };
  const moduleId = take('module');
  if (moduleId === undefined) return undefined;
  const layer = take('layer');
  const condition = take('condition');
  const encodedPath = take('path');
  if (encodedPath === undefined || index !== parts.length) return undefined;
  const path = decodePath(encodedPath);
  if (!path?.length) return undefined;
  const identity: ReadableScopeSourceIdentity = { moduleId, path,
    ...(layer !== undefined ? { layer } : {}),
    ...(condition !== undefined ? { condition } : {}) };
  return createReadableSourceMarker(moduleId, path, condition, layer) === name ? identity : undefined;
}

export function decodeReadableKeyframesName(name: string): { moduleId: string; authoredName: string } | undefined {
  const parts = name.split('--');
  if (parts.length !== 3 || parts[0] !== 'gss-k' || !parts[1]?.startsWith('module_') ||
    !parts[2]?.startsWith('name_')) return undefined;
  const moduleId = decodeReadableNamePart(parts[1].slice('module_'.length));
  const authoredName = decodeReadableNamePart(parts[2].slice('name_'.length));
  if (moduleId === undefined || authoredName === undefined) return undefined;
  return createReadableKeyframesName(moduleId, authoredName) === name ? { moduleId, authoredName } : undefined;
}

const relationKinds = new Set<ContextualRelationIdentity['relations'][number]>(
  ['descendant', 'child', 'adjacent', 'general-sibling']
);

function isRelation(value: string): value is ContextualRelationIdentity['relations'][number] {
  return relationKinds.has(value as ContextualRelationIdentity['relations'][number]);
}

/** Partial inverse for canonical emitted target markers, including two positional condition fields. */
export function decodeReadableTargetMarker(name: string): ContextualRelationIdentity | undefined {
  const parts = name.split('--');
  if (parts[0] !== 'gss-t') return undefined;
  let index = 1;
  const take = (key: string): string | undefined => {
    const part = parts[index];
    if (!part?.startsWith(`${key}_`)) return undefined;
    index += 1;
    return decodeReadableNamePart(part.slice(key.length + 1));
  };
  const moduleId = take('module');
  if (moduleId === undefined) return undefined;
  const layer = take('layer');
  const condition = take('condition');
  const relationValue = take('relation');
  if (relationValue === undefined) return undefined;
  const relations = relationValue.split('/');
  if (!relations.length || !relations.every(isRelation)) return undefined;
  const sourceState = take('state');
  const sourceAttribute = take('condition');
  const authored = take('authored');
  const source = take('source');
  const target = take('target');
  if (source === undefined || target === undefined || index !== parts.length) return undefined;
  const authoredPath = authored === undefined ? undefined : decodePath(authored);
  const sourcePath = decodePath(source);
  const targetPath = decodePath(target);
  if (sourcePath === undefined || targetPath === undefined || (authored !== undefined && authoredPath === undefined)) {
    return undefined;
  }
  const identity: ContextualRelationIdentity = { moduleId, relations, sourcePath, targetPath,
    ...(layer !== undefined ? { layer } : {}),
    ...(condition !== undefined ? { condition } : {}),
    ...(sourceState !== undefined ? { sourceState } : {}),
    ...(sourceAttribute !== undefined ? { sourceAttribute } : {}),
    ...(authoredPath !== undefined ? { authoredPath } : {}) };
  return createReadableTargetMarker(identity) === name ? identity : undefined;
}

export type DecodedContextMarker = {
  identity: ContextualRelationIdentity;
  position: number;
  path: readonly string[];
};

/** Inverse for emitted intermediate gss-c markers; sourcePath is derived from the runtime prefix. */
export function decodeReadableContextMarker(name: string): DecodedContextMarker | undefined {
  const parts = name.split('--');
  if (parts[0] !== 'gss-c') return undefined;
  let index = 1;
  const take = (key: string): string | undefined => {
    const part = parts[index];
    if (!part?.startsWith(`${key}_`)) return undefined;
    index += 1;
    return decodeReadableNamePart(part.slice(key.length + 1));
  };
  const moduleId = take('module');
  if (moduleId === undefined) return undefined;
  const layer = take('layer');
  const condition = take('condition');
  const relationValue = take('relation');
  if (relationValue === undefined) return undefined;
  const relations = relationValue.split('/');
  if (!relations.length || !relations.every(isRelation)) return undefined;
  const sourceState = take('state');
  const sourceAttribute = take('condition');
  const positionValue = take('position');
  const encodedPath = take('path');
  const encodedTarget = take('target');
  if (positionValue === undefined || encodedPath === undefined || encodedTarget === undefined ||
    index !== parts.length || !/^[1-9][0-9]*$/.test(positionValue)) return undefined;
  const position = Number(positionValue);
  const path = decodePath(encodedPath);
  const targetPath = decodePath(encodedTarget);
  if (!Number.isSafeInteger(position) || position >= relations.length || path === undefined ||
    targetPath === undefined) return undefined;
  const sourceLength = targetPath.length - relations.length;
  if (sourceLength < 1 || path.length !== sourceLength + position ||
    path.some((segment, pathIndex) => segment !== targetPath[pathIndex])) return undefined;
  const sourcePath = targetPath.slice(0, sourceLength);
  const identity: ContextualRelationIdentity = { moduleId, relations, sourcePath, targetPath,
    ...(layer !== undefined ? { layer } : {}),
    ...(condition !== undefined ? { condition } : {}),
    ...(sourceState !== undefined ? { sourceState } : {}),
    ...(sourceAttribute !== undefined ? { sourceAttribute } : {}) };
  return createReadableContextMarker(identity, position, path) === name ? { identity, position, path } : undefined;
}

export type DecodedObservedMarker = {
  role: 'subject' | 'observed';
  identity: ObservedRelationIdentity;
};

/** Partial inverse for the subject/observed namespaces of an external or owned observation. */
export function decodeReadableObservedMarker(name: string): DecodedObservedMarker | undefined {
  const parts = name.split('--');
  const role = parts[0] === 'gss-hs' ? 'subject' : parts[0] === 'gss-ho' ? 'observed' : undefined;
  if (!role) return undefined;
  let index = 1;
  const take = (key: string): string | undefined => {
    const part = parts[index];
    if (!part?.startsWith(`${key}_`)) return undefined;
    index += 1;
    return decodeReadableNamePart(part.slice(key.length + 1));
  };
  const moduleId = take('module');
  if (moduleId === undefined) return undefined;
  const layer = take('layer');
  const condition = take('condition');
  const subject = take('subject');
  const relation = take('relation');
  if (subject === undefined || relation === undefined || !isRelation(relation)) return undefined;
  const observedState = take('state');
  const observedClass = take('observed');
  const observedResidual = observedClass === undefined ? take('residual') : undefined;
  if (index !== parts.length || (observedClass === undefined && observedResidual === undefined)) return undefined;
  const subjectPath = decodePath(subject);
  if (subjectPath === undefined) return undefined;
  const identity: ObservedRelationIdentity = { moduleId, subjectPath, relation,
    ...(layer !== undefined ? { layer } : {}),
    ...(condition !== undefined ? { condition } : {}),
    ...(observedState !== undefined ? { observedState } : {}),
    ...(observedClass !== undefined ? { observedClass } : {}),
    ...(observedResidual !== undefined ? { observedResidual } : {}) };
  const canonical = role === 'subject' ? createReadableHasSubjectMarker(identity) : createReadableObservedMarker(identity);
  return canonical === name ? { role, identity } : undefined;
}

export function decodeReadableAtomicName(name: string): PureDeclarationIdentity | undefined {
  const parts = name.split('--');
  if (parts.shift() !== 'gss-a') return undefined;
  const fields = new Map<string, string>();
  const allowed = new Set([
    'layer', 'condition', 'state', 'pseudo', 'property', 'value', 'asset-value',
    'importance', 'rank', 'module', 'target', 'specificity'
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
  const atomRank = fields.get('rank');
  if (atomRank !== undefined && (!/^[1-9][0-9]*$/.test(atomRank) || !Number.isSafeInteger(Number(atomRank)))) return undefined;
  const ownershipKeys = ['module', 'target', 'specificity'];
  const ownershipCount = ownershipKeys.filter((key) => fields.has(key)).length;
  if (ownershipCount !== 0 && ownershipCount !== ownershipKeys.length) return undefined;
  const specificity = fields.get('specificity');
  if (specificity !== undefined && !/^(?:0|[1-9][0-9]*)$/.test(specificity)) return undefined;
  const targetPath = fields.has('target') ? decodePath(fields.get('target')!) : undefined;
  if (fields.has('target') && targetPath === undefined) return undefined;

  const identity: PureDeclarationIdentity = {
    layer: fields.get('layer')!,
    condition: fields.get('condition')!,
    state: fields.get('state')!,
    property: fields.get('property')!,
    value: (hasAssetValue ? fields.get('asset-value') : fields.get('value'))!,
    important: importance === 'important',
    ...(atomRank === undefined ? {} : { atomRank: Number(atomRank) }),
    ...(fields.has('pseudo') ? { pseudoElement: fields.get('pseudo')! } : {}),
    ...(hasAssetValue ? { assetValue: true as const } : {}),
    ...(ownershipCount === ownershipKeys.length ? {
      ownership: {
        moduleId: fields.get('module')!,
        path: targetPath!,
        specificity: Number(specificity)
      }
    } : {})
  };
  // Decoding is a partial inverse of the canonical encoder, not an alias parser.
  return createReadableAtomicName(identity) === name ? identity : undefined;
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

  return decoded;
}
