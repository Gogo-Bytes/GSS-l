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

/** One normalized selector branch. Path describes GSS ownership and does not
 * assert browser ancestry; node conditions remain bound to the same positions. */
export type ParsedSelector = {
  selector: string;
  /** A browser-matched external descendant; path remains the GSS-owned anchor. */
  externalTarget?: string;
  /** An externally supplied class condition on the owned declaration target. */
  externalCondition?: string;
  path: readonly string[];
  relations: readonly SelectorRelation[];
};

export type ParsedStyleRule = ParsedSelector & {
  /** Canonical parser nodes; path is a temporary planning projection. */
  nodes: readonly ParsedSelectorNode[];
  source: SourceSpan;
  conditions: readonly ParsedCondition[];
  layer: string;
  declarations: readonly ParsedDeclaration[];
  sourceOrdinal: number;
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

export type ParsedSourceRule = Omit<ParsedStyleRule, keyof ParsedSelector> & {
  selector: string;
  externalTarget?: string;
  externalCondition?: string;
  nodes: readonly ParsedSelectorNode[];
  relations: readonly SelectorRelation[];
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
