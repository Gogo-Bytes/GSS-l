/** Original source coordinates: zero-based UTF-16 code units, [start, end).
 * Selector branches use the enclosing authored rule span, not generated selector offsets.
 * Provenance is inspection-only and must not participate in semantic identity or ordering.
 */
export type SourceSpan = {
  readonly sourceId: string;
  readonly start: number;
  readonly end: number;
};

export type ParsedDeclaration = {
  source: SourceSpan;
  property: string;
  value: string;
  important: boolean;
};

export type SelectorRelation = 'descendant' | 'child' | 'adjacent' | 'general-sibling';

export type ParsedAttributeCondition = {
  attribute: string;
  operator: '=';
  value: string;
};

export type ParsedHasCondition = {
  relation: 'descendant' | 'child' | 'adjacent' | 'general-sibling';
  observedClass?: string;
  observedState?: string;
  observedResidual?: string;
};

export type ParsedCondition = {
  kind: 'media' | 'supports' | 'container';
  query: string;
};

export type ParsedStyleRule = {
  source: SourceSpan;
  selector: string;
  path: readonly string[];
  relations: readonly SelectorRelation[];
  states: readonly (readonly string[])[];
  attributes: readonly (readonly ParsedAttributeCondition[])[];
  observations: readonly (readonly ParsedHasCondition[])[];
  pseudoElements: readonly (string | null)[];
  conditions: readonly ParsedCondition[];
  layer: string;
  declarations: readonly ParsedDeclaration[];
  sourceOrdinal: number;
};

export type ParsedPropertyRegistration = {
  source: SourceSpan;
  kind: 'property';
  name: string;
  declarations: readonly ParsedDeclaration[];
};

export type ParsedKeyframesRegistration = {
  source: SourceSpan;
  kind: 'keyframes';
  name: string;
  conditions: readonly ParsedCondition[];
  layer: string;
  frames: readonly {
    source: SourceSpan;
    selector: string;
    declarations: readonly ParsedDeclaration[];
  }[];
};

export type ParsedFontFaceResource = {
  source: SourceSpan;
  kind: 'font-face';
  declarations: readonly ParsedDeclaration[];
};

export type ParsedGlobalResource =
  | ParsedPropertyRegistration
  | ParsedKeyframesRegistration
  | ParsedFontFaceResource;
