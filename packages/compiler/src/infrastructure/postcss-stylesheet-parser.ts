import postcss, { CssSyntaxError, type Declaration } from 'postcss';
import PreviousMap from 'postcss/lib/previous-map';
import Parser from 'postcss/lib/parser';
import postcssNesting from 'postcss-nesting';
import selectorParser, {
  type Attribute,
  type ClassName,
  type Combinator,
  type Node,
  type Pseudo
} from 'postcss-selector-parser';
import { isSupportedPseudoElement } from '../domain/pseudo-element-capabilities.js';
import { isSupportedPseudoState } from '../domain/pseudo-state-capabilities.js';
import type { GssDiagnostic } from '../public-types.js';

import type {
  ParsedDeclaration, SelectorRelation, ParsedAttributeCondition, ParsedHasCondition,
  ParsedCondition, ParsedStyleRule, ParsedPropertyRegistration, ParsedKeyframesRegistration,
  ParsedFontFaceResource, ParsedGlobalResource, SourceSpan
} from '../domain/parsed-stylesheet.js';
import type { ParsedStylesheet } from '../application/css-parser-port.js';

export function parseStylesheet(id: string, source: string): ParsedStylesheet {
  try {
    return parseAndNormalizeStylesheet(id, source);
  } catch (error) {
    // Rule.error gives selector-parser the same typed author-error channel as PostCSS.
    // Invariant failures and unexpected adapter errors must still escape.
    if (!(error instanceof CssSyntaxError)) throw error;
    return {
      rules: [],
      resources: [],
      diagnostics: [{
        code: 'GSS1001',
        severity: 'error',
        phase: 'parse',
        message: 'Invalid CSS syntax.',
        id
      }]
    };
  }
}

function validateInlineSourceMap(source: string): boolean {
  // Use PostCSS's last-annotation discovery without decoding or external-map IO.
  // This exported infrastructure seam keeps encoding/schema handling identical to Input.
  const annotation = new PreviousMap(source, { map: { prev: false } });
  if (!annotation.inline) return false;
  try {
    const map = new PreviousMap(source, {});
    // Input skips the consumer for empty decoded payloads as well.
    if (!map.text) return false;
    map.consumer();
    return true;
  } catch (error) {
    // Inline decoding/consumer validation uses untyped Errors for malformed author data.
    // Only those data operations are enclosed here, never CSS parsing or normalization.
    if (!(error instanceof Error)) throw error;
    throw new CssSyntaxError('Invalid inline source map.');
  }
}

function parseAuthoredStylesheet(id: string, source: string): postcss.Root {
  if (!validateInlineSourceMap(source)) return postcss.parse(source, { from: id });

  // postcss.parse constructs Input internally, leaving no instance-local hook before
  // syntax errors look up lazy mappings. Use its exported Parser only for inline maps.
  const input = new postcss.Input(source, { from: id });
  const consumer = input.map.consumer();
  const originalPositionFor = consumer.originalPositionFor;
  consumer.originalPositionFor = function (...args) {
    try {
      return originalPositionFor.apply(this, args);
    } catch (error) {
      // Only authored map lookup is enclosed, never parsing or Input.error itself.
      if (!(error instanceof Error)) throw error;
      throw new CssSyntaxError('Invalid inline source map.');
    }
  };
  const parser = new Parser(input);
  parser.parse();
  return parser.root;
}

