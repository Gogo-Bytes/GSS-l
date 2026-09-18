import postcss, { type Declaration } from 'postcss';
import postcssNesting from 'postcss-nesting';
import selectorParser, {
  type Attribute,
  type ClassName,
  type Combinator,
  type Node,
  type Pseudo
} from 'postcss-selector-parser';
import { isSupportedPseudoState } from '../domain/pseudo-state-capabilities.js';
import type { GssDiagnostic } from '../public-types.js';

export type ParsedDeclaration = {
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

export type ParsedStyleRule = {
  path: readonly string[];
  relations: readonly SelectorRelation[];
  states: readonly (readonly string[])[];
  attributes: readonly (readonly ParsedAttributeCondition[])[];
  declarations: readonly ParsedDeclaration[];
  sourceOrdinal: number;
};

export type ParsedStylesheet = {
  rules: readonly ParsedStyleRule[];
  diagnostics: readonly GssDiagnostic[];
};

export function parseStylesheet(id: string, source: string): ParsedStylesheet {
  let root: postcss.Root;
  try {
    root = postcss([postcssNesting()]).process(source, { from: id }).sync().root;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      rules: [],
      diagnostics: [{
        code: 'GSS1001',
        severity: 'error',
        phase: 'parse',
        message,
        id
      }]
    };
  }

  const diagnostics: GssDiagnostic[] = [];
  const rules: ParsedStyleRule[] = [];

  for (const [sourceOrdinal, node] of root.nodes.entries()) {
    if (node.type !== 'rule') {
      diagnostics.push(unsupportedDiagnostic(id, `Unsupported top-level ${node.type}.`));
      continue;
    }

    const paths = parseDescendantClassPaths(node.selector);
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
      declarations.push(toDeclaration(child));
    }

    if (valid) {
      for (const path of paths) rules.push({ ...path, declarations, sourceOrdinal });
    }
  }

  return { rules, diagnostics };
}

type ParsedSelectorPath = {
  path: readonly string[];
  relations: readonly SelectorRelation[];
  states: readonly (readonly string[])[];
  attributes: readonly (readonly ParsedAttributeCondition[])[];
};

function parseDescendantClassPaths(selector: string): readonly ParsedSelectorPath[] | undefined {
  const root = selectorParser().astSync(selector);
  const paths: ParsedSelectorPath[] = [];
  for (const branch of root.nodes) {
    const path = parseClassPath(branch.nodes);
    if (!path) return undefined;
    paths.push(path);
  }
  return paths.length > 0 ? paths : undefined;
}

function parseClassPath(nodes: readonly Node[]): ParsedSelectorPath | undefined {
  const path: string[] = [];
  const relations: SelectorRelation[] = [];
  const states: string[][] = [];
  const attributes: ParsedAttributeCondition[][] = [];
  let expectClass = true;
  for (const node of nodes) {
    if (expectClass && node.type === 'class') {
      path.push((node as ClassName).value);
      states.push([]);
      attributes.push([]);
      expectClass = false;
      continue;
    }
    if (!expectClass && node.type === 'pseudo' && node.nodes.length === 0) {
      const state = node.value.slice(1);
      if (!isSupportedPseudoState(state)) return undefined;
      states.at(-1)?.push(state);
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
      attributes
    }
    : undefined;
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

function toDeclaration(declaration: Declaration): ParsedDeclaration {
  return {
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
