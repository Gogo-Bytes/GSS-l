import postcss, { type Declaration } from 'postcss';
import type { GssDiagnostic } from '../public-types.js';

export type ParsedDeclaration = {
  property: string;
  value: string;
  important: boolean;
};

export type ParsedStyleRule = {
  exportName: string;
  declarations: readonly ParsedDeclaration[];
};

export type ParsedStylesheet = {
  rules: readonly ParsedStyleRule[];
  diagnostics: readonly GssDiagnostic[];
};

const localClassSelector = /^\.([_A-Za-z][_A-Za-z0-9-]*)$/;

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

    const match = localClassSelector.exec(node.selector.trim());
    if (!match?.[1]) {
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

    if (valid) rules.push({ exportName: match[1], declarations });
  }

  return { rules, diagnostics };
}

function toDeclaration(declaration: Declaration): ParsedDeclaration {
  return {
    property: declaration.prop.toLowerCase(),
    value: declaration.value.trim(),
    important: declaration.important
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