function parseAndNormalizeStylesheet(id: string, source: string): ParsedStylesheet {
  const authored = parseAuthoredStylesheet(id, source);
  const originalSpans = new WeakMap<postcss.Source, SourceSpan>();
  authored.walk((node) => {
    const origin = node.source;
    if (!origin?.start || !origin.end) throw new Error('Missing authored CSS source span.');
    // PostCSS removes one leading U+FEFF/U+FFFE before assigning node offsets.
    const inputOffset = origin.input.hasBOM ? 1 : 0;
    originalSpans.set(origin, {
      sourceId: id,
      start: origin.start.offset + inputOffset,
      end: origin.end.offset + inputOffset
    });
  });
  const spanOf: SourceSpanReader = (node) => {
    // PostCSS clones retain the original Source object. Never infer offsets from regenerated CSS.
    const span = node.source && originalSpans.get(node.source);
    if (!span) throw new Error('Normalized CSS node has no original source span.');
    return span;
  };
  authored.walkRules((rule) => {
    // Frame selectors have a separate resource grammar, not a scope selector grammar.
    if (rule.parent?.type === 'atrule' && rule.parent.name === 'keyframes') return;
    // Validate before nesting can discard or rewrite an invalid branch.
    selectorParser().astSync(rule);
  });
  const root = postcss([postcssNesting()]).process(authored, { from: id }).sync().root;

  const diagnostics: GssDiagnostic[] = [];
  const rules: ParsedStyleRule[] = [];
  const resources: ParsedGlobalResource[] = [];

  let sourceOrdinal = 0;
  const visitNodes = (
    nodes: readonly postcss.ChildNode[],
    conditions: readonly ParsedCondition[],
    layer: string
  ): void => {
    for (const node of nodes) {
      if (node.type === 'atrule') {
        if (node.name === 'font-face') {
          const fontFace = parseFontFaceResource(node, conditions, layer, spanOf);
          if (!fontFace) {
            diagnostics.push(unsupportedDiagnostic(id, 'Unsupported @font-face resource.'));
          } else {
            resources.push(fontFace);
          }
          continue;
        }
        if (node.name === 'keyframes') {
          const keyframes = parseKeyframesRegistration(node, conditions, layer, spanOf);
          if (!keyframes) {
            diagnostics.push(unsupportedDiagnostic(id, 'Unsupported @keyframes resource.'));
          } else {
            resources.push(keyframes);
          }
          continue;
        }
        if (node.name === 'property') {
          const registration = parsePropertyRegistration(node, conditions, layer, spanOf);
          if (!registration) {
            diagnostics.push(unsupportedDiagnostic(id, 'Unsupported @property registration.'));
          } else {
            resources.push(registration);
          }
          continue;
        }
        if (node.name === 'layer' && node.nodes && isNamedLayer(node.params.trim())) {
          const name = node.params.trim();
          visitNodes(node.nodes, conditions, layer === 'unlayered' ? name : `${layer}.${name}`);
          continue;
        }
        if (!isSupportedConditionKind(node.name) || !node.nodes) {
          diagnostics.push(unsupportedDiagnostic(id, `Unsupported @${node.name} rule.`));
          continue;
        }
        visitNodes(
          node.nodes,
          [...conditions, { kind: node.name, query: node.params.trim() }],
          layer
        );
        continue;
      }
      if (node.type !== 'rule') {
        diagnostics.push(unsupportedDiagnostic(id, `Unsupported top-level ${node.type}.`));
        continue;
      }

      const paths = parseDescendantClassPaths(node);
      if (!paths) {
        diagnostics.push(unsupportedDiagnostic(id, `Unsupported selector: ${node.selector}`));
        continue;
      }

      const declarations: ParsedDeclaration[] = [];
      let valid = true;
      for (const child of node.nodes) {
        if (child.type !== 'decl') {
          diagnostics.push(unsupportedDiagnostic(id, `Unsupported nested ${child.type} in ${node.selector}.`));
          valid = false;
          continue;
        }
        declarations.push(toDeclaration(child, spanOf));
      }

      if (valid) {
        for (const path of paths) {
          rules.push({ ...path, conditions, layer, declarations, sourceOrdinal, source: spanOf(node) });
        }
      }
      sourceOrdinal += 1;
    }
  };
  visitNodes(root.nodes, [], 'unlayered');

  return { rules, resources, diagnostics };
}

function parseFontFaceResource(
  node: postcss.AtRule,
  conditions: readonly ParsedCondition[],
  layer: string,
  spanOf: SourceSpanReader
): ParsedFontFaceResource | undefined {
  if (conditions.length > 0 || layer !== 'unlayered' || node.params.trim() || !node.nodes) {
    return undefined;
  }
  const declarations: ParsedDeclaration[] = [];
  for (const child of node.nodes) {
    if (child.type !== 'decl' || child.important) return undefined;
    declarations.push(toDeclaration(child, spanOf));
  }
  const descriptors = new Set(declarations.map(({ property }) => property));
  if (!descriptors.has('font-family') || !descriptors.has('src')) return undefined;
  return { kind: 'font-face', declarations, source: spanOf(node) };
}

function parseKeyframesRegistration(
  node: postcss.AtRule,
  conditions: readonly ParsedCondition[],
  layer: string,
  spanOf: SourceSpanReader
): ParsedKeyframesRegistration | undefined {
  const name = node.params.trim();
  if (!/^[-_A-Za-z][-_A-Za-z0-9]*$/.test(name) || !node.nodes) return undefined;

  const frames: ParsedKeyframesRegistration['frames'][number][] = [];
  for (const child of node.nodes) {
    if (child.type !== 'rule' || !isKeyframeSelector(child.selector)) return undefined;
    const declarations: ParsedDeclaration[] = [];
    for (const declaration of child.nodes) {
      if (declaration.type !== 'decl' || declaration.important) return undefined;
      declarations.push(toDeclaration(declaration, spanOf));
    }
    frames.push({ selector: child.selector.trim(), declarations, source: spanOf(child) });
  }
  return { kind: 'keyframes', name, conditions, layer, frames, source: spanOf(node) };
}

