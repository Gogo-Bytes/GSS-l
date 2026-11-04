import styles from './Card.gss';
import type { GssScope } from '@gss-l/types';

const scope: GssScope = styles.card!;
const className: string = scope;
void className;
// @ts-expect-error Scope exports remain read-only.
styles.card = styles.other;
// @ts-expect-error The common client must not declare Vite's virtual module.
import href from 'virtual:gss.css?url';
void href;
