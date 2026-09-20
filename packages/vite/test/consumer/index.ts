import styles from './Card.gss';
import type { GssScope, GssUnknownScope } from '@gss-l/types';

const card: GssScope = styles.card;
const self: string = styles.card.self;
const nested: GssUnknownScope = styles.card.icon.label;
const nestedSelf: string = nested.self;
// Broad types intentionally allow undeclared paths; the React Adapter validates them.
const unknown: GssScope = styles.notDeclared;
void card;
void self;
void nestedSelf;
void unknown;

// @ts-expect-error A scope object cannot be used as a class string.
const invalidClassName: string = styles.card;
void invalidClassName;

// @ts-expect-error Nested scopes retain the object brand.
const invalidNestedClassName: string = styles.card.icon;
void invalidNestedClassName;

// @ts-expect-error Scope exports are read-only.
styles.card = styles.other;
