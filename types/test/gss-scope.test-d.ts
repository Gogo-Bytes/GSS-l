import type { GssScope } from '../src/index.js';

declare const scope: GssScope<{
  readonly icon: GssScope;
  readonly self: GssScope;
}>;

const selfChild: GssScope = scope.self;
void selfChild;

const className: string = scope;
void className;

const nestedClassName: string = scope.icon;
void nestedClassName;

// @ts-expect-error The generated class field is internal to lowering.
void scope.$class;
