import type { GssSourceAdapter } from '@gss-l/compiler';
import { parse } from '@babel/parser';
import traverseModule, {
  type Binding,
  type NodePath,
  type TraverseOptions
} from '@babel/traverse';
import * as t from '@babel/types';
import MagicString, { type SourceMap } from 'magic-string';

const traverse = (
  typeof traverseModule === 'function' ? traverseModule : traverseModule.default
) as unknown as (node: t.Node, options?: TraverseOptions) => void;

export type ReactScopeSchema = {
  /** Compiler module identity; absent in legacy schema views, so provenance is unknown. */
  moduleId?: string;
  exports: Readonly<Record<string, ReactScopeNodeSchema>>;
};

export type ReactScopeNodeSchema = {
  targets: Readonly<Record<string, ReactScopeNodeSchema>>;
};

export type ReactGssDiagnostic = {
  code: string;
  severity: 'error' | 'warning';
  phase: 'transform';
  message: string;
  id: string;
  reason: string;
  suggestion?: string;
  range?: { start: number; end: number };
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

export function react(): GssSourceAdapter {
  return {
    supports: (id) => /\.[cm]?[jt]sx?$/.test(id),
    discoverImports({ id, source }) {
      const ast = parse(source, {
        sourceType: 'module',
        sourceFilename: id,
        plugins: ['typescript', 'jsx']
      });
      return [...new Set(ast.program.body
        .filter((node) => t.isImportDeclaration(node) && node.source.value.endsWith('.gss'))
        .map((node) => (node as t.ImportDeclaration).source.value))];
    },
    transform: transformReactGssUsage
  };
}

export function transformReactGssUsage(
  input: TransformReactGssUsageInput
): TransformReactGssUsageResult {
  const ast = parse(input.source, {
    sourceType: 'module',
    sourceFilename: input.id,
    plugins: ['typescript', 'jsx']
  });
  const diagnostics: ReactGssDiagnostic[] = [];
  const bindings = collectGssBindings(ast.program, input, diagnostics);
  const verifiedBindings = resolveReferenceBindings(ast, bindings);
  const aliasReferences = resolveAliasReferences(ast, bindings, verifiedBindings);
  const typedPropReferences = resolveTypedPropMemberReferences(ast, bindings);
  const output = new MagicString(input.source);
  const loweredReferences = new WeakSet<t.MemberExpression>();
  const stringAliasBindings = new WeakSet<Binding>();
  const aliasInitializers = new WeakMap<Binding, t.Expression>();
  traverse(ast, {
    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !path.node.init) return;
      const binding = path.scope.getBinding(path.node.id.name);
      if (binding) aliasInitializers.set(binding, path.node.init);
      const expressionKind = classifyScopeExpression(path.node.init, verifiedBindings);
      if (expressionKind === 'scope' && binding) stringAliasBindings.add(binding);
    }
  });
  const aliasMemberBindings = new WeakSet<Binding>();
  traverse(ast, {
    MemberExpression(path) {
      const reference = readStaticReference(path.node);
      if (!reference) return;
      const binding = path.scope.getBinding(reference.binding);
      if (binding && aliasInitializers.has(binding)) aliasMemberBindings.add(binding);
    }
  });
  const stringAliasReferences = new WeakSet<t.Identifier>();
  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) return;
      const binding = path.scope.getBinding(path.node.name);
      if (binding && stringAliasBindings.has(binding)) stringAliasReferences.add(path.node);
    }
  });

  visitWithParent(ast.program, undefined, (node, parent) => {
    if (
      !t.isJSXAttribute(node) ||
      !t.isJSXIdentifier(node.name, { name: 'className' }) ||
      !t.isJSXExpressionContainer(node.value)
    ) return;

    if (
      t.isJSXOpeningElement(parent) && t.isJSXIdentifier(parent.name) &&
      /^[a-z]/.test(parent.name.name) &&
      definiteClassModules(node.value.expression, verifiedBindings).size > 1
    ) {
      diagnostics.push({
        code: 'GSS2107',
        severity: 'warning',
        phase: 'transform',
        message: 'Same-element className composition from multiple GSS modules is unsupported; there is no cross-module precedence guarantee.',
        id: input.id,
        reason: 'cross-module-class-composition',
        suggestion: 'Use scopes from one GSS module on this element.',
        ...(node.start != null && node.end != null
          ? { range: { start: node.start, end: node.end } } : {})
      });
    }

    visitWithParent(node.value.expression, undefined, (expression, parent) => {
      if (t.isIdentifier(expression)) {
        if (t.isMemberExpression(parent) && parent.object === expression) return;
        const aliasKind = aliasReferences.get(expression);
        if (aliasKind === 'scope' && !stringAliasReferences.has(expression)) {
          if (expression.end != null) output.appendLeft(expression.end, '.self');
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

      const typedPropKind = typedPropReferences.get(expression);
      if (typedPropKind === 'scope' && expression.end != null) {
        output.appendLeft(expression.end, '.self');
        return;
      }
      if (typedPropKind === 'mutable') {
        diagnostics.push({
          code: 'GSS2103',
          severity: 'error',
          phase: 'transform',
          message: 'A mutable typed GSS scope prop cannot be lowered safely.',
          id: input.id,
          reason: 'mutable-scope-alias',
          suggestion: 'Do not reassign the props binding before className use.'
        });
        return;
      }

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

  // Expand a bounded immutable alias when a target path is read from it.
  // This keeps `const branch = active ? styles.card : styles.panel;
  // branch.title` as a source-level convenience without inferring arbitrary
  // data flow or relying on DOM structure.
  traverse(ast, {
    MemberExpression(path) {
      const expression = path.node;
      if (t.isMemberExpression(path.parent) && path.parent.object === expression) return;
      const reference = readStaticReference(expression);
      if (!reference || reference.path.length === 0) return;
      const rootBinding = path.scope.getBinding(reference.binding);
      const init = rootBinding && rootBinding.constant && t.isVariableDeclarator(rootBinding.path.node)
        ? rootBinding.path.node.init ?? undefined
        : undefined;
      if (!init) return;
      const replacement = expandAliasTarget(init, reference.path, input.source, verifiedBindings);
      if (replacement && expression.start != null && expression.end != null) {
        output.overwrite(expression.start, expression.end, replacement);
      }
    }
  });

  // GSS references are compile-time paths, not JSX-only values. Lower direct
  // static paths in direct expression contexts so ordinary string consumers
  // (for example custom functions or document APIs) receive a primitive at
  // runtime. Alias initializers and JSX attributes retain the existing
  // bounded analysis below; general data-flow handling is not inferred here.
  traverse(ast, {
    MemberExpression(path) {
      const expression = path.node;
      if (t.isMemberExpression(path.parent) && path.parent.object === expression) return;
      if (t.isJSXAttribute(path.parent)) return;
      let ancestor: NodePath<t.Node> | null = path.parentPath;
      while (ancestor) {
        if (t.isJSXAttribute(ancestor.node)) return;
        if (t.isVariableDeclarator(ancestor.node)) {
          const id = ancestor.node.id;
          const binding = t.isIdentifier(id) ? path.scope.getBinding(id.name) : undefined;
          if (binding && aliasMemberBindings.has(binding)) return;
        }
        ancestor = ancestor.parentPath;
      }
      const binding = verifiedBindings.get(expression);
      if (!binding) return;
      const reference = readStaticReference(expression);
      if (!reference) return;
      const hasExplicitSelf = reference.path.at(-1) === 'self';
      const scopePath = hasExplicitSelf ? reference.path.slice(0, -1) : reference.path;
      if (!resolveScopePath(binding.schema, scopePath)) return;
      if (!hasExplicitSelf && expression.end != null) {
        output.appendLeft(expression.end, '.self');
        loweredReferences.add(expression);
      }
    }
  });

  diagnoseScopeStringCoercions(
    ast,
    input.id,
    verifiedBindings,
    aliasReferences,
    diagnostics,
    loweredReferences
  );

  return {
    code: output.toString(),
    map: output.generateMap({ source: input.id, includeContent: true, hires: true }),
    diagnostics
  };
}

/** Only string composition with definite, schema-backed provenance, never arbitrary calls. */
function definiteClassModules(
  expression: t.Node,
  bindings: WeakMap<t.MemberExpression, GssBinding>
): ReadonlySet<string> {
  if (t.isMemberExpression(expression)) {
    const binding = bindings.get(expression);
    const reference = readStaticReference(expression);
    const path = reference?.path.at(-1) === 'self' ? reference.path.slice(0, -1) : reference?.path;
    if (binding?.schema.moduleId && path && resolveScopePath(binding.schema, path)) {
      return new Set([binding.schema.moduleId]);
    }
  }
  if (t.isBinaryExpression(expression, { operator: '+' })) {
    return new Set([
      ...definiteClassModules(expression.left, bindings),
      ...definiteClassModules(expression.right, bindings)
    ]);
  }
  if (t.isTemplateLiteral(expression)) {
    return new Set(expression.expressions.flatMap((part) => [...definiteClassModules(part, bindings)]));
  }
  if (
    t.isCallExpression(expression) &&
    t.isMemberExpression(expression.callee) && !expression.callee.computed &&
    t.isIdentifier(expression.callee.property, { name: 'join' }) &&
    t.isArrayExpression(expression.callee.object) &&
    expression.arguments.length === 1 && t.isStringLiteral(expression.arguments[0], { value: ' ' })
  ) {
    const elements = expression.callee.object.elements;
    // A literal list only: unknown values/spreads/calls cannot establish join semantics.
    if (elements.every((element) => element && (
      t.isStringLiteral(element) ||
      (t.isMemberExpression(element) && definiteClassModules(element, bindings).size === 1)
    ))) {
      return new Set(elements.flatMap((element) => [...definiteClassModules(element!, bindings)]));
    }
  }
  // Conditional/logical branches, aliases, typed props and arbitrary calls are not proof.
  return new Set();
}

function collectGssBindings(
  program: t.Program,
  input: TransformReactGssUsageInput,
  diagnostics: ReactGssDiagnostic[]
): ReadonlyMap<string, GssBinding> {
  const bindings = new Map<string, GssBinding>();
  for (const statement of program.body) {
    if (!t.isImportDeclaration(statement) || !statement.source.value.endsWith('.gss')) continue;
    const defaultImport = statement.specifiers.find(t.isImportDefaultSpecifier);
    const schema = input.resolveScopeSchema(statement.source.value);
    if (!schema) {
      diagnostics.push({
        code: 'GSS2106',
        severity: 'error',
        phase: 'transform',
        message: `Missing GSS ScopeSchema for ${statement.source.value}.`,
        id: input.id,
        reason: 'missing-scope-schema',
        suggestion: 'Compile the imported stylesheet successfully before source transformation.'
      });
    }
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

function diagnoseScopeStringCoercions(
  ast: t.File,
  id: string,
  verifiedBindings: WeakMap<t.MemberExpression, GssBinding>,
  aliasReferences: WeakMap<t.Identifier, AliasKind>,
  diagnostics: ReactGssDiagnostic[],
  loweredReferences: WeakSet<t.MemberExpression>
): void {
  const reported = new Set<number>();
  const report = (node: t.Node): void => {
    if (node.start == null || reported.has(node.start)) return;
    reported.add(node.start);
    diagnostics.push({
      code: 'GSS2105',
      severity: 'error',
      phase: 'transform',
      message: 'A GSS scope object is being coerced to a string.',
      id,
      reason: 'scope-string-coercion',
      suggestion: 'Use the explicit .self class string.'
    });
  };
  traverse(ast, {
    MemberExpression(path) {
      if (t.isMemberExpression(path.parent) && path.parent.object === path.node) return;
      const reference = readStaticReference(path.node);
      const binding = verifiedBindings.get(path.node);
      if (
        !binding ||
        !reference ||
        reference.path.at(-1) === 'self' ||
        !isStringCoercionPath(path)
      ) return;
      // Direct static references in string contexts are lowered by the
      // general path pass above; only aliases still need coercion diagnostics.
      if (binding && loweredReferences.has(path.node)) return;
      report(path.node);
    },
    Identifier(path) {
      if (!path.isReferencedIdentifier()) return;
      if (t.isMemberExpression(path.parent) && path.parent.object === path.node) return;
      if (aliasReferences.get(path.node) === 'scope' && isStringCoercionPath(path)) {
        report(path.node);
      }
    }
  });
}

function isStringCoercionPath(path: NodePath): boolean {
  let current = path.parentPath;
  while (current) {
    if (
      t.isJSXAttribute(current.node) &&
      t.isJSXIdentifier(current.node.name, { name: 'className' })
    ) return false;
    if (t.isTemplateLiteral(current.node)) return true;
    if (t.isBinaryExpression(current.node, { operator: '+' })) return true;
    current = current.parentPath;
  }
  return false;
}

function resolveTypedPropMemberReferences(
  ast: t.File,
  gssBindings: ReadonlyMap<string, GssBinding>
): WeakMap<t.MemberExpression, 'scope' | 'mutable'> {
  const typedProperties = collectTypedScopeProperties(ast, gssBindings);
  const propsBindings = new Map<Binding, {
    kind: 'scope' | 'mutable';
    properties: ReadonlySet<string>;
  }>();
  traverse(ast, {
    Function(path) {
      for (const parameter of path.node.params) {
        if (!t.isIdentifier(parameter)) continue;
        const properties = resolveTypedScopeProperties(
          parameter.typeAnnotation,
          typedProperties,
          gssBindings
        );
        if (!properties || properties.size === 0) continue;
        const binding = path.scope.getBinding(parameter.name);
        if (binding) {
          propsBindings.set(binding, {
            kind: binding.constant ? 'scope' : 'mutable',
            properties
          });
        }
      }
    }
  });

  const references = new WeakMap<t.MemberExpression, 'scope' | 'mutable'>();
  traverse(ast, {
    MemberExpression(path) {
      const { object, property, computed } = path.node;
      if (computed || !t.isIdentifier(object) || !t.isIdentifier(property)) return;
      const binding = path.scope.getBinding(object.name);
      const props = binding ? propsBindings.get(binding) : undefined;
      if (props?.properties.has(property.name)) references.set(path.node, props.kind);
    }
  });
  return references;
}

function resolveAliasReferences(
  ast: t.File,
  gssBindings: ReadonlyMap<string, GssBinding>,
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

  const typedProperties = collectTypedScopeProperties(ast, gssBindings);
  traverse(ast, {
    Function(path) {
      for (const parameter of path.node.params) {
        if (!t.isObjectPattern(parameter)) continue;
        const scopeProperties = resolveTypedScopeProperties(
          parameter.typeAnnotation,
          typedProperties,
          gssBindings
        );
        if (!scopeProperties) continue;
        for (const property of parameter.properties) {
          if (!t.isObjectProperty(property) || property.computed || !t.isIdentifier(property.value)) {
            continue;
          }
          const propName = t.isIdentifier(property.key)
            ? property.key.name
            : t.isStringLiteral(property.key)
              ? property.key.value
              : undefined;
          if (!propName || !scopeProperties.has(propName)) continue;
          const binding = path.scope.getBinding(property.value.name);
          if (binding) aliases.set(binding, binding.constant ? 'scope' : 'mutable');
        }
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

function collectTypedScopeProperties(
  ast: t.File,
  gssBindings: ReadonlyMap<string, GssBinding>
): ReadonlyMap<string, ReadonlySet<string>> {
  const aliases = new Map<string, ReadonlySet<string>>();
  traverse(ast, {
    TSTypeAliasDeclaration(path) {
      if (!t.isTSTypeLiteral(path.node.typeAnnotation)) return;
      const properties = readScopePropertiesFromLiteral(
        path.node.typeAnnotation,
        gssBindings
      );
      if (properties.size > 0) aliases.set(path.node.id.name, properties);
    }
  });
  return aliases;
}

function resolveTypedScopeProperties(
  annotation: t.Noop | t.TypeAnnotation | t.TSTypeAnnotation | null | undefined,
  aliases: ReadonlyMap<string, ReadonlySet<string>>,
  gssBindings: ReadonlyMap<string, GssBinding>
): ReadonlySet<string> | undefined {
  if (!annotation || !t.isTSTypeAnnotation(annotation)) return undefined;
  const type = annotation.typeAnnotation;
  if (t.isTSTypeReference(type) && t.isIdentifier(type.typeName)) {
    return aliases.get(type.typeName.name);
  }
  return t.isTSTypeLiteral(type)
    ? readScopePropertiesFromLiteral(type, gssBindings)
    : undefined;
}

function readScopePropertiesFromLiteral(
  literal: t.TSTypeLiteral,
  gssBindings: ReadonlyMap<string, GssBinding>
): ReadonlySet<string> {
  const properties = new Set<string>();
  for (const member of literal.members) {
    if (!t.isTSPropertySignature(member) || member.computed || !member.typeAnnotation) continue;
    const propertyName = t.isIdentifier(member.key)
      ? member.key.name
      : t.isStringLiteral(member.key)
        ? member.key.value
        : undefined;
    if (
      propertyName &&
      isGssScopeTypeQuery(member.typeAnnotation.typeAnnotation, gssBindings)
    ) properties.add(propertyName);
  }
  return properties;
}

function isGssScopeTypeQuery(
  type: t.TSType,
  gssBindings: ReadonlyMap<string, GssBinding>
): boolean {
  if (!t.isTSTypeQuery(type)) return false;
  if (!t.isIdentifier(type.exprName) && !t.isTSQualifiedName(type.exprName)) return false;
  const path = readTypeEntityPath(type.exprName);
  if (!path) return false;
  const [bindingName, ...scopePath] = path;
  const binding = bindingName ? gssBindings.get(bindingName) : undefined;
  return Boolean(binding && resolveScopePath(binding.schema, scopePath));
}

function readTypeEntityPath(entity: t.TSEntityName): readonly string[] | undefined {
  if (t.isIdentifier(entity)) return [entity.name];
  if (!t.isTSQualifiedName(entity)) return undefined;
  const left = readTypeEntityPath(entity.left);
  return left ? [...left, entity.right.name] : undefined;
}

function aliasKindForBinding(
  binding: Binding,
  expressionKind: Exclude<ScopeExpressionKind, 'non-scope'>
): AliasKind {
  return binding.kind === 'const' && binding.constant ? expressionKind : 'mutable';
}

function expandAliasTarget(
  expression: t.Expression,
  targetPath: readonly string[],
  source: string,
  verifiedBindings: WeakMap<t.MemberExpression, GssBinding>
): string | undefined {
  const hasExplicitSelf = targetPath.at(-1) === 'self';
  const targets = hasExplicitSelf ? targetPath.slice(0, -1) : targetPath;
  if (targets.length === 0) return undefined;
  if (t.isMemberExpression(expression)) {
    const verified = readVerifiedScopeExpression(expression, verifiedBindings);
    if (!verified || !resolveScopePath(verified.binding.schema, [...verified.path, ...targets])) {
      return undefined;
    }
    const text = expression.start != null && expression.end != null
      ? source.slice(expression.start, expression.end) : undefined;
    return text ? `${text}.${targets.join('.')}.self` : undefined;
  }
  if (t.isConditionalExpression(expression)) {
    const consequent = expandAliasTarget(expression.consequent, targets, source, verifiedBindings);
    const alternate = expandAliasTarget(expression.alternate, targets, source, verifiedBindings);
    const test = expression.test.start != null && expression.test.end != null
      ? source.slice(expression.test.start, expression.test.end) : undefined;
    return consequent && alternate && test ? `${test} ? ${consequent} : ${alternate}` : undefined;
  }
  return undefined;
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
