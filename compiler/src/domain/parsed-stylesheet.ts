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
  /** Number of externally supplied classes in a class-only residual compound. */
  observedResidualClassCount?: number;
  /** Complex admitted residual: browser retains specificity; scalar planner proofs cannot use it. */
  nativeSpecificity?: true;
};

export type ParsedCondition = {
  kind: 'media' | 'supports' | 'container';
  query: string;
};

/** A parser node binds all conditions to one ownership name. Relations stay
 * between adjacent nodes; neither implies a DOM ancestor without a proof. */
export type ParsedSelectorNode = {
  name: string;
  states: readonly string[];
  attributes: readonly ParsedAttributeCondition[];
  observations: readonly ParsedHasCondition[];
  pseudoElement: string | null;
};

/** One normalized selector branch, shared by parser and planning rules. */
export type ParsedSelector = {
  selector: string;
  /** A browser-matched external descendant; nodes remain the GSS-owned anchor. */
  externalTarget?: string;
  /** An externally supplied class condition on the owned declaration target. */
  externalCondition?: string;
  nodes: readonly ParsedSelectorNode[];
  relations: readonly SelectorRelation[];
};

export type ParsedSourceRule = ParsedSelector & {
  source: SourceSpan;
  conditions: readonly ParsedCondition[];
  layer: string;
  declarations: readonly ParsedDeclaration[];
  sourceOrdinal: number;
};

export type ParsedStyleRule = ParsedSourceRule & {
  /** Temporary ownership path projection; it does not prove DOM ancestry. */
  path: readonly string[];
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
