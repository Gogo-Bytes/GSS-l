import {
  createReadableAtomicName,
  createReadableSourceMarker,
  createReadableTargetMarker,
  type ContextualRelationIdentity,
  type PureDeclarationIdentity
} from '../domain/readable-name.js';
import { resolveTargetDeclarations } from '../domain/resolve-target-declarations.js';
import { validateDeclarationSequences } from '../domain/validate-declarations.js';
import { parseStylesheet } from '../infrastructure/postcss-stylesheet-parser.js';
import type {
  FinalizedGssSnapshot,
  GssCompilerConfig,
  GssCompilerSession,
  GssDiagnostic,
  ReplaceStylesheetInput,
  ScopeNodeSchema,
  StyleModuleArtifact
} from '../public-types.js';

type ContextualDeclarationIdentity = ContextualRelationIdentity & {
  property: string;
  value: string;
  important: boolean;
};

type PlannedDeclaration = {
  kind: 'pure-atom' | 'contextual-atom';
  identity: PureDeclarationIdentity | ContextualDeclarationIdentity;
  className: string;
  selector: string;
};

type ModuleContribution = {
  artifact: StyleModuleArtifact;
  rules: readonly PlannedDeclaration[];
};

type MutableScopeNode = {
  classNames: Set<string>;
  targets: Map<string, MutableScopeNode>;
};

export function createGssCompilerSession(config: GssCompilerConfig): GssCompilerSession {
  const modules = new Map<string, ModuleContribution>();
  let generation = 0;

  return {
    replaceStylesheet(input) {
      const prepared = prepareContribution(config, input);
      if ('diagnostics' in prepared) {
        return {
          id: input.id,
          committed: false,
          generation,
          diagnostics: prepared.diagnostics
        };
      }

      modules.set(input.id, prepared);
      generation += 1;
      return {
        id: input.id,
        committed: true,
        generation,
        module: prepared.artifact,
        diagnostics: []
      };
    },

    invalidate(moduleId) {
      const changed = modules.delete(moduleId);
      if (changed) generation += 1;
      return { id: moduleId, changed, generation };
    },

    getScopeSchema(moduleId) {
      return modules.get(moduleId)?.artifact.scopeSchema;
    },

    finalize() {
      return finalizeSnapshot(modules, generation);
    }
  };
}

function prepareContribution(
  config: GssCompilerConfig,
  input: ReplaceStylesheetInput
): ModuleContribution | { diagnostics: readonly GssDiagnostic[] } {
  const parsed = parseStylesheet(input.id, input.source);
  if (parsed.diagnostics.some(({ severity }) => severity === 'error')) {
    return { diagnostics: parsed.diagnostics };
  }
  const declarationDiagnostics = validateDeclarationSequences(input.id, parsed.rules);
  if (declarationDiagnostics.some(({ severity }) => severity === 'error')) {
    return { diagnostics: declarationDiagnostics };
  }

  const moduleId = toLogicalModuleId(config.projectRoot, input.id);
  const roots = new Map<string, MutableScopeNode>();
  const rules: PlannedDeclaration[] = [];
  const ownershipRules = parsed.rules.filter(({ relations }) =>
    relations.every((relation) => relation === 'descendant')
  );
  const contextualRules = parsed.rules.filter(({ relations }) =>
    relations.some((relation) => relation === 'child')
  );
  const unsupportedRelation = contextualRules.find(({ relations }) => {
    const childIndexes = relations.flatMap((relation, index) =>
      relation === 'child' ? [index] : []
    );
    return childIndexes.length !== 1 || childIndexes[0] !== relations.length - 1;
  });
  if (unsupportedRelation) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'The initial child-relation capability requires one final > combinator.',
        id: input.id,
        reason: 'capability-not-registered'
      }]
    };
  }

  for (const target of resolveTargetDeclarations(
    ownershipRules,
    parsed.rules.map(({ path }) => path)
  )) {
    const scope = ensureScopePath(roots, target.path);
    for (const declaration of target.declarations) {
      const identity: PureDeclarationIdentity = {
        layer: 'unlayered',
        condition: 'base',
        state: 'self',
        property: declaration.property,
        value: declaration.value,
        important: declaration.important
      };
      const className = createReadableAtomicName(identity);
      scope.classNames.add(className);
      rules.push({ kind: 'pure-atom', identity, className, selector: `.${className}` });
    }
  }

  for (const rule of contextualRules) {
    const sourcePath = rule.path.slice(0, -1);
    const sourceMarker = createReadableSourceMarker(moduleId, sourcePath);
    const relationIdentity: ContextualRelationIdentity = {
      moduleId,
      relation: 'child',
      sourcePath,
      targetPath: rule.path
    };
    const targetMarker = createReadableTargetMarker(relationIdentity);
    ensureScopePath(roots, sourcePath).classNames.add(sourceMarker);
    ensureScopePath(roots, rule.path).classNames.add(targetMarker);
    const selector = `.${sourceMarker} > .${targetMarker}`;

    for (const declaration of rule.declarations) {
      const identity: ContextualDeclarationIdentity = {
        ...relationIdentity,
        property: declaration.property,
        value: declaration.value,
        important: declaration.important
      };
      rules.push({
        kind: 'contextual-atom',
        identity,
        className: targetMarker,
        selector
      });
    }
  }

  const exports = Object.fromEntries(
    [...roots.entries()].map(([name, scope]) => [name, toScopeSchema(scope)])
  );

  const scopeSchema = { moduleId, exports };
  const artifact: StyleModuleArtifact = {
    id: input.id,
    scopeSchema,
    moduleCode: renderModuleCode(exports),
    declarationCode: renderDeclarationCode(exports),
    dependencies: []
  };

  return { artifact, rules };
}

