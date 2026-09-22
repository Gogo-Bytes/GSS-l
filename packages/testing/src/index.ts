import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { referenceContentValue, referenceImageUrl, renderReferenceUrl } from './asset-value.js';
import { toLogicalModuleId } from './module-identity.js';
import type {
  FinalizeGssOptions, GssCompilerConfig, GssDiagnostic,
  ReplaceStylesheetInput, ScopeNodeSchema, ScopeSchema
} from '@gss-l/compiler';

export type CompileGssReferenceInput = {
  config: GssCompilerConfig;
  modules: readonly ReplaceStylesheetInput[];
};

export type ReferenceCompilerPorts = Pick<FinalizeGssOptions, 'resolveAssetUrl'>;

export type ReferenceCompileResult =
  | { success: true; css: string; scopeSchemas: Readonly<Record<string, ScopeSchema>>; diagnostics: readonly GssDiagnostic[] }
  | { success: false; diagnostics: readonly GssDiagnostic[] };

/** Independent authored CSS renderer for the bounded ownership testing slice. */
export function compileGssReference(
  input: CompileGssReferenceInput,
  ports: ReferenceCompilerPorts = {}
): ReferenceCompileResult {
  const ordering = referenceOrdering(input.config);
  if (!ordering) return failure('<config>', 'unsupported-reference-config',
    'Reference ordering requires one bounded condition kind and unique simple named layers.');
  const scopeSchemas: Record<string, ScopeSchema> = Object.create(null);
  const css: { rank: number; css: string }[] = [];
  const prepared: postcss.Root[] = [];
  const bound: { id: string; declaration: postcss.Declaration; identity: string }[] = [];
  const modules = new Map<string, ReplaceStylesheetInput>();
  for (const module of input.modules) {
    const logicalId = toLogicalModuleId(input.config.projectRoot, module.id);
    if (!logicalId) {
      return failure(module.id, 'invalid-reference-module-id', 'A project-relative Module identity is required.');
    }
    if (modules.has(logicalId)) {
      return failure(module.id, 'duplicate-reference-module', 'Reference input must contain unique logical Module identities.');
    }
    modules.set(logicalId, module);
  }
  for (const [logicalId, module] of [...modules].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) {
    let root: postcss.Root;
    try {
      root = postcss.parse(module.source);
    } catch {
      return failure(module.id, 'invalid-reference-css', 'Unable to parse reference CSS.', 'parse');
    }
    const images = new Map<postcss.Declaration, string>();
    const selectors = new Map<postcss.Rule, selectorParser.Root>();
    const rules: postcss.Rule[] = [];
    const validate = (container: postcss.Root | postcss.AtRule, inLayer = false, inCondition = false): boolean => {
      for (const node of container.nodes ?? []) {
        if (node.type === 'comment') continue;
        if (node.type === 'rule') { rules.push(node); continue; }
        if (node.type !== 'atrule' || !node.nodes) return false;
        if (node.name === 'layer') {
          if (inLayer || inCondition || !ordering.layers.includes(node.params) || !validate(node, true, false)) return false;
        } else {
          if (inCondition || node.name !== ordering.kind || !ordering.queries.includes(node.params) || !validate(node, inLayer, true)) return false;
        }
      }
      return true;
    };
    if (!validate(root)) return failure(module.id, 'unsupported-reference-syntax',
      'Reference wrappers require registered flat conditions, optionally inside one configured named layer.');
    for (const node of rules) {
      const selector = parseReferenceSelector(node.raws.selector?.raw ?? node.selector);
      if (!selector) {
        return failure(module.id, 'unsupported-reference-syntax',
          'Reference rules require local descendant paths with bounded native states and terminal before/after pseudo-elements.');
      }
      selectors.set(node, selector);
      const seen = new Set<string>();
      for (const child of node.nodes) {
        if (child.type === 'comment') continue;
        if (child.type !== 'decl' || !properties.has(child.prop) ||
          child.raws.before?.includes('_') || child.raws.before?.includes('*')) {
          return failure(module.id, 'unsupported-reference-syntax',
            'Reference coverage supports only bounded background-image, basic content/color/display/size and physical margin/padding declarations.');
        }
        if (child.prop === 'background-image') {
          // PostCSS stores leading value comments after the colon in `between`.
          const image = child.raws.between?.includes('/*') ? undefined
            : referenceImageUrl(child.raws.value?.raw ?? child.value);
          if (!image) return failure(module.id, 'unsupported-reference-syntax', 'Reference background-image requires none or one bounded URL.');
          if (image.url !== undefined) images.set(child, image.url);
        } else if (child.prop === 'content' ? !referenceContentValue(child.value) : /[()\\]/.test(child.value)) {
          return failure(module.id, 'unsupported-reference-syntax', 'Reference values do not support functions or escapes.');
        }
        const key = `${child.prop}:${child.important ? 'important' : 'normal'}`;
        if (seen.has(key)) {
          return failure(module.id, 'duplicate-reference-property',
            `Duplicate exact-property declarations for ${child.prop} are not GSS fallback syntax.`);
        }
        seen.add(key);
      }
    }
    const bindings = new Map<string, string>();
    const discovered = new Set(images.values());
    for (const { url, identity } of module.assetReferences ?? []) {
      if (!url || !identity || !discovered.has(url) || bindings.has(url) && bindings.get(url) !== identity) {
        return failure(module.id, 'invalid-reference-asset-binding', 'Asset bindings require nonempty fields, discovered URLs and one identity per URL.');
      }
      bindings.set(url, identity);
    }
    for (const [declaration, url] of images) {
      const identity = bindings.get(url);
      if (identity !== undefined) bound.push({ id: module.id, declaration, identity });
    }
    const exports: Record<string, ScopeNodeSchema> = Object.create(null);
    root.walkRules((rule) => {
      let targets = exports;
      const selector = selectors.get(rule)!;
      selector.walkClasses((reference) => {
        const name = reference.value;
        const className = `gss_ref_${encode(logicalId)}__${encode(name)}`;
        const node = targets[name] ??= { selfClassName: className, targets: Object.create(null) };
        targets = node.targets as Record<string, ScopeNodeSchema>;
        reference.value = className;
      });
      rule.selector = selector.toString();
    });
    scopeSchemas[module.id] = { moduleId: module.id, exports };
    prepared.push(root);
  }
  // Every source/config/binding is validated before entering the host boundary.
  // The cache is invocation-local; callback side effects cannot be rolled back.
  const resolved = new Map<string, string>();
  for (const { id, declaration, identity } of bound) {
    try {
      let value = resolved.get(identity);
      if (value === undefined) {
        const url = ports.resolveAssetUrl?.(identity);
        if (typeof url !== 'string' || !url) throw new Error('Missing output URL');
        value = renderReferenceUrl(url);
        resolved.set(identity, value);
      }
      declaration.value = value;
      delete declaration.raws.value;
    } catch {
      return failure(id, 'reference-asset-resolution-failed', 'Bound Asset resolution requires a nonempty output URL without a resolver exception.');
    }
  }
  for (const root of prepared) {
    for (const [rank, group] of partitionByCondition(root, ordering.queries)) css.push({ rank, css: group.toString() });
  }
  // Stable sort moves whole authored groups, never declarations or specificity. Native CSS
  // resolves importance/layers/selectors; only registered condition appearance is synthesized.
  css.sort((left, right) => left.rank - right.rank);
  const prelude = ordering.layers.length ? `@layer ${ordering.layers.join(', ')};\n` : '';
  return { success: true, css: prelude + css.map((group) => group.css).join('\n'), scopeSchemas, diagnostics: [] };
}

