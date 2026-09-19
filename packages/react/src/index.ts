import { parse } from '@babel/parser';
import * as t from '@babel/types';
import MagicString, { type SourceMap } from 'magic-string';

export type ReactScopeSchema = {
  exports: Readonly<Record<string, ReactScopeNodeSchema>>;
};

export type ReactScopeNodeSchema = {
  targets: Readonly<Record<string, ReactScopeNodeSchema>>;
};

export type ReactGssDiagnostic = {
  code: string;
  severity: 'error';
  phase: 'transform';
  message: string;
  id: string;
  reason: string;
  suggestion?: string;
};

export type TransformReactGssUsageInput = {
  id: string;
  source: string;
  resolveScopeSchema(importId: string): ReactScopeSchema | undefined;
};

export type TransformReactGssUsageResult = {
  code: string;
  map: SourceMap;
  diagnostics: readonly ReactGssDiagnostic[];
};

type GssBinding = {
  schema: ReactScopeSchema;
};

export function transformReactGssUsage(
  input: TransformReactGssUsageInput
): TransformReactGssUsageResult {
  const ast = parse(input.source, {
    sourceType: 'module',
    sourceFilename: input.id,
    plugins: ['typescript', 'jsx']
  });
  const bindings = collectGssBindings(ast.program, input.resolveScopeSchema);
  const output = new MagicString(input.source);
  const diagnostics: ReactGssDiagnostic[] = [];

  visit(ast.program, (node) => {
    if (
      !t.isJSXAttribute(node) ||
      !t.isJSXIdentifier(node.name, { name: 'className' }) ||
      !t.isJSXExpressionContainer(node.value) ||
      !t.isMemberExpression(node.value.expression)
    ) return;

    const reference = readStaticReference(node.value.expression);
    if (!reference) return;
    const binding = bindings.get(reference.binding);
    if (!binding) return;

    const hasExplicitSelf = reference.path.at(-1) === 'self';
    const scopePath = hasExplicitSelf ? reference.path.slice(0, -1) : reference.path;
    if (!resolveScopePath(binding.schema, scopePath)) {
      diagnostics.push({
        code: 'GSS2102',
        severity: 'error',
        phase: 'transform',
        message: `Unknown GSS scope path: ${[reference.binding, ...scopePath].join('.')}.`,
        id: input.id,
        reason: 'unknown-scope-path',
        suggestion: 'Use a path declared by the imported .gss Module.'
      });
      return;
    }
    if (!hasExplicitSelf && node.value.expression.end != null) {
      output.appendLeft(node.value.expression.end, '.self');
    }
  });

  return {
    code: output.toString(),
    map: output.generateMap({ source: input.id, includeContent: true, hires: true }),
    diagnostics
  };
}

function collectGssBindings(
  program: t.Program,
  resolveScopeSchema: TransformReactGssUsageInput['resolveScopeSchema']
): ReadonlyMap<string, GssBinding> {
  const bindings = new Map<string, GssBinding>();
  for (const statement of program.body) {
    if (!t.isImportDeclaration(statement) || !statement.source.value.endsWith('.gss')) continue;
    const defaultImport = statement.specifiers.find(t.isImportDefaultSpecifier);
    const schema = resolveScopeSchema(statement.source.value);
    if (defaultImport && schema) bindings.set(defaultImport.local.name, { schema });
  }
  return bindings;
}

function readStaticReference(
  expression: t.MemberExpression
): { binding: string; path: readonly string[] } | undefined {
  const path: string[] = [];
  let current: t.Expression | t.Super = expression;
  while (t.isMemberExpression(current)) {
    if (current.computed || !t.isIdentifier(current.property)) return undefined;
    path.unshift(current.property.name);
    current = current.object;
  }
  return t.isIdentifier(current) && path.length > 0
    ? { binding: current.name, path }
    : undefined;
}

function resolveScopePath(
  schema: ReactScopeSchema,
  path: readonly string[]
): ReactScopeNodeSchema | undefined {
  const [root, ...targets] = path;
  if (!root) return undefined;
  let scope = schema.exports[root];
  for (const target of targets) scope = scope?.targets[target];
  return scope;
}

function visit(node: t.Node, callback: (node: t.Node) => void): void {
  callback(node);
  const keys = t.VISITOR_KEYS[node.type] ?? [];
  for (const key of keys) {
    const child = node[key as keyof t.Node] as unknown;
    if (Array.isArray(child)) {
      for (const item of child) if (t.isNode(item)) visit(item, callback);
    } else if (t.isNode(child)) {
      visit(child, callback);
    }
  }
}
