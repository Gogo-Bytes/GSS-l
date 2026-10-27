import postcss from 'postcss';
import { transform, type Targets } from 'lightningcss';

export type PhysicalDeclaration = { property: string; value: string; important: boolean };
export type CompatibilityTransformer = {
  expand(declaration: PhysicalDeclaration): readonly PhysicalDeclaration[] | undefined;
  expandResource(css: string, kind: 'property' | 'keyframes' | 'font-face'): string | undefined;
};

const supportedBrowsers = new Set(['chrome', 'edge', 'firefox', 'safari', 'ios_saf']);

/** No Browserslist discovery: the caller supplies ordered, already-resolved host stages. */
export function createCompatibilityTransformer(
  stages: readonly Readonly<Record<string, string>>[]
): CompatibilityTransformer | undefined {
  if (!Array.isArray(stages) || stages.length === 0) return undefined;
  const targetStages: Targets[] = [];
  for (const versions of stages) {
    if (!versions || typeof versions !== 'object' || Array.isArray(versions) ||
      Object.keys(versions).length === 0 || Object.keys(versions).some((name) => !supportedBrowsers.has(name))) return undefined;
    const targets: Targets = {};
    for (const [name, version] of Object.entries(versions)) {
      if (typeof version !== 'string' || !/^\d{1,3}(?:\.\d{1,3}){0,2}$/.test(version)) return undefined;
      const components = version.split('.').map(Number);
      if (components.some((component) => component > 255)) return undefined;
      (targets as Record<string, number>)[name] = ((components[0] ?? 0) << 16) |
        ((components[1] ?? 0) << 8) | (components[2] ?? 0);
    }
    targetStages.push(targets);
  }
  const cache = new Map<string, readonly PhysicalDeclaration[] | undefined>();
  return {
    expand(declaration) {
      const key = JSON.stringify(declaration);
      if (cache.has(key)) return cache.get(key);
      let physical: readonly PhysicalDeclaration[] | undefined = [declaration];
      try {
        const probe = '.gss-compat-probe';
        for (const targets of targetStages) {
          const css = `${probe} { ${physical.map(({ property, value, important }) =>
            `${property}: ${value}${important ? ' !important' : ''};`).join(' ')} }`;
          const result = transform({ filename: 'declaration.css', code: new TextEncoder().encode(css),
            targets, minify: false });
          const root = postcss.parse(result.code.toString());
          const rule = root.nodes[0];
          if (result.warnings.length || root.nodes.length !== 1 || rule?.type !== 'rule' ||
            rule.selector !== probe || rule.nodes.length === 0 || !rule.nodes.every((node) => node.type === 'decl')) {
            physical = undefined;
            break;
          }
          physical = rule.nodes.map((node) =>
            ({ property: node.prop, value: node.value, important: node.important === true }));
        }
      } catch { physical = undefined; /* Never silently emit untransformed CSS. */ }
      cache.set(key, physical);
      return physical;
    },
    expandResource(css, kind) {
      try {
        const root = postcss.parse(css);
        const wrappers: { name: string; params: string }[] = [];
        let current = root.nodes[0];
        if (root.nodes.length !== 1) return undefined;
        while (current?.type === 'atrule' && ['layer', 'media', 'supports', 'container'].includes(current.name)) {
          if (current.nodes?.length !== 1) return undefined;
          wrappers.push({ name: current.name, params: current.params });
          current = current.nodes[0];
        }
        if (current?.type !== 'atrule' || current.name !== kind) return undefined;
        let transformed = current.toString();
        for (const targets of targetStages) {
          const result = transform({ filename: 'resource.css', code: new TextEncoder().encode(transformed),
            targets, minify: false });
          if (result.warnings.length) return undefined;
          const output = postcss.parse(result.code.toString());
          if (!output.nodes.length || !output.nodes.every((node) => node.type === 'atrule' &&
            (node.name === kind || (kind === 'keyframes' && node.name === '-webkit-keyframes')) &&
            node.params === current.params && node.nodes?.length &&
            (kind === 'keyframes' ? node.nodes.every((frame) => frame.type === 'rule' &&
              frame.nodes.every((decl) => decl.type === 'decl')) : node.nodes.every((decl) => decl.type === 'decl')))) {
            return undefined;
          }
          transformed = output.toString();
        }
        for (const wrapper of wrappers.reverse()) {
          transformed = `@${wrapper.name} ${wrapper.params} {\n${transformed.split('\n').map((line) => `  ${line}`).join('\n')}\n}`;
        }
        return transformed;
      } catch { return undefined; }
    }
  };
}