function referenceOrdering(config: GssCompilerConfig) {
  const layers = config.layers ?? [];
  if (layers.some((name) => !simpleName.test(name) || reservedNames.has(name.toLowerCase())) || new Set(layers).size !== layers.length) return undefined;
  const entries = Object.entries(config.conditions ?? {});
  if (entries.some(([kind]) => !['media', 'supports', 'container'].includes(kind))) return undefined;
  const active = entries.filter(([, queries]) => queries.length);
  if (active.length > 1) return undefined;
  const [kind, queries] = active[0] ?? ['', []];
  if (new Set(queries).size !== queries.length || queries.some((query) => !boundedQuery(kind, query))) return undefined;
  return { layers, kind, queries };
}
const reservedNames = new Set(['initial', 'inherit', 'unset', 'revert', 'revert-layer', 'default', 'none']);
const containerOperators = new Set(['not', 'and', 'or']);
const simpleName = /^[A-Za-z_][A-Za-z0-9_-]*$/;
function boundedQuery(kind: string, query: string): boolean {
  if (kind === 'supports') return /^\(display: (?:block|grid|gss-unsupported)\)$/.test(query);
  const width = /^\((?:min|max)-width: (?:0|[1-9][0-9]*)px\)$/;
  if (kind === 'media') return width.test(query);
  if (kind === 'container') {
    const name = query.split(' ')[0]!.toLowerCase();
    return width.test(query) || !reservedNames.has(name) && !containerOperators.has(name) &&
      /^[A-Za-z_][A-Za-z0-9_-]* \((?:min|max)-width: (?:0|[1-9][0-9]*)px\)$/.test(query);
  }
  return false;
}

