export type OrderableCondition = {
  kind: 'media' | 'supports' | 'container';
  query: string;
};

export type OrderableRule = {
  className: string;
  layer?: string;
  wrappers?: readonly OrderableCondition[];
};

export type RuleOrderConfig = {
  layers?: readonly string[];
  conditions?: {
    media?: readonly string[];
    supports?: readonly string[];
    container?: readonly string[];
  };
};

export function compareRuleOrder(
  left: OrderableRule,
  right: OrderableRule,
  config: RuleOrderConfig
): number {
  const layerOrder = compareRegisteredValue(
    left.layer ?? 'unlayered',
    right.layer ?? 'unlayered',
    config.layers ?? [],
    'unlayered'
  );
  if (layerOrder !== 0) return layerOrder;

  const conditions = compareConditions(left.wrappers ?? [], right.wrappers ?? [], config);
  if (conditions !== 0) return conditions;

  return left.className.localeCompare(right.className);
}

function compareConditions(
  left: readonly OrderableCondition[],
  right: readonly OrderableCondition[],
  config: RuleOrderConfig
): number {
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) {
    const leftCondition = left[index];
    const rightCondition = right[index];
    if (!leftCondition) return -1;
    if (!rightCondition) return 1;

    const kind = leftCondition.kind.localeCompare(rightCondition.kind);
    if (kind !== 0) return kind;

    const query = compareRegisteredValue(
      leftCondition.query,
      rightCondition.query,
      config.conditions?.[leftCondition.kind] ?? []
    );
    if (query !== 0) return query;
  }
  return 0;
}

function compareRegisteredValue(
  left: string,
  right: string,
  registered: readonly string[],
  first?: string
): number {
  if (left === right) return 0;
  if (left === first) return -1;
  if (right === first) return 1;

  const leftRank = registered.indexOf(left);
  const rightRank = registered.indexOf(right);
  if (leftRank >= 0 && rightRank >= 0) return leftRank - rightRank;
  if (leftRank >= 0) return -1;
  if (rightRank >= 0) return 1;
  return left.localeCompare(right);
}
