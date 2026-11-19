import type { GssSourceAdapter } from '@gss-l/compiler';
import { parse } from '@babel/parser';
import traverseModule, { type Binding, type NodePath, type TraverseOptions } from '@babel/traverse';
import * as t from '@babel/types';
import MagicString, { type SourceMap } from 'magic-string';

const traverse = (typeof traverseModule === 'function' ? traverseModule : traverseModule.default) as unknown as
  (node: t.Node, options?: TraverseOptions) => void;

export type ReactScopeSchema = {
  /** Compiler module identity; absent in legacy schema views, so provenance is unknown. */
  moduleId?: string;
  exports: Readonly<Record<string, ReactScopeNodeSchema>>;
};
export type ReactScopeNodeSchema = { targets: Readonly<Record<string, ReactScopeNodeSchema>> };
export type ReactGssDiagnostic = {
  code: string; severity: 'error' | 'warning'; phase: 'transform'; message: string; id: string;
  reason: string; suggestion?: string; range?: { start: number; end: number };
};
export type TransformReactGssUsageInput = {
  id: string; source: string; resolveScopeSchema(importId: string): ReactScopeSchema | undefined;
};
export type TransformReactGssUsageResult = { code: string; map: SourceMap; diagnostics: readonly ReactGssDiagnostic[] };

function parseReactSource(id: string, source: string) {
  return parse(source, { sourceType: 'module', sourceFilename: id,
    plugins: /\.[cm]?ts$/.test(id) ? ['typescript'] : ['typescript', 'jsx'] });
}

function runtimeStyleImport(node: t.Node): node is t.ImportDeclaration {
  return t.isImportDeclaration(node) && node.importKind !== 'type' && node.source.value.endsWith('.gss');
}

export function react(): GssSourceAdapter {
  return {
    supports: (id) => /\.[cm]?[jt]sx?$/.test(id),
    discoverImports({ id, source }) {
      return [...new Set(parseReactSource(id, source).program.body.filter(runtimeStyleImport).map(n => n.source.value))];
    },
    transform: transformReactGssUsage
  };
}

function diagnosticRange(node: t.Node): Pick<ReactGssDiagnostic, 'range'> {
  return node.start == null || node.end == null ? {} : { range: { start: node.start, end: node.end } };
}

type KnownReference = { schema: ReactScopeSchema; known: boolean; explicitClass: boolean };
type AliasKind = 'scope' | 'non-scope' | 'mutable' | 'ambiguous';

