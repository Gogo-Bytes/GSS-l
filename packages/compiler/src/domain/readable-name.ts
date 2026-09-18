export type PureDeclarationIdentity = {
  layer: string;
  condition: string;
  state: string;
  pseudoElement?: string;
  property: string;
  value: string;
  important: boolean;
};

export type ObservedRelationIdentity = {
  moduleId: string;
  condition?: string;
  subjectPath: readonly string[];
  relation: 'descendant' | 'child' | 'adjacent' | 'general-sibling';
  observedClass?: string;
  observedState?: string;
  observedResidual?: string;
};

export type ContextualRelationIdentity = {
  moduleId: string;
  condition?: string;
  relations: readonly ('descendant' | 'child' | 'adjacent' | 'general-sibling')[];
  sourceState?: string;
  sourceAttribute?: string;
  sourcePath: readonly string[];
  targetPath: readonly string[];
};

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
    `value_${encodeNamePart(identity.value)}`,
    `importance_${identity.important ? 'important' : 'normal'}`
  ].filter((part): part is string => part !== undefined).join('--');
}

export function createReadableHasSubjectMarker(identity: ObservedRelationIdentity): string {
  return [
    'gss-hs',
    `module_${encodeNamePart(identity.moduleId)}`,
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
  condition?: string
): string {
  return [
    'gss-s',
    `module_${encodeNamePart(moduleId)}`,
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
    identity.condition && identity.condition !== 'base'
      ? `condition_${encodeNamePart(identity.condition)}`
      : undefined,
    `relation_${encodeRelations(identity.relations)}`,
    identity.sourceState ? `state_${encodeNamePart(identity.sourceState)}` : undefined,
    identity.sourceAttribute
      ? `condition_${encodeNamePart(identity.sourceAttribute)}`
      : undefined,
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

function encodeNamePart(value: string): string {
  let encoded = '';
  for (const character of value.normalize('NFC')) {
    encoded += /[A-Za-z0-9]/.test(character)
      ? character
      : `_${character.codePointAt(0)?.toString(16)}_`;
  }
  return encoded || 'empty';
}
