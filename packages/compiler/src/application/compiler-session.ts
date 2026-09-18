import {
  createReadableAtomicName,
  createReadableContextMarker,
  createReadableHasSubjectMarker,
  createReadableObservedMarker,
  createReadableSourceMarker,
  createReadableTargetMarker,
  type ContextualRelationIdentity,
  type ObservedRelationIdentity,
  type PureDeclarationIdentity
} from '../domain/readable-name.js';
import { resolveTargetDeclarations } from '../domain/resolve-target-declarations.js';
import { validateDeclarationSequences } from '../domain/validate-declarations.js';
import { validateStateAmbiguity } from '../domain/validate-state-ambiguity.js';
import {
  parseStylesheet,
  type ParsedAttributeCondition
} from '../infrastructure/postcss-stylesheet-parser.js';
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

type ObservedDeclarationIdentity = ObservedRelationIdentity & {
  property: string;
  value: string;
  important: boolean;
};

type PlannedDeclaration = {
  kind: 'pure-atom' | 'contextual-atom';
  identity: PureDeclarationIdentity | ContextualDeclarationIdentity | ObservedDeclarationIdentity;
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
  const stateDiagnostics = validateStateAmbiguity(input.id, parsed.rules);
  if (stateDiagnostics.some(({ severity }) => severity === 'error')) {
    return { diagnostics: stateDiagnostics };
  }

  const unsupportedObservation = parsed.rules.find(({
    path,
    relations,
    states,
    attributes,
    observations
  }) => {
    const observationIndexes = observations.flatMap((conditions, index) =>
      conditions.length > 0 ? [index] : []
    );
    return observationIndexes.length > 0 && (
      observationIndexes.length !== 1 ||
      observations[observationIndexes[0]!]!.length !== 1 ||
      observationIndexes[0] !== path.length - 1 ||
      relations.some((relation) => relation !== 'descendant') ||
      states.some((state) => state.length > 0) ||
      attributes.some((conditions) => conditions.length > 0)
    );
  });
  if (unsupportedObservation) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'The initial :has() capability requires one simple observed local class.',
        id: input.id,
        reason: 'capability-not-registered'
      }]
    };
  }

  const unsupportedAttribute = parsed.rules.find(({ path, relations, states, attributes }) => {
    const attributeIndexes = attributes.flatMap((conditions, index) =>
      conditions.length > 0 ? [index] : []
    );
    const firstRuntimeRelation = relations.findIndex((relation) => relation !== 'descendant');
    return attributeIndexes.length > 0 && (
      attributeIndexes.length !== 1 ||
      attributes[attributeIndexes[0]!]!.length !== 1 ||
      path.length === 0 ||
      (firstRuntimeRelation >= 0 && attributeIndexes[0] !== firstRuntimeRelation) ||
      states.some((state) => state.length > 0)
    );
  });
  if (unsupportedAttribute) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'A selector may contain one equality attribute on its current or runtime-source node.',
        id: input.id,
        reason: 'capability-not-registered'
      }]
    };
  }

  const unsupportedState = parsed.rules.find(({ path, relations, states }) => {
    const stateIndexes = states.flatMap((state, index) => state.length > 0 ? [index] : []);
    const firstRuntimeRelation = relations.findIndex((relation) => relation !== 'descendant');
    return stateIndexes.length > 0 && (
      stateIndexes.length !== 1 ||
      path.length === 0 ||
      (firstRuntimeRelation >= 0 && stateIndexes[0] !== firstRuntimeRelation)
    );
  });
  if (unsupportedState) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'A runtime chain requires its single state to be on the chain source.',
        id: input.id,
        reason: 'capability-not-registered'
      }]
    };
  }

  const moduleId = toLogicalModuleId(config.projectRoot, input.id);
  const roots = new Map<string, MutableScopeNode>();
  const rules: PlannedDeclaration[] = [];
  const ownershipRules = parsed.rules.filter(({
    relations,
    states,
    attributes,
    observations
  }) =>
    relations.every((relation) => relation === 'descendant') &&
    states.every((state) => state.length === 0) &&
    attributes.every((conditions) => conditions.length === 0) &&
    observations.every((conditions) => conditions.length === 0)
  );
  const stateRules = parsed.rules.filter(({ relations, states }) =>
    relations.every((relation) => relation === 'descendant') &&
    states.at(-1)?.length
  );
  const ancestorStateRules = parsed.rules.filter(({ relations, states }) =>
    relations.every((relation) => relation === 'descendant') &&
    states.slice(0, -1).some((state) => state.length > 0)
  );
  const attributeRules = parsed.rules.filter(({ relations, attributes }) =>
    relations.every((relation) => relation === 'descendant') &&
    attributes.at(-1)?.length
  );
  const ancestorAttributeRules = parsed.rules.filter(({ relations, attributes }) =>
    relations.every((relation) => relation === 'descendant') &&
    attributes.slice(0, -1).some((conditions) => conditions.length > 0)
  );
  const hasRules = parsed.rules.filter(({ observations }) =>
    observations.at(-1)?.length
  );
  const contextualRules = parsed.rules.filter(({ relations }) =>
    relations.some((relation) => relation !== 'descendant')
  );
  const unsupportedRelation = contextualRules.find(({ relations }) => {
    const firstRuntimeRelation = relations.findIndex((relation) => relation !== 'descendant');
    return relations.slice(firstRuntimeRelation).some((relation) => relation === 'descendant');
  });
  if (unsupportedRelation) {
    return {
      diagnostics: [{
        code: 'GSS1101',
        severity: 'error',
        phase: 'validate',
        message: 'Ownership relations must precede the runtime-relation suffix.',
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

  const stateGroups = new Map<string, typeof stateRules>();
  for (const rule of stateRules) {
    const state = rule.states.at(-1)!.join(':');
    stateGroups.set(state, [...(stateGroups.get(state) ?? []), rule]);
  }
  for (const [state, groupedRules] of stateGroups) {
    for (const target of resolveTargetDeclarations(
      groupedRules,
      groupedRules.map(({ path }) => path)
    )) {
      const scope = ensureScopePath(roots, target.path);
      for (const declaration of target.declarations) {
        const identity: PureDeclarationIdentity = {
          layer: 'unlayered',
          condition: 'base',
          state,
          property: declaration.property,
          value: declaration.value,
          important: declaration.important
        };
        const className = createReadableAtomicName(identity);
        scope.classNames.add(className);
        rules.push({
          kind: 'contextual-atom',
          identity,
          className,
          selector: `.${className}:${state}`
        });
      }
    }
  }

  for (const rule of hasRules) {
    const observation = rule.observations.at(-1)![0]!;
    const relationIdentity: ObservedRelationIdentity = {
      moduleId,
      subjectPath: rule.path,
      relation: observation.relation,
      observedClass: observation.observedClass
    };
    const subjectMarker = createReadableHasSubjectMarker(relationIdentity);
    const observedMarker = createReadableObservedMarker(relationIdentity);
    ensureScopePath(roots, rule.path).classNames.add(subjectMarker);
    ensureScopePath(roots, [observation.observedClass]).classNames.add(observedMarker);
    const observedCombinator = renderObservedCombinator(observation.relation);
    const selector = `.${subjectMarker}:has(${observedCombinator}.${observedMarker})`;

    for (const declaration of rule.declarations) {
      const identity: ObservedDeclarationIdentity = {
        ...relationIdentity,
        property: declaration.property,
        value: declaration.value,
        important: declaration.important
      };
      rules.push({
        kind: 'contextual-atom',
        identity,
        className: subjectMarker,
        selector
      });
    }
  }

  const attributeGroups = new Map<string, typeof attributeRules>();
  for (const rule of attributeRules) {
    const condition = rule.attributes.at(-1)![0]!;
    const key = canonicalAttributeCondition(condition);
    attributeGroups.set(key, [...(attributeGroups.get(key) ?? []), rule]);
  }
  for (const [conditionKey, groupedRules] of attributeGroups) {
    const condition = groupedRules[0]!.attributes.at(-1)![0]!;
    for (const target of resolveTargetDeclarations(
      groupedRules,
      groupedRules.map(({ path }) => path)
    )) {
      const scope = ensureScopePath(roots, target.path);
      for (const declaration of target.declarations) {
        const identity: PureDeclarationIdentity = {
          layer: 'unlayered',
          condition: 'base',
          state: conditionKey,
          property: declaration.property,
          value: declaration.value,
          important: declaration.important
        };
        const className = createReadableAtomicName(identity);
        scope.classNames.add(className);
        rules.push({
          kind: 'contextual-atom',
          identity,
          className,
          selector: `.${className}${renderAttributeCondition(condition)}`
        });
      }
    }
  }

  for (const rule of ancestorAttributeRules) {
    const sourceIndex = rule.attributes.findIndex((conditions) => conditions.length > 0);
    const sourceCondition = rule.attributes[sourceIndex]![0]!;
    const sourceAttribute = canonicalAttributeCondition(sourceCondition);
    const sourcePath = rule.path.slice(0, sourceIndex + 1);
    const sourceMarker = createReadableSourceMarker(moduleId, sourcePath);
    const relationIdentity: ContextualRelationIdentity = {
      moduleId,
      relations: rule.relations.slice(sourceIndex),
      sourceAttribute,
      sourcePath,
      targetPath: rule.path
    };
    const targetMarker = createReadableTargetMarker(relationIdentity);
    ensureScopePath(roots, sourcePath).classNames.add(sourceMarker);
    ensureScopePath(roots, rule.path).classNames.add(targetMarker);
    const selector = `.${sourceMarker}${renderAttributeCondition(sourceCondition)} .${targetMarker}`;

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

  for (const rule of ancestorStateRules) {
    const sourceIndex = rule.states.findIndex((state) => state.length > 0);
    const sourceState = rule.states[sourceIndex]!.join(':');
    const sourcePath = rule.path.slice(0, sourceIndex + 1);
    const sourceMarker = createReadableSourceMarker(moduleId, sourcePath);
    const relationIdentity: ContextualRelationIdentity = {
      moduleId,
      relations: rule.relations.slice(sourceIndex),
      sourceState,
      sourcePath,
      targetPath: rule.path
    };
    const targetMarker = createReadableTargetMarker(relationIdentity);
    ensureScopePath(roots, sourcePath).classNames.add(sourceMarker);
    ensureScopePath(roots, rule.path).classNames.add(targetMarker);
    const selector = `.${sourceMarker}:${sourceState} .${targetMarker}`;

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

  for (const rule of contextualRules) {
    const firstRuntimeRelation = rule.relations.findIndex(
      (relation) => relation !== 'descendant'
    );
    const runtimeRelations = rule.relations.slice(firstRuntimeRelation);
    const sourcePath = rule.path.slice(0, firstRuntimeRelation + 1);
    const runtimePaths = rule.path.slice(firstRuntimeRelation);
    const sourceState = rule.states[firstRuntimeRelation]?.join(':') || undefined;
    const sourceAttributeCondition = rule.attributes[firstRuntimeRelation]?.[0];
    const sourceAttribute = sourceAttributeCondition
      ? canonicalAttributeCondition(sourceAttributeCondition)
      : undefined;
    const sourceMarker = createReadableSourceMarker(moduleId, sourcePath);
    const relationIdentity: ContextualRelationIdentity = {
      moduleId,
      relations: runtimeRelations,
      ...(sourceState ? { sourceState } : {}),
      ...(sourceAttribute ? { sourceAttribute } : {}),
      sourcePath,
      targetPath: rule.path
    };
    const targetMarker = createReadableTargetMarker(relationIdentity);
    const markers = runtimePaths.map((_, index) => {
      const path = rule.path.slice(0, firstRuntimeRelation + index + 1);
      const marker = index === 0
        ? sourceMarker
        : index === runtimePaths.length - 1
          ? targetMarker
          : createReadableContextMarker(relationIdentity, index, path);
      ensureScopePath(roots, path).classNames.add(marker);
      return marker;
    });
    const selector = markers.map((marker, index) =>
      index === 0
        ? `.${marker}${sourceState ? `:${sourceState}` : ''}${
          sourceAttributeCondition ? renderAttributeCondition(sourceAttributeCondition) : ''
        }`
        : ` ${renderRelationCombinator(runtimeRelations[index - 1]!)} .${marker}`
    ).join('');

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

function renderObservedCombinator(
  relation: ObservedRelationIdentity['relation']
): '' | '> ' | '+ ' | '~ ' {
  if (relation === 'child') return '> ';
  if (relation === 'adjacent') return '+ ';
  if (relation === 'general-sibling') return '~ ';
  return '';
}

function canonicalAttributeCondition(condition: ParsedAttributeCondition): string {
  return `attribute:${condition.attribute}=${condition.value}`;
}

function renderAttributeCondition(condition: ParsedAttributeCondition): string {
  return `[${condition.attribute}=${JSON.stringify(condition.value)}]`;
}

function renderRelationCombinator(
  relation: ContextualRelationIdentity['relations'][number]
): '>' | '+' | '~' | '' {
  if (relation === 'child') return '>';
  if (relation === 'adjacent') return '+';
  if (relation === 'general-sibling') return '~';
  return '';
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
  if ('observedClass' in identity) {
    return JSON.stringify([
      'observed',
      identity.moduleId,
      identity.subjectPath,
      identity.relation,
      identity.observedClass,
      identity.property,
      identity.value,
      identity.important
    ]);
  }
  if ('relations' in identity) {
    return JSON.stringify([
      'contextual',
      identity.moduleId,
      identity.relations,
      identity.sourceState,
      identity.sourceAttribute,
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
