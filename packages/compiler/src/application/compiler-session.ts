import { createReadableAtomicName, type PureDeclarationIdentity } from '../domain/readable-name.js';
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

type PlannedDeclaration = {
  identity: PureDeclarationIdentity;
  className: string;
};

type ModuleContribution = {
  artifact: StyleModuleArtifact;
  rules: readonly PlannedDeclaration[];
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

  const exports: Record<string, ScopeNodeSchema> = {};
  const rules: PlannedDeclaration[] = [];

  for (const rule of parsed.rules) {
    const classNames: string[] = [];
    for (const declaration of rule.declarations) {
      const identity: PureDeclarationIdentity = {
        layer: 'unlayered',
        condition: 'base',
        state: 'self',
        property: declaration.property,
        value: declaration.value,
        important: declaration.important
      };
      const className = createReadableAtomicName(identity);
      classNames.push(className);
      rules.push({ identity, className });
    }
    exports[rule.exportName] = {
      selfClassName: [...new Set(classNames)].sort().join(' '),
      targets: {}
    };
  }

  const moduleId = toLogicalModuleId(config.projectRoot, input.id);
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

function finalizeSnapshot(
  modules: ReadonlyMap<string, ModuleContribution>,
  generation: number
): FinalizedGssSnapshot {
  const uniqueRules = new Map<string, PlannedDeclaration>();
  for (const contribution of modules.values()) {
    for (const rule of contribution.rules) uniqueRules.set(serializeIdentity(rule.identity), rule);
  }

  const orderedRules = [...uniqueRules.values()].sort((left, right) =>
    left.className.localeCompare(right.className)
  );
  return {
    generation,
    css: orderedRules.map(renderRule).join('\n\n'),
    manifest: {
      modules: [...modules.keys()].sort(),
      rules: orderedRules.map(({ className, identity }) => ({
        className,
        property: identity.property,
        value: identity.value,
        important: identity.important
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
  return `.${rule.className} {\n  ${property}: ${value}${important ? ' !important' : ''};\n}`;
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
    `  readonly ${JSON.stringify(name)}: GssScope<{}>;`
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

function serializeIdentity(identity: PureDeclarationIdentity): string {
  return JSON.stringify([
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
