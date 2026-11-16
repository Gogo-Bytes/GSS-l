import type { PhysicalDeclaration } from './compatibility-transformer.js';
import type { ParsedCondition, ParsedHasGroup, SourceSpan } from '../domain/parsed-stylesheet.js';
import type { ContextualRelationIdentity, ObservedRelationIdentity, PureDeclarationIdentity } from '../domain/readable-name.js';

export type ContextualDeclarationIdentity = ContextualRelationIdentity & Pick<PureDeclarationIdentity, 'fallbackValues'> & {
  property: string;
  value: string;
  assetValue?: true;
  important: boolean;
  atomRank?: number;
  orderSlot?: number;
};

type GroupedObservationIdentity = Pick<ObservedRelationIdentity, 'moduleId' | 'layer' | 'condition' | 'subjectPath'> & {
  hasConditions: readonly ParsedHasGroup[];
};

export type ObservedDeclarationIdentity = (ObservedRelationIdentity | GroupedObservationIdentity) & Pick<PureDeclarationIdentity, 'fallbackValues'> & {
  property: string;
  value: string;
  assetValue?: true;
  important: boolean;
  atomRank?: number;
  orderSlot?: number;
};

export type PlannedDeclaration = {
  kind: 'pure-atom' | 'contextual-atom';
  identity: PureDeclarationIdentity | ContextualDeclarationIdentity | ObservedDeclarationIdentity;
  className: string;
  orderKey?: string;
  selector: string;
  wrappers?: readonly ParsedCondition[];
  layer?: string | null;
  relationRank?: number;
  physicalDeclarations?: readonly PhysicalDeclaration[];
  declarationOffsets?: readonly number[];
  source: SourceSpan;
};

