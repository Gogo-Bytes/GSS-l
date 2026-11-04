/// <reference types="@gss-l/types/client" />

declare module 'virtual:gss.css?url' {
  /** Aggregate GSS stylesheet href; render once through the host's normal stylesheet link. */
  const href: string;
  export default href;
}
