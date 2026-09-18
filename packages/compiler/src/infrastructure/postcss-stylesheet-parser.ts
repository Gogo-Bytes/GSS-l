import postcss, { type Declaration } from 'postcss';
import postcssNesting from 'postcss-nesting';
import selectorParser, { type ClassName, type Combinator, type Node } from 'postcss-selector-parser';
import type { GssDiagnostic } from '../public-types.js';

export type ParsedDeclaration = {
  property: string;
  value: string;
  important: boolean;
};

export type SelectorRelation = 'descendant' | 'child' | 'adjacent' | 'general-sibling';

export type ParsedStyleRule = {
  path: readonly string[];
  relations: readonly SelectorRelation[];
  states: readonly (readonly string[])[];
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
  let expectClass = true;
  for (const node of nodes) {
    if (expectClass && node.type === 'class') {
      path.push((node as ClassName).value);
      states.push([]);
      expectClass = false;
      continue;
    }
    if (!expectClass && node.type === 'pseudo' && node.value === ':hover' && node.nodes.length === 0) {
      states.at(-1)?.push('hover');
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

  return path.length > 0 && !expectClass ? { path, relations, states } : undefined;
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
