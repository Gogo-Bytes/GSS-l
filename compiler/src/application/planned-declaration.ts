import type { PhysicalDeclaration } from './compatibility-transformer.js';
import type { ParsedCondition, ParsedHasGroup, SourceSpan } from '../domain/parsed-stylesheet.js';
import type { ContextualRelationIdentity, ObservedRelationIdentity, PureDeclarationIdentity } from '../domain/readable-name.js';

export type ContextualDeclarationIdentity = ContextualRelationIdentity & {
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

export type ObservedDeclarationIdentity = (ObservedRelationIdentity | GroupedObservationIdentity) & {
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
  selector: string;
  wrappers?: readonly ParsedCondition[];
  layer?: string | null;
  relationRank?: number;
  physicalDeclarations?: readonly PhysicalDeclaration[];
  source: SourceSpan;
};

