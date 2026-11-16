import { createHash } from 'node:crypto';
import valueParser from 'postcss-value-parser';
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
import type { GssCompilerConfig } from '../public-types.js';

export type NameAllocatorPort = {
  readonly identities?: ReadonlyMap<string, string>;
  reserveExternalName(name: string): void;
  createScopeMarker(moduleId: string, path: readonly string[]): string;
  createKeyframesName(moduleId: string, authoredName: string): string;
  createAtomicName(identity: PureDeclarationIdentity): string;
  createHasSubjectMarker(identity: ObservedRelationIdentity): string;
  createObservedMarker(identity: ObservedRelationIdentity): string;
  createSourceMarker(moduleId: string, path: readonly string[], condition?: string, layer?: string | null): string;
  createTargetMarker(identity: ContextualRelationIdentity): string;
  createContextMarker(identity: ContextualRelationIdentity, position: number, path: readonly string[]): string;
};

export type NameAllocator = NameAllocatorPort & {
  readonly identities: ReadonlyMap<string, string>;
  collision: string | undefined;
};

export function shortDigest(identity: string): string {
  return createHash('sha256').update(identity).digest().subarray(0, 6).toString('base64url');
}

function label(value: string): string {
  return value.replace(/[^a-zA-Z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32) || 'value';
}

/** One candidate contribution owns its registry; failed preparations never reserve names. */
export function createDefaultNameAllocator(
  mode: GssCompilerConfig['namingMode'] = 'development',
  digest: (identity: string) => string = shortDigest
): NameAllocator {
  if (mode !== 'development' && mode !== 'production') throw new TypeError('Invalid GSS namingMode.');
  const identities = new Map<string, string>();
  const allocated = new Map<string, string>();
  const keyframes = new Map<string, string>();
  const allocate = (identity: string, readable: string) => {
    const existing = allocated.get(identity);
    if (existing !== undefined) return existing;
    const suffix = digest(identity);
    const name = mode === 'production' ? `g${suffix}` : `g-${readable}-${suffix}`;
    const previous = identities.get(name);
    if (previous !== undefined && previous !== identity) allocator.collision = name;
    else identities.set(name, identity);
    allocated.set(identity, name);
    return name;
  };
  const allocator: NameAllocator = {
    identities,
    collision: undefined,
    reserveExternalName(name) {
      const identity = `external:${name}`;
      const previous = identities.get(name);
      if (previous !== undefined && previous !== identity) allocator.collision = name;
      else identities.set(name, identity);
    },
    createScopeMarker: (moduleId, path) => allocate(createReadableScopeMarker(moduleId, path), 'scope'),
    createSourceMarker: (moduleId, path, condition, layer) =>
      allocate(createReadableSourceMarker(moduleId, path, condition, layer), 'scope'),
    createKeyframesName(moduleId, authoredName) {
      const identity = createReadableKeyframesName(moduleId, authoredName);
      const name = allocate(identity, `keyframes-${label(authoredName)}`);
      keyframes.set(name, identity);
      return name;
    },
    createAtomicName(identity) {
      // Referenced names are presentation; identity and ordering use their full canonical keys.
      const canonicalValue = (value: { value: string; assetValue?: true }) => {
        if (value.assetValue || !/^(?:-webkit-)?animation(?:-name)?$/.test(identity.property) || !keyframes.size) return value;
        const parsed = valueParser(value.value);
        parsed.walk(node => {
          if (node.type === 'function') return false;
          if (node.type === 'word' || node.type === 'string') node.value = keyframes.get(node.value) ?? node.value;
          return undefined;
        });
        return { value: parsed.toString() };
      };
      const value = canonicalValue(identity).value;
      const canonical = createReadableAtomicName({ ...identity, value,
        ...(identity.fallbackValues ? { fallbackValues: identity.fallbackValues.map(canonicalValue) } : {}),
        ...(identity.stateMarkers ? { stateMarkers: identity.stateMarkers.map(name => identities.get(name) ?? name) } : {}) });
      return allocate(canonical, `${label(identity.property)}-${label(value)}`);
    },
    createHasSubjectMarker: identity => allocate(createReadableHasSubjectMarker(identity), 'subject'),
    createObservedMarker: identity => allocate(createReadableObservedMarker(identity), 'observed'),
    createTargetMarker: identity => allocate(createReadableTargetMarker(identity), 'target'),
    createContextMarker: (identity, position, path) =>
      allocate(createReadableContextMarker(identity, position, path), 'context')
  };
  return allocator;
}
