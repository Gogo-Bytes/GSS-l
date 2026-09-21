import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
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
  // Reserved public seam: this slice rejects assets before any resolver is called.
  void ports;
  if ((input.config.layers?.length ?? 0) > 0 ||
    Object.values(input.config.conditions ?? {}).some((queries) => queries.length > 0)) {
    return failure('<config>', 'unsupported-reference-config',
      'Reference coverage does not yet include configured layer or condition ordering.');
  }
  const scopeSchemas: Record<string, ScopeSchema> = Object.create(null);
  const css: string[] = [];
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
    if (module.assetReferences?.length) {
      return failure(module.id, 'unsupported-reference-assets', 'Reference asset bindings are not supported yet.');
    }
    let root: postcss.Root;
    try {
      root = postcss.parse(module.source);
    } catch {
      return failure(module.id, 'invalid-reference-css', 'Unable to parse reference CSS.', 'parse');
    }
    const selectors = new Map<postcss.Rule, selectorParser.Root>();
    for (const node of root.nodes) {
      if (node.type === 'comment') continue;
      const selector = node.type === 'rule' ? parseReferenceSelector(node.raws.selector?.raw ?? node.selector) : undefined;
      if (node.type !== 'rule' || !selector) {
        return failure(module.id, 'unsupported-reference-syntax',
          'Reference rules require local descendant paths with bounded native state conditions.');
      }
      selectors.set(node, selector);
      const seen = new Set<string>();
      for (const child of node.nodes) {
        if (child.type === 'comment') continue;
        if (child.type !== 'decl' || !properties.has(child.prop) || /[()\\\\]/.test(child.value) ||
          child.raws.before?.includes('_') || child.raws.before?.includes('*')) {
          return failure(module.id, 'unsupported-reference-syntax',
            'Reference coverage supports only basic color/display/size and physical margin/padding declarations without functions or escapes.');
        }
        const key = `${child.prop}:${child.important ? 'important' : 'normal'}`;
        if (seen.has(key)) {
          return failure(module.id, 'duplicate-reference-property',
            `Duplicate exact-property declarations for ${child.prop} are not GSS fallback syntax.`);
        }
        seen.add(key);
      }
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
    css.push(root.toString());
  }
  return { success: true, css: css.join('\n'), scopeSchemas, diagnostics: [] };
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
  for (const node of root.nodes[0]!.nodes) {
    if (node.type === 'comment') continue;
    if (expectClass && node.type === 'class' && !('namespace' in node) && /^[A-Za-z_][A-Za-z0-9_-]*$/.test(node.value) && !node.toString().includes('\\')) {
      expectClass = false;
      position++;
    } else if (!expectClass && node.type === 'combinator' && /^[\t\n\r\f ]+$/.test(node.value)) {
      expectClass = true;
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
  'color', 'background-color', 'display', 'width', 'height',
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
