import type { GssScope, GssStyles, GssUnknownScope } from '../src/index.js';

declare const styles: GssStyles;
const scope: GssUnknownScope = styles.card!;
const branded: GssScope = scope;
const nested: GssUnknownScope = scope.icon!.label!;
const nestedClassName: string = nested;
void branded;
void nestedClassName;

const className: string = scope;
void className;

// @ts-expect-error Plain objects cannot forge the scope brand.
const unbranded: GssUnknownScope = { icon: 'card' };
void unbranded;