function ensureScopePath(
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

function toScopeSchema(scope: MutableScopeNode): ScopeNodeSchema {
  return {
    selfClassName: [...scope.classNames].sort().join(' '),
    targets: Object.fromEntries(
      [...scope.targets.entries()].map(([name, target]) => [name, toScopeSchema(target)])
    )
  };
}

function finalizeSnapshot(
  modules: ReadonlyMap<string, ModuleContribution>,
  generation: number
): FinalizedGssSnapshot {
  const uniqueRules = new Map<string, {
    rule: PlannedDeclaration;
    sources: Set<string>;
  }>();
  for (const contribution of modules.values()) {
    for (const rule of contribution.rules) {
      const key = serializeIdentity(rule.identity);
      const registered = uniqueRules.get(key) ?? { rule, sources: new Set<string>() };
      registered.sources.add(contribution.artifact.scopeSchema.moduleId);
      uniqueRules.set(key, registered);
    }
  }

  const orderedRules = [...uniqueRules.values()].sort((left, right) =>
    left.rule.className.localeCompare(right.rule.className)
  );
  return {
    generation,
    css: orderedRules.map(({ rule }) => renderRule(rule)).join('\n\n'),
    manifest: {
      modules: [...modules.keys()].sort(),
      rules: orderedRules.map(({ rule: { kind, className, selector, identity }, sources }) => ({
        kind,
        className,
        selector,
        property: identity.property,
        value: identity.value,
        important: identity.important,
        sources: [...sources].sort()
      }))
    },
    report: {
      modules: modules.size,
      rules: orderedRules.length
    }
  };
}

function renderRule(rule: PlannedDeclaration): string {
  const { property, value, important } = rule.identity;
  return `${rule.selector} {\n  ${property}: ${value}${important ? ' !important' : ''};\n}`;
}

function renderModuleCode(exports: Readonly<Record<string, ScopeNodeSchema>>): string {
  const names = Object.keys(exports).sort();
  const declarations = names.map((name) =>
    `const ${name} = ${renderScopeObject(exports[name]!)};`
  );
  declarations.push(`export default { ${names.join(', ')} };`);
  return `${declarations.join('\n')}\n`;
}

function renderScopeObject(scope: ScopeNodeSchema): string {
  const fields = [`self: ${JSON.stringify(scope.selfClassName)}`];
  for (const name of Object.keys(scope.targets).sort()) {
    fields.push(`${JSON.stringify(name)}: ${renderScopeObject(scope.targets[name]!)}`);
  }
  return `{ ${fields.join(', ')} }`;
}

function renderDeclarationCode(exports: Readonly<Record<string, ScopeNodeSchema>>): string {
  const fields = Object.keys(exports).sort().map((name) =>
    `  readonly ${JSON.stringify(name)}: ${renderScopeType(exports[name]!)};`
  );
  return [
    'declare const GSS_SCOPE: unique symbol;',
    'type GssScope<T> = string & T & { readonly self: string; readonly [GSS_SCOPE]: true };',
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
  return `GssScope<{ ${targets.join('; ')}${targets.length > 0 ? ';' : ''} }>`;
}

function serializeIdentity(identity: PlannedDeclaration['identity']): string {
  if ('relation' in identity) {
    return JSON.stringify([
      'contextual',
      identity.moduleId,
      identity.relation,
      identity.sourcePath,
      identity.targetPath,
      identity.property,
      identity.value,
      identity.important
    ]);
  }
  return JSON.stringify([
    'pure',
    identity.layer,
    identity.condition,
    identity.state,
    identity.property,
    identity.value,
    identity.important
  ]);
}

function toLogicalModuleId(projectRoot: string, id: string): string {
  const root = normalizePath(projectRoot).replace(/\/$/, '');
  const normalizedId = normalizePath(id);
  const prefix = `${root}/`;
  return normalizedId.startsWith(prefix) ? normalizedId.slice(prefix.length) : normalizedId;
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/');
}
