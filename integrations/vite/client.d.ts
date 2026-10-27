declare module '*.gss' {
  import type { GssStyles } from '@gss-l/types';
  const styles: GssStyles;
  export default styles;
}

declare module 'virtual:gss.css?url' {
  /** Aggregate GSS stylesheet href; render once through the host's normal stylesheet link. */
  const href: string;
  export default href;
}