/** Partition complete rule groups by registered rank, retaining outer native layers. */
function partitionByCondition<T extends postcss.Root | postcss.AtRule>(container: T, queries: readonly string[]): Map<number, T> {
  const groups = new Map<number, T>();
  const append = (rank: number, node: postcss.ChildNode) => {
    let group = groups.get(rank);
    if (!group) { group = container.clone({ nodes: [] }) as T; groups.set(rank, group); }
    group.append(node.clone());
  };
  for (const node of container.nodes ?? []) {
    if (node.type === 'atrule' && node.name === 'layer') {
      for (const [rank, layer] of partitionByCondition(node, queries)) append(rank, layer);
    } else append(node.type === 'atrule' ? queries.indexOf(node.params) + 1 : 0, node);
  }
  if (!groups.size) groups.set(0, container.clone() as T);
  return groups;
}

function encode(value: string): string {
  return Array.from(value, (character) => character.codePointAt(0)!.toString(16)).join('_');
}

/** Syntax-only gate: never resolves applicability, implication or declaration winners. */
function parseReferenceSelector(source: string): selectorParser.Root | undefined {
  let root: selectorParser.Root;
  try {
    root = selectorParser().astSync(source);
  } catch {
    return undefined;
  }
  if (root.nodes.length !== 1) return undefined;
  let expectClass = true;
  let position = 0;
  let statePosition: number | undefined;
  let hasAttribute = false;
  let hasPseudoElement = false;
  for (const node of root.nodes[0]!.nodes) {
    if (node.type === 'comment') continue;
    if (hasPseudoElement) return undefined;
    if (expectClass && node.type === 'class' && !('namespace' in node) && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(node.value) && !node.toString().includes('\\')) {
      expectClass = false;
      position++;
    } else if (!expectClass && node.type === 'combinator' && /^[\t\n\r\f ]+$/.test(node.value)) {
      expectClass = true;
    } else if (!expectClass && node.type === 'pseudo' && /^::(before|after)$/.test(node.value) && node.nodes.length === 0) {
      if (hasAttribute || (statePosition !== undefined && statePosition !== position)) return undefined;
      hasPseudoElement = true;
    } else if (!expectClass && node.type === 'pseudo' && /^:(checked|disabled)$/.test(node.value) && node.nodes.length === 0) {
      if (hasAttribute || (statePosition !== undefined && statePosition !== position)) return undefined;
      statePosition = position;
    } else if (!expectClass && node.type === 'attribute' && attributeEquality.test(node.toString().trim())) {
      if (hasAttribute || statePosition !== undefined) return undefined;
      hasAttribute = true;
    } else {
      return undefined;
    }
  }
  return position > 0 && !expectClass ? root : undefined;
}
// One lowercase data-/aria- name, '=' only; quoted unescaped single-line text or an ASCII identifier.
// Raw syntax validation excludes namespaces, flags, comments outside strings and other operators.
const attributeEquality = /^\[[\t\n\r\f ]*(?:data|aria)-[a-z][a-z0-9_-]*[\t\n\r\f ]*=[\t\n\r\f ]*(?:"[^"\\\n\r\f\0]*"|'[^'\\\n\r\f\0]*'|[A-Za-z_][A-Za-z0-9_-]*)[\t\n\r\f ]*\]$/;
const properties = new Set([
  'content', 'color', 'background-color', 'background-image', 'display', 'width', 'height',
  'margin', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left'
]);

function failure(
  id: string,
  reason: string,
  message: string,
  phase: GssDiagnostic['phase'] = 'validate'
): ReferenceCompileResult {
  return { success: false, diagnostics: [{
    code: 'GSS_REF_UNSUPPORTED', severity: 'error', phase, id, reason, message
  }] };
}
