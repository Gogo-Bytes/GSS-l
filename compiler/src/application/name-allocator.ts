import {
  createReadableAtomicName,
  createReadableContextMarker,
  createReadableHasSubjectMarker,
  createReadableKeyframesName,
  createReadableObservedMarker,
  createReadableScopeMarker,
  createReadableSourceMarker,
  createReadableTargetMarker,
  type ContextualRelationIdentity,
  type ObservedRelationIdentity,
  type PureDeclarationIdentity
} from '../domain/readable-name.js';

export type NameAllocatorPort = {
  createScopeMarker(moduleId: string, path: readonly string[]): string;
  createKeyframesName(moduleId: string, authoredName: string): string;
  createAtomicName(identity: PureDeclarationIdentity): string;
  createHasSubjectMarker(identity: ObservedRelationIdentity): string;
  createObservedMarker(identity: ObservedRelationIdentity): string;
  createSourceMarker(
    moduleId: string,
    path: readonly string[],
    condition?: string,
    layer?: string
  ): string;
  createTargetMarker(identity: ContextualRelationIdentity): string;
  createContextMarker(
    identity: ContextualRelationIdentity,
    position: number,
    path: readonly string[]
  ): string;
};

export function createDefaultNameAllocator(): NameAllocatorPort {
  return {
    createScopeMarker: createReadableScopeMarker,
    createKeyframesName: createReadableKeyframesName,
    createAtomicName: createReadableAtomicName,
    createHasSubjectMarker: createReadableHasSubjectMarker,
    createObservedMarker: createReadableObservedMarker,
    createSourceMarker: createReadableSourceMarker,
    createTargetMarker: createReadableTargetMarker,
    createContextMarker: createReadableContextMarker
  };
}
