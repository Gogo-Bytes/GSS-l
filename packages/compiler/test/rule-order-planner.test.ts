import { describe, expect, it } from 'vitest';
import { compareRuleOrder } from '../src/domain/rule-order-planner.js';

const rule = (className: string, options: {
  property?: string;
  layer?: string;
  relationRank?: number;
  wrappers?: readonly { kind: 'media' | 'supports' | 'container'; query: string }[];
} = {}) => ({
  className,
  identity: { property: options.property ?? 'color' },
  ...options
});

describe('RuleOrderPlanner', () => {
  it('places unlayered rules after configured layers', () => {
    const config = { layers: ['reset', 'components'] };
    expect(compareRuleOrder(rule('reset', { layer: 'reset' }), rule('plain'), config)).toBeGreaterThan(0);
    expect(compareRuleOrder(rule('components', { layer: 'components' }), rule('plain'), config)).toBeGreaterThan(0);
  });

  it('uses configured layer order instead of class-name order', () => {
    const config = { layers: ['components', 'utilities'] };
    expect(compareRuleOrder(
      rule('z', { layer: 'components' }),
      rule('a', { layer: 'utilities' }),
      config
    )).toBeLessThan(0);
  });

  it('uses registered condition order within the same layer', () => {
    const config = { conditions: { media: ['(min-width: 40rem)', '(min-width: 80rem)'] } };
    expect(compareRuleOrder(
      rule('wide', { wrappers: [{ kind: 'media', query: '(min-width: 80rem)' }] }),
      rule('narrow', { wrappers: [{ kind: 'media', query: '(min-width: 40rem)' }] }),
      config
    )).toBeGreaterThan(0);
  });

  it('keeps relation rank ahead of property render order', () => {
    expect(compareRuleOrder(
      rule('contextual', { relationRank: 1, property: 'color' }),
      rule('pure', { relationRank: 0, property: 'border' }),
      {}
    )).toBeGreaterThan(0);
  });

  it('has a deterministic fallback for unregistered values', () => {
    expect(compareRuleOrder(
      rule('a', { layer: 'zeta' }),
      rule('b', { layer: 'alpha' }),
      {}
    )).toBeGreaterThan(0);
  });
});
