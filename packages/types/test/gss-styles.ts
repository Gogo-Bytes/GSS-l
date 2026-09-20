import type { GssScope, GssStyles, GssUnknownScope } from '../src/index.js';

declare const styles: GssStyles;
const scope: GssUnknownScope = styles.card!;
const branded: GssScope = scope;
const nested: GssUnknownScope = scope.icon!.label!;
const className: string = nested.self;
void branded;
void className;

// @ts-expect-error A recursive scope object is not a class string.
const invalidClassName: string = scope;
void invalidClassName;

// @ts-expect-error Plain objects cannot forge the scope brand.
const unbranded: GssUnknownScope = { self: 'card' };
void unbranded;

// @ts-expect-error The explicit self property is a string, not a scope.
const invalidSelf: GssScope = scope.self;
void invalidSelf;
