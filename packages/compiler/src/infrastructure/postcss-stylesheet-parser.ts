import postcss, { type Declaration } from 'postcss';
import selectorParser, { type ClassName, type Combinator } from 'postcss-selector-parser';
import type { GssDiagnostic } from '../public-types.js';

export type ParsedDeclaration = {
  property: string;
  value: string;
  important: boolean;
};

export type ParsedStyleRule = {
  path: readonly string[];
  declarations: readonly ParsedDeclaration[];
};

export type ParsedStylesheet = {
  rules: readonly ParsedStyleRule[];
  diagnostics: readonly GssDiagnostic[];
};

export function parseStylesheet(id: string, source: string): ParsedStylesheet {
  let root: postcss.Root;
  try {
    root = postcss.parse(source, { from: id });
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

  for (const node of root.nodes) {
    if (node.type !== 'rule') {
      diagnostics.push(unsupportedDiagnostic(id, `Unsupported top-level ${node.type}.`));
      continue;
    }

    const path = parseDescendantClassPath(node.selector);
    if (!path) {
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

    if (valid) rules.push({ path, declarations });
  }

  return { rules, diagnostics };
}

function parseDescendantClassPath(selector: string): readonly string[] | undefined {
  const root = selectorParser().astSync(selector);
  if (root.nodes.length !== 1) return undefined;

  const nodes = root.nodes[0]?.nodes ?? [];
  const path: string[] = [];
  let expectClass = true;
  for (const node of nodes) {
    if (expectClass && node.type === 'class') {
      path.push((node as ClassName).value);
      expectClass = false;
      continue;
    }
    if (!expectClass && node.type === 'combinator' && (node as Combinator).value.trim() === '') {
      expectClass = true;
      continue;
    }
    return undefined;
  }

  return path.length > 0 && !expectClass ? path : undefined;
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
