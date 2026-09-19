import { parse } from '@babel/parser';
import traverseModule, { type Binding, type TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import MagicString, { type SourceMap } from 'magic-string';

const traverse = (
  typeof traverseModule === 'function' ? traverseModule : traverseModule.default
) as unknown as (node: t.Node, options?: TraverseOptions) => void;

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
  importNode: t.ImportDefaultSpecifier;
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
  const verifiedBindings = resolveReferenceBindings(ast, bindings);
  const aliasReferences = resolveAliasReferences(ast, verifiedBindings);
  const output = new MagicString(input.source);
  const diagnostics: ReactGssDiagnostic[] = [];

  visit(ast.program, (node) => {
    if (
      !t.isJSXAttribute(node) ||
      !t.isJSXIdentifier(node.name, { name: 'className' }) ||
      !t.isJSXExpressionContainer(node.value)
    ) return;

    visitWithParent(node.value.expression, undefined, (expression, parent) => {
      if (t.isIdentifier(expression)) {
        if (t.isMemberExpression(parent) && parent.object === expression) return;
        const aliasKind = aliasReferences.get(expression);
        if (aliasKind === 'scope' && expression.end != null) {
          output.appendLeft(expression.end, '.self');
        } else if (aliasKind === 'mutable') {
          diagnostics.push({
            code: 'GSS2103',
            severity: 'error',
            phase: 'transform',
            message: `Mutable GSS scope alias ${expression.name} cannot be lowered safely.`,
            id: input.id,
            reason: 'mutable-scope-alias',
            suggestion: 'Use a const scope alias or pass an explicit .self string.'
          });
        } else if (aliasKind === 'ambiguous') {
          diagnostics.push({
            code: 'GSS2104',
            severity: 'error',
            phase: 'transform',
            message: `Alias ${expression.name} mixes a GSS scope with a non-scope value.`,
            id: input.id,
            reason: 'ambiguous-scope-alias',
            suggestion: 'Make every branch a GSS scope or pass explicit class strings.'
          });
        }
        return;
      }
      if (!t.isMemberExpression(expression)) return;
      if (t.isMemberExpression(parent) && parent.object === expression) return;

      const binding = verifiedBindings.get(expression);
      if (!binding) return;
      const reference = readStaticReference(expression);
      if (!reference) {
        const bindingName = readReferenceRoot(expression);
        if (bindingName) {
          diagnostics.push({
            code: 'GSS2101',
            severity: 'error',
            phase: 'transform',
            message: `Unsupported dynamic GSS scope expression rooted at ${bindingName}.`,
            id: input.id,
            reason: 'unsupported-scope-expression',
            suggestion: 'Use a static GSS scope path.'
          });
        }
        return;
      }
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
      if (!hasExplicitSelf && expression.end != null) {
        output.appendLeft(expression.end, '.self');
      }
    });
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
    if (defaultImport && schema) {
      bindings.set(defaultImport.local.name, { schema, importNode: defaultImport });
    }
  }
  return bindings;
}

function resolveReferenceBindings(
  ast: t.File,
  bindings: ReadonlyMap<string, GssBinding>
): WeakMap<t.MemberExpression, GssBinding> {
  const resolved = new WeakMap<t.MemberExpression, GssBinding>();
  traverse(ast, {
    MemberExpression(path) {
      const bindingName = readReferenceRoot(path.node);
      if (!bindingName) return;
      const candidate = bindings.get(bindingName);
      const lexicalBinding = path.scope.getBinding(bindingName);
      if (candidate && lexicalBinding?.path.node === candidate.importNode) {
        resolved.set(path.node, candidate);
      }
    }
  });
  return resolved;
}

type AliasKind = 'scope' | 'mutable' | 'ambiguous';

type ScopeExpressionKind = 'scope' | 'non-scope' | 'ambiguous';

function resolveAliasReferences(
  ast: t.File,
  verifiedBindings: WeakMap<t.MemberExpression, GssBinding>
): WeakMap<t.Identifier, AliasKind> {
  const aliases = new Map<Binding, AliasKind>();
  traverse(ast, {
    VariableDeclarator(path) {
      const { id, init } = path.node;
      if (!init) return;
      if (t.isIdentifier(id)) {
        const expressionKind = classifyScopeExpression(init, verifiedBindings);
        if (expressionKind === 'non-scope') return;
        const binding = path.scope.getBinding(id.name);
        if (!binding) return;
        aliases.set(binding, aliasKindForBinding(binding, expressionKind));
        return;
      }
      if (!t.isObjectPattern(id) || !t.isMemberExpression(init)) return;
      const base = readVerifiedScopeExpression(init, verifiedBindings);
      if (!base) return;
      for (const property of id.properties) {
        if (!t.isObjectProperty(property) || property.computed || !t.isIdentifier(property.value)) {
          continue;
        }
        const targetName = t.isIdentifier(property.key)
          ? property.key.name
          : t.isStringLiteral(property.key)
            ? property.key.value
            : undefined;
        if (!targetName) continue;
        const targetPath = [...base.path, targetName];
        if (!resolveScopePath(base.binding.schema, targetPath)) continue;
        const binding = path.scope.getBinding(property.value.name);
        if (binding) aliases.set(binding, aliasKindForBinding(binding, 'scope'));
      }
    }
  });

  const references = new WeakMap<t.Identifier, AliasKind>();
  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) return;
      const binding = path.scope.getBinding(path.node.name);
      const kind = binding ? aliases.get(binding) : undefined;
      if (kind) references.set(path.node, kind);
    }
  });
  return references;
}