function isKeyframeSelector(selector: string): boolean {
  return selector.split(',').every((part) => {
    const value = part.trim();
    if (value === 'from' || value === 'to') return true;
    if (!/^\d+(?:\.\d+)?%$/.test(value)) return false;
    const percentage = Number(value.slice(0, -1));
    return percentage >= 0 && percentage <= 100;
  });
}

function parsePropertyRegistration(
  node: postcss.AtRule,
  conditions: readonly ParsedCondition[],
  layer: string,
  spanOf: SourceSpanReader
): ParsedPropertyRegistration | undefined {
  const name = node.params.trim();
  if (
    conditions.length > 0 ||
    layer !== 'unlayered' ||
    !/^--[-_A-Za-z0-9]+$/.test(name) ||
    !node.nodes
  ) return undefined;

  const declarations: ParsedDeclaration[] = [];
  for (const child of node.nodes) {
    if (child.type !== 'decl' || child.important) return undefined;
    declarations.push(toDeclaration(child, spanOf));
  }
  const descriptorNames = declarations.map(({ property }) => property);
  if (
    new Set(descriptorNames).size !== descriptorNames.length ||
    !descriptorNames.includes('syntax') ||
    !descriptorNames.includes('inherits')
  ) return undefined;
  return { kind: 'property', name, declarations, source: spanOf(node) };
}

type ParsedSelectorPath = {
  path: readonly string[];
  relations: readonly SelectorRelation[];
  states: readonly (readonly string[])[];
  attributes: readonly (readonly ParsedAttributeCondition[])[];
  observations: readonly (readonly ParsedHasCondition[])[];
  pseudoElements: readonly (string | null)[];
};

function isNamedLayer(value: string): boolean {
  return /^[-_A-Za-z][-_A-Za-z0-9]*(?:\.[-_A-Za-z][-_A-Za-z0-9]*)*$/.test(value);
}

function isSupportedConditionKind(
  name: string
): name is ParsedCondition['kind'] {
  return name === 'media' || name === 'supports' || name === 'container';
}

function parseDescendantClassPaths(
  rule: postcss.Rule
): readonly (ParsedSelectorPath & { selector: string })[] | undefined {
  const root = selectorParser().astSync(rule);
  const paths: (ParsedSelectorPath & { selector: string })[] = [];
  for (const branch of root.nodes) {
    const path = parseClassPath(branch.nodes);
    if (!path) return undefined;
    paths.push({ ...path, selector: branch.toString() });
  }
  return paths.length > 0 ? paths : undefined;
}

function parseClassPath(nodes: readonly Node[]): ParsedSelectorPath | undefined {
  const path: string[] = [];
  const relations: SelectorRelation[] = [];
  const states: string[][] = [];
  const attributes: ParsedAttributeCondition[][] = [];
  const observations: ParsedHasCondition[][] = [];
  const pseudoElements: (string | null)[] = [];
  let expectClass = true;
  for (const node of nodes) {
    if (expectClass && node.type === 'class') {
      path.push((node as ClassName).value);
      states.push([]);
      attributes.push([]);
      observations.push([]);
      pseudoElements.push(null);
      expectClass = false;
      continue;
    }
    if (!expectClass && node.type === 'pseudo' && node.nodes.length === 0) {
      if (node.value.startsWith('::')) {
        const pseudoElement = node.value.slice(2);
        if (!isSupportedPseudoElement(pseudoElement) || pseudoElements.at(-1)) return undefined;
        pseudoElements[pseudoElements.length - 1] = pseudoElement;
        continue;
      }
      if (pseudoElements.at(-1)) return undefined;
      const state = node.value.slice(1);
      if (!isSupportedPseudoState(state)) return undefined;
      states.at(-1)?.push(state);
      continue;
    }
    if (!expectClass && node.type === 'pseudo' && node.value === ':has') {
      const parsedObservations = parseHasConditions(node as Pseudo);
      if (!parsedObservations) return undefined;
      observations.at(-1)?.push(...parsedObservations);
      continue;
    }
    if (!expectClass && node.type === 'pseudo' && node.nodes.length > 0) {
      const condition = parseFunctionalState(node as Pseudo);
      if (!condition) return undefined;
      states.at(-1)?.push(condition);
      continue;
    }
    if (!expectClass && node.type === 'attribute') {
      const condition = parseAttributeCondition(node as Attribute);
      if (!condition) return undefined;
      attributes.at(-1)?.push(condition);
      continue;
    }
    if (!expectClass && node.type === 'combinator') {
      const combinator = (node as Combinator).value.trim();
      if (!['', '>', '+', '~'].includes(combinator)) return undefined;
      relations.push(
        combinator === '>'
          ? 'child'
          : combinator === '+'
            ? 'adjacent'
            : combinator === '~'
              ? 'general-sibling'
              : 'descendant'
      );
      expectClass = true;
      continue;
    }
    return undefined;
  }

  return path.length > 0 && !expectClass
    ? {
      path,
      relations,
      states: states.map((state) => [...new Set(state)].sort()),
      attributes,
      observations,
      pseudoElements
    }
    : undefined;
}