export function transformReactGssUsage(input: TransformReactGssUsageInput): TransformReactGssUsageResult {
  const ast = parseReactSource(input.id, input.source);
  const output = new MagicString(input.source);
  const diagnostics: ReactGssDiagnostic[] = [];
  const imports = new Map<t.Node, ReactScopeSchema>();
  for (const node of ast.program.body.filter(runtimeStyleImport)) {
    const schema = input.resolveScopeSchema(node.source.value);
    if (!schema) diagnostics.push({ code: 'GSS2106', severity: 'error', phase: 'transform', id: input.id,
      message: `Missing GSS ScopeSchema for ${node.source.value}.`, reason: 'missing-scope-schema',
      suggestion: 'Compile the imported stylesheet successfully before source transformation.' });
    const specifier = node.specifiers.find(t.isImportDefaultSpecifier);
    if (schema && specifier) imports.set(specifier, schema);
  }
  const references = new WeakMap<t.MemberExpression, KnownReference>();
  traverse(ast, {
    MemberExpression(path) {
      if (t.isMemberExpression(path.parent) && path.parent.object === path.node) return;
      let root: t.Expression | t.Super = path.node;
      const names: string[] = [];
      let dynamic = false;
      while (t.isMemberExpression(root)) {
        if (root.computed || !t.isIdentifier(root.property)) dynamic = true;
        else names.unshift(root.property.name);
        root = root.object;
      }
      if (!t.isIdentifier(root)) return;
      const binding = path.scope.getBinding(root.name);
      const schema = binding && imports.get(binding.path.node);
      if (!schema) return;
      const explicitClass = names.length > 1 && names.at(-1) === '$class';
      if (explicitClass) names.pop();
      const known = !dynamic && !!resolveScopePath(schema, names);
      references.set(path.node, { schema, known, explicitClass });
      if (known && !explicitClass && path.node.end != null) output.appendLeft(path.node.end, '.$class');
    }
  });

  function classify(node: t.Node): AliasKind {
    if (t.isConditionalExpression(node)) {
      const left = classify(node.consequent), right = classify(node.alternate);
      return left === right ? left : 'ambiguous';
    }
    const ref = t.isMemberExpression(node) && references.get(node);
    return !ref ? 'non-scope' : !ref.known ? 'ambiguous' : ref.explicitClass ? 'non-scope' : 'scope';
  }
  const aliases = new Map<Binding, AliasKind>();
  traverse(ast, {
    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !path.node.init) return;
      const kind = classify(path.node.init);
      const binding = path.scope.getBinding(path.node.id.name);
      if (kind !== 'non-scope' && binding) aliases.set(binding, binding.kind === 'const' && binding.constant ? kind : 'mutable');
    }
  });
  traverse(ast, {
    JSXAttribute(path) {
      const { name, value } = path.node;
      if (!t.isJSXIdentifier(name, { name: 'className' }) || !t.isJSXExpressionContainer(value)) return;
      if (t.isJSXOpeningElement(path.parent) && t.isJSXIdentifier(path.parent.name) && /^[a-z]/.test(path.parent.name.name) &&
          definiteClassModules(value.expression, references).size > 1) {
        diagnostics.push({ code: 'GSS2107', severity: 'warning', phase: 'transform', id: input.id,
          message: 'Same-element className composition from multiple GSS modules is unsupported; there is no cross-module precedence guarantee.',
          reason: 'cross-module-class-composition', suggestion: 'Use scopes from one GSS module on this element.', ...diagnosticRange(path.node) });
      }
    },
    Identifier(path) {
      if (!path.isReferencedIdentifier() || !inClassName(path)) return;
      const binding = path.scope.getBinding(path.node.name);
      const kind = binding && aliases.get(binding);
      if (kind === 'mutable' || kind === 'ambiguous') diagnostics.push({
        code: kind === 'mutable' ? 'GSS2103' : 'GSS2104', severity: 'error', phase: 'transform', id: input.id,
        message: kind === 'mutable' ? `Mutable GSS scope alias ${path.node.name} cannot be lowered safely.` :
          `Alias ${path.node.name} mixes a GSS scope with a non-scope value.`,
        reason: kind === 'mutable' ? 'mutable-scope-alias' : 'ambiguous-scope-alias',
        suggestion: 'Use the imported path directly in className.', ...diagnosticRange(path.node) });
    }
  });
  return { code: output.toString(), map: output.generateMap({ source: input.id, includeContent: true, hires: true }), diagnostics };
}

function inClassName(path: NodePath): boolean {
  const parent = path.findParent(p => p.isJSXAttribute() || p.isFunction());
  return !!parent && t.isJSXAttribute(parent.node) && t.isJSXIdentifier(parent.node.name, { name: 'className' });
}

function resolveScopePath(schema: ReactScopeSchema, names: readonly string[]): ReactScopeNodeSchema | undefined {
  let nodes = schema.exports;
  let scope: ReactScopeNodeSchema | undefined;
  for (const name of names) {
    if (!Object.hasOwn(nodes, name)) return undefined;
    scope = nodes[name]!;
    nodes = scope.targets;
  }
  return scope;
}

/** Only string composition with definite, schema-backed provenance, never arbitrary calls. */
function definiteClassModules(node: t.Node, refs: WeakMap<t.MemberExpression, KnownReference>): ReadonlySet<string> {
  if (t.isMemberExpression(node)) {
    const ref = refs.get(node);
    return new Set(ref?.known && ref.schema.moduleId ? [ref.schema.moduleId] : []);
  }
  if (t.isBinaryExpression(node, { operator: '+' })) return new Set([
    ...definiteClassModules(node.left, refs), ...definiteClassModules(node.right, refs)]);
  if (t.isTemplateLiteral(node)) return new Set(node.expressions.flatMap(e => [...definiteClassModules(e, refs)]));
  if (t.isCallExpression(node) && t.isMemberExpression(node.callee) && !node.callee.computed &&
      t.isIdentifier(node.callee.property, { name: 'join' }) && t.isArrayExpression(node.callee.object) &&
      node.arguments.length === 1 && t.isStringLiteral(node.arguments[0], { value: ' ' })) {
    const elements = node.callee.object.elements;
    if (elements.every(e => e && (t.isStringLiteral(e) || (t.isMemberExpression(e) && definiteClassModules(e, refs).size === 1)))) {
      return new Set(elements.flatMap(e => [...definiteClassModules(e!, refs)]));
    }
  }
  return new Set();
}