function aliasKindForBinding(
  binding: Binding,
  expressionKind: Exclude<ScopeExpressionKind, 'non-scope'>
): AliasKind {
  return binding.kind === 'const' && binding.constant ? expressionKind : 'mutable';
}

function classifyScopeExpression(
  expression: t.Expression,
  verifiedBindings: WeakMap<t.MemberExpression, GssBinding>
): ScopeExpressionKind {
  if (t.isMemberExpression(expression)) {
    return readVerifiedScopeExpression(expression, verifiedBindings) ? 'scope' :
      verifiedBindings.has(expression) ? 'ambiguous' : 'non-scope';
  }
  if (t.isConditionalExpression(expression)) {
    const consequent = classifyScopeExpression(expression.consequent, verifiedBindings);
    const alternate = classifyScopeExpression(expression.alternate, verifiedBindings);
    if (consequent === 'scope' && alternate === 'scope') return 'scope';
    if (consequent !== 'non-scope' || alternate !== 'non-scope') return 'ambiguous';
  }
  return 'non-scope';
}

function readVerifiedScopeExpression(
  expression: t.MemberExpression,
  verifiedBindings: WeakMap<t.MemberExpression, GssBinding>
): { binding: GssBinding; path: readonly string[] } | undefined {
  const binding = verifiedBindings.get(expression);
  const reference = readStaticReference(expression);
  if (
    !binding ||
    !reference ||
    reference.path.at(-1) === 'self' ||
    !resolveScopePath(binding.schema, reference.path)
  ) return undefined;
  return { binding, path: reference.path };
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

function readReferenceRoot(expression: t.MemberExpression): string | undefined {
  let current: t.Expression | t.Super = expression;
  while (t.isMemberExpression(current)) current = current.object;
  return t.isIdentifier(current) ? current.name : undefined;
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

function visitWithParent(
  node: t.Node,
  parent: t.Node | undefined,
  callback: (node: t.Node, parent: t.Node | undefined) => void
): void {
  callback(node, parent);
  const keys = t.VISITOR_KEYS[node.type] ?? [];
  for (const key of keys) {
    const child = node[key as keyof t.Node] as unknown;
    if (Array.isArray(child)) {
      for (const item of child) if (t.isNode(item)) visitWithParent(item, node, callback);
    } else if (t.isNode(child)) {
      visitWithParent(child, node, callback);
    }
  }
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
