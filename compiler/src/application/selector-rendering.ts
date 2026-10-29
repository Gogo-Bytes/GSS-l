import selectorParser from 'postcss-selector-parser';
import type { ParsedAttributeCondition } from '../domain/parsed-stylesheet.js';
import type { ContextualRelationIdentity, ObservedRelationIdentity } from '../domain/readable-name.js';
import type { NameAllocatorPort } from './name-allocator.js';
import { ensureScopePath, type MutableScopeNode } from './scope-exports.js';

// Rendering consumes already-planned relations. Local classes discovered in
// native residual selectors must still register their scope marker; :global()
// nodes remain native and must not acquire local membership.
export function renderObservedCombinator(
  relation: ObservedRelationIdentity['relation']
): '' | '> ' | '+ ' | '~ ' {
  if (relation === 'child') return '> ';
  if (relation === 'adjacent') return '+ ';
  if (relation === 'general-sibling') return '~ ';
  return '';
}

export function canonicalAttributeCondition(condition: ParsedAttributeCondition): string {
  return `attribute:${condition.attribute}=${condition.value}`;
}

export function renderAttributeCondition(condition: ParsedAttributeCondition): string {
  const attribute = selectorParser.attribute({ attribute: condition.attribute, operator: condition.operator,
    value: condition.value, quoteMark: '"', raws: {} });
  attribute.setValue(condition.value, { quoteMark: '"' });
  return attribute.toString();
}

export function renderStateSuffix(
  states: readonly string[],
  moduleId: string,
  nameAllocator: NameAllocatorPort,
  roots: Map<string, MutableScopeNode>
): string {
  return states.map((state) => state === 'self' ? '' :
    renderNativeSelector(`:${state}`, moduleId, nameAllocator, roots)).join('');
}

export function renderNativeSelector(
  source: string,
  moduleId: string,
  nameAllocator: NameAllocatorPort,
  roots: Map<string, MutableScopeNode>
): string {
  const root = selectorParser().astSync(source);
  const rewrite = (nodes: readonly selectorParser.Node[], global: boolean): void => {
    for (const node of [...nodes]) {
      if (node.type === 'class' && !global) {
        const marker = nameAllocator.createScopeMarker(moduleId, [node.value]);
        ensureScopePath(roots, [node.value]).classNames.add(marker);
        node.value = marker;
        continue;
      }
      if (node.type !== 'pseudo' || !node.nodes) continue;
      if (node.value === ':global' && node.nodes.length === 1) {
        const selector = node.nodes[0]!;
        rewrite(selector.nodes, true);
        node.replaceWith(...[...selector.nodes]);
        continue;
      }
      for (const child of node.nodes) rewrite(child.nodes, global || node.value === ':global');
    }
  };
  for (const branch of root.nodes) rewrite(branch.nodes, false);
  return root.toString();
}

export function renderRelationCombinator(
  relation: ContextualRelationIdentity['relations'][number]
): '>' | '+' | '~' | '' {
  if (relation === 'child') return '>';
  if (relation === 'adjacent') return '+';
  if (relation === 'general-sibling') return '~';
  return '';
}

