import type { ScopeNodeSchema } from '../public-types.js';

// Marker and atom membership is decided by contribution planning. This module
// only collects that membership and renders the existing public scope shape.
export type MutableScopeNode = {
  classNames: Set<string>;
  targets: Map<string, MutableScopeNode>;
};

export function ensureScopePath(
  roots: Map<string, MutableScopeNode>,
  path: readonly string[]
): MutableScopeNode {
  let siblings = roots;
  let current: MutableScopeNode | undefined;
  for (const name of path) {
    current = siblings.get(name) ?? { classNames: new Set(), targets: new Map() };
    siblings.set(name, current);
    siblings = current.targets;
  }
  if (!current) throw new Error('GSS invariant: selector path must not be empty.');
  return current;
}

export function toScopeSchema(scope: MutableScopeNode): ScopeNodeSchema {
  return {
    selfClassName: [...scope.classNames].sort().join(' '),
    targets: Object.fromEntries(
      [...scope.targets.entries()].map(([name, target]) => [name, toScopeSchema(target)])
    )
  };
}

const reservedBindings = new Set([
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger',
  'default', 'delete', 'do', 'else', 'enum', 'export', 'extends', 'false',
  'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'new',
  'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof',
  'var', 'void', 'while', 'with', 'yield', 'implements', 'interface', 'let',
  'package', 'private', 'protected', 'public', 'static', 'arguments', 'eval'
]);

export function renderModuleCode(exports: Readonly<Record<string, ScopeNodeSchema>>): string {
  const names = Object.keys(exports).sort();
  const authoredNames = new Set(names);
  const bindings = names.map((name, index) => {
    if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) && !reservedBindings.has(name)) {
      return { name, binding: name };
    }
    let binding = `__gss_scope_${index}`;
    while (authoredNames.has(binding)) binding += '_';
    return { name, binding };
  });
  const declarations = bindings.map(({ name, binding }) =>
    `const ${binding} = ${renderScopeObject(exports[name]!)};`
  );
  const exported = bindings.map(({ name, binding }) => name === binding
    ? name
    : `${JSON.stringify(name)}: ${binding}`);
  declarations.push(`export default { ${exported.join(', ')} };`);
  return `${declarations.join('\n')}\n`;
}

function renderScopeObject(scope: ScopeNodeSchema): string {
  const fields = [`self: ${JSON.stringify(scope.selfClassName)}`];
  for (const name of Object.keys(scope.targets).sort()) {
    // A quoted __proto__ key in an object literal changes its prototype instead
    // of defining the authored target. A computed key always creates an own field.
    const key = name === '__proto__' ? `[${JSON.stringify(name)}]` : JSON.stringify(name);
    fields.push(`${key}: ${renderScopeObject(scope.targets[name]!)}`);
  }
  return `{ ${fields.join(', ')} }`;
}

export function renderDeclarationCode(exports: Readonly<Record<string, ScopeNodeSchema>>): string {
  const fields = Object.keys(exports).sort().map((name) =>
    `  readonly ${JSON.stringify(name)}: ${renderScopeType(exports[name]!)};`
  );
  return [
    "import type { GssScope } from '@gss-l/types';",
    'declare const styles: {',
    ...fields,
    '};',
    'export default styles;',
    ''
  ].join('\n');
}

function renderScopeType(scope: ScopeNodeSchema): string {
  const targets = Object.keys(scope.targets).sort().map((name) =>
    `readonly ${JSON.stringify(name)}: ${renderScopeType(scope.targets[name]!)}`
  );
  return targets.length === 0
    ? 'GssScope<{}>'
    : `GssScope<{ ${targets.join('; ')}; }>`;
}
