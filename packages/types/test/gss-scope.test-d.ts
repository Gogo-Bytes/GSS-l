import type { GssScope } from '../src/index.js';

declare const scope: GssScope<{
  readonly icon: GssScope;
}>;

const selfClassName: string = scope.self;
const iconClassName: string = scope.icon.self;
void selfClassName;
void iconClassName;

const className: string = scope;
void className;

const nestedClassName: string = scope.icon;
void nestedClassName;
