import postcss from 'postcss';
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
    for (const node of root.nodes) {
      if (node.type === 'comment') continue;
      if (node.type !== 'rule' || !localDescendantSelector.test(node.selector)) {
        return failure(module.id, 'unsupported-reference-syntax',
          'Reference rules must use plain local classes separated only by descendant whitespace.');
      }
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
      const authoredSelector = rule.raws.selector?.raw ?? rule.selector;
      rule.selector = authoredSelector.replace(/\/\*[\s\S]*?\*\/|\.([A-Za-z_][A-Za-z0-9_-]*)/g, (match, name: string | undefined) => {
        if (name === undefined) return match; // Comments are authored text, not scope references.
        const className = `gss_ref_${encode(logicalId)}__${encode(name)}`;
        const node = targets[name] ??= { selfClassName: className, targets: Object.create(null) };
        targets = node.targets as Record<string, ScopeNodeSchema>;
        return `.${className}`;
      });
    });
    scopeSchemas[module.id] = { moduleId: module.id, exports };
    css.push(root.toString());
  }
  return { success: true, css: css.join('\n'), scopeSchemas, diagnostics: [] };
}

function encode(value: string): string {
  return Array.from(value, (character) => character.codePointAt(0)!.toString(16)).join('_');
}

const localDescendantSelector = /^\.[A-Za-z_][A-Za-z0-9_-]*(?:[\t\n\r\f ]+\.[A-Za-z_][A-Za-z0-9_-]*)*$/;
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
