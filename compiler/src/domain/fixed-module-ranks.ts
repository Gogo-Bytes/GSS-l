import type { ParsedDeclaration, ParsedStyleRule } from './parsed-stylesheet.js';
import { collectOrderOccurrences, type OrderBinding, type OrderInstance, type OrderOccurrence as Occurrence } from './order-occurrences.js';
import { semanticOrderHeights } from './semantic-order-heights.js';
import { propertiesMayOverlapForModuleOrder, propertyOrderPriority, isPropertyOrderReuseBarrier, isPhysicalSingleEffectLonghand } from './module-order-policy.js';

type DeclarationOrder = { atomRank: number; orderSlot: number };

/** Project semantic height, fixed property priority and authored occurrence into
 * output slots, then number versions independently per property. Source order is
 * never a semantic edge. Reuse must preserve both version and output position. */
export function planFixedModuleOrder(rules: readonly ParsedStyleRule[], instances: readonly OrderInstance[]) {
  const { occurrences, key } = collectOrderOccurrences(rules, instances);
  const pending = new Set(occurrences);
  const orders = new Map<string, DeclarationOrder>();
  const overlap = (a: Occurrence, b: Occurrence) =>
    propertiesMayOverlapForModuleOrder(a.declaration.property, b.declaration.property);
  for (const first of occurrences) {
    if (!pending.delete(first)) continue;
    const family = [first];
    for (let i = 0; i < family.length; i++) {
      for (const other of pending) {
        if (other.instance.rule.layer !== first.instance.rule.layer ||
          JSON.stringify(other.instance.rule.conditions) !== JSON.stringify(first.instance.rule.conditions) ||
          other.instance.rule.nodes.at(-1)?.pseudoElement !== first.instance.rule.nodes.at(-1)?.pseudoElement ||
          other.declaration.important !== first.declaration.important ||
          !overlap(family[i]!, other)) continue;
        pending.delete(other);
        family.push(other);
      }
    }
    if (new Set(family.map(({ declaration }) => declaration)).size < 2) continue;
    const heights = semanticOrderHeights(family);
    const compare = (a: Occurrence, b: Occurrence) => heights.get(a)! - heights.get(b)! ||
      propertyOrderPriority(a.declaration.property) - propertyOrderPriority(b.declaration.property) ||
      a.instance.rule.sourceOrdinal - b.instance.rule.sourceOrdinal || a.index - b.index;
    family.sort(compare);
    // Keep the established cross-property projection, including unresolved
    // shorthand source order. A property-local version is never a global sort key.
    let orderSlot = 0;
    const previousByProperty = new Map<string, { occurrence: Occurrence; atomRank: number }>();
    family.forEach((occurrence, index) => {
      if (index === 0 || compare(family[index - 1]!, occurrence) !== 0) orderSlot++;
      const property = occurrence.declaration.property;
      const previous = previousByProperty.get(property);
      const atomRank = previous === undefined ? 1 : previous.atomRank + Number(compare(previous.occurrence, occurrence) !== 0);
      previousByProperty.set(property, { occurrence, atomRank });
      orders.set(occurrence.key, { atomRank, orderSlot });
    });
    reuseContiguousPureOrders(family, heights, orders);
  }
  return { get(declaration: ParsedDeclaration, binding: OrderBinding): DeclarationOrder | undefined {
    return orders.get(key(declaration, binding));
  } };
}

function reusablePureOccurrence({ instance }: Occurrence): boolean {
  const rule = instance.rule;
  return rule.conditions.length === 0 && rule.nodes.length === 1 && instance.targetPath.length === 1 &&
    !instance.sourcePath && instance.sourceIndex === -1 && !instance.observation &&
    !rule.externalTarget && !rule.externalCondition && rule.relations.length === 0 &&
    rule.nodes.every((node) => node.states.length === 0) && rule.nodes.every((node) => node.attributes.length === 0) &&
    rule.nodes.every((node) => node.observations.length === 0) && rule.nodes.every((node) => node.pseudoElement === null);
}

/** Only contract adjacent, wholly eligible original buckets with identical writes.
 * Different target names are NOT a disjointness proof: arbitrary same-module
 * subsets can compose. No unlike competitor may be crossed, and no later rank
 * is renumbered. This bounded model relies on the current overlap registry plus
 * the directional exclusion (except isolated physical longhands), not a universal
 * proof about browser CSS aliases.
 * Exact value spelling is conservative: asset bindings are stylesheet-wide and
 * emitted identities still retain typed asset, layer, condition and importance.
 */
function reuseContiguousPureOrders(family: readonly Occurrence[], heights: ReadonlyMap<Occurrence, number>, orders: Map<string, DeclarationOrder>) {
  // Inspect all pre-pruning competitors, not only the surviving/emitted writes.
  // A logical alias or unresolved shorthand anywhere in this family keeps the
  // old barrier. Original whole-bucket eligibility remains mandatory below.
  const property = family[0]!.declaration.property;
  const isolatedPhysical = isPhysicalSingleEffectLonghand(property) &&
    family.every((occurrence) => occurrence.declaration.property === property);
  const buckets = new Map<number, Occurrence[]>();
  for (const occurrence of family) {
    const orderSlot = orders.get(occurrence.key)!.orderSlot;
    const bucket = buckets.get(orderSlot) ?? [];
    bucket.push(occurrence);
    buckets.set(orderSlot, bucket);
  }
  let previous: { semantic: string; order: DeclarationOrder } | undefined;
  const semantic = ({ declaration }: Occurrence) => JSON.stringify([declaration.property, declaration.value, declaration.important]);
  for (const bucket of buckets.values()) {
    const value = semantic(bucket[0]!);
    // Selector-list branches share tuples, not necessarily eligibility. Never
    // allow a pure branch to license movement of an ineligible sibling.
    if (!bucket.every((occurrence) => heights.get(occurrence) === 0 && reusablePureOccurrence(occurrence) &&
      (isolatedPhysical || !isPropertyOrderReuseBarrier(occurrence.declaration.property)) && semantic(occurrence) === value)) {
      previous = undefined;
      continue;
    }
    const representative = previous?.semantic === value ? previous.order : orders.get(bucket[0]!.key)!;
    for (const occurrence of bucket) orders.set(occurrence.key, representative);
    previous = { semantic: value, order: representative };
  }
}
