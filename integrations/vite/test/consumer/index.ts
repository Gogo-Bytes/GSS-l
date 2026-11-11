import styles from './Card.gss';
import type { GssScope, GssUnknownScope } from '@gss-l/types';

const card: GssScope = styles.card;
const nested: GssUnknownScope = styles.card.icon.label;
const label: string = nested;
// Broad types intentionally allow undeclared paths; the React Adapter validates them.
const unknown: GssScope = styles.notDeclared;
void card;
void label;
void unknown;

const className: string = styles.card;
const nestedClassName: string = styles.card.icon;
void className;
void nestedClassName;

// @ts-expect-error Scope exports are read-only.
styles.card = styles.other;

import stylesheetHref from 'virtual:gss.css?url';
const href: string = stylesheetHref;
void href;