function parseHasConditions(pseudo: Pseudo): readonly ParsedHasCondition[] | undefined {
  const conditions: ParsedHasCondition[] = [];
  for (const selector of pseudo.nodes) {
    const condition = parseHasSelector(selector.nodes);
    if (!condition) return undefined;
    conditions.push(condition);
  }
  return conditions.length > 0 ? conditions : undefined;
}

function parseHasSelector(nodes: readonly Node[]): ParsedHasCondition | undefined {
  let index = 0;
  let relation: ParsedHasCondition['relation'] = 'descendant';
  if (nodes[index]?.type === 'combinator') {
    const runtimeRelation = parseRuntimeRelation((nodes[index] as Combinator).value.trim());
    if (!runtimeRelation) return undefined;
    relation = runtimeRelation;
    index += 1;
  }

  const observed = nodes[index];
  if (!observed) return undefined;
  index += 1;

  if (observed.type === 'class') {
    let observedState: string | undefined;
    const stateNode = nodes[index];
    if (stateNode) {
      if (stateNode.type !== 'pseudo' || stateNode.nodes.length > 0) return undefined;
      const state = stateNode.value.slice(1);
      if (!isSupportedPseudoState(state)) return undefined;
      observedState = state;
      index += 1;
    }
    if (index !== nodes.length) return undefined;
    return {
      relation,
      observedClass: (observed as ClassName).value,
      ...(observedState ? { observedState } : {})
    };
  }

  if (index !== nodes.length) return undefined;
  if (observed.type === 'attribute') {
    const condition = parseAttributeCondition(observed as Attribute);
    return condition
      ? { relation, observedResidual: renderParsedAttributeCondition(condition) }
      : undefined;
  }
  if (observed.type === 'tag' && observed.namespace === undefined) {
    return { relation, observedResidual: observed.value };
  }
  if (observed.type === 'pseudo' && observed.nodes.length === 0) {
    const state = observed.value.slice(1);
    return isSupportedPseudoState(state)
      ? { relation, observedResidual: `:${state}` }
      : undefined;
  }
  return undefined;
}

function parseRuntimeRelation(
  combinator: string
): 'child' | 'adjacent' | 'general-sibling' | undefined {
  if (combinator === '>') return 'child';
  if (combinator === '+') return 'adjacent';
  if (combinator === '~') return 'general-sibling';
  return undefined;
}

function parseFunctionalState(pseudo: Pseudo): string | undefined {
  const name = pseudo.value.slice(1);
  if (!['not', 'is', 'where'].includes(name)) return undefined;

  const branches: string[] = [];
  for (const selector of pseudo.nodes) {
    if (selector.nodes.length !== 1) return undefined;
    const branch = selector.nodes[0]!;
    if (branch.type === 'pseudo' && branch.nodes.length === 0) {
      const state = branch.value.slice(1);
      if (!isSupportedPseudoState(state)) return undefined;
      branches.push(`:${state}`);
      continue;
    }
    if (branch.type === 'attribute') {
      const condition = parseAttributeCondition(branch as Attribute);
      if (!condition) return undefined;
      branches.push(renderParsedAttributeCondition(condition));
      continue;
    }
    return undefined;
  }

  const canonicalBranches = [...new Set(branches)].sort();
  return canonicalBranches.length > 0
    ? `${name}(${canonicalBranches.join(',')})`
    : undefined;
}

function parseAttributeCondition(attribute: Attribute): ParsedAttributeCondition | undefined {
  if (
    attribute.operator !== '=' ||
    typeof attribute.value !== 'string' ||
    attribute.insensitive !== undefined ||
    attribute.namespace !== undefined
  ) return undefined;
  return {
    attribute: attribute.attribute,
    operator: '=',
    value: attribute.value
  };
}

function renderParsedAttributeCondition(condition: ParsedAttributeCondition): string {
  return `[${condition.attribute}=${JSON.stringify(condition.value)}]`;
}

type SourceSpanReader = (node: postcss.Node) => SourceSpan;

function toDeclaration(declaration: Declaration, spanOf: SourceSpanReader): ParsedDeclaration {
  return {
    source: spanOf(declaration),
    property: declaration.prop.toLowerCase(),
    value: declaration.value.trim(),
    important: declaration.important === true
  };
}

function unsupportedDiagnostic(id: string, message: string): GssDiagnostic {
  return {
    code: 'GSS1101',
    severity: 'error',
    phase: 'validate',
    message,
    id,
    reason: 'capability-not-registered'
  };
}
