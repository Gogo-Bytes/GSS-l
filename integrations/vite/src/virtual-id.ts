const GSS_PREFIX = '\0gss-l:';
export const CENTRAL_CSS_URL = '/@gss-l/central.css';
const CENTRAL_CSS_ID = '\0gss-l:central.css';
export const LINKED_CSS_URL = '/@gss-l/stylesheet.css';
const LINKED_CSS_ID = '\0gss-l:stylesheet.css';
export const STYLESHEET_URL_IMPORT = 'virtual:gss.css?url';
export const STYLESHEET_URL_ID = '\0gss-l:stylesheet-url';

export function resolveCentralCssId(id: string): string | undefined {
  const [path, query] = id.split('?');
  const resolved = path === CENTRAL_CSS_URL || path === CENTRAL_CSS_ID ? CENTRAL_CSS_ID
    : path === LINKED_CSS_URL || path === LINKED_CSS_ID ? LINKED_CSS_ID : undefined;
  return resolved === undefined ? undefined : resolved + (query === undefined ? '' : `?${query}`);
}

export function toVirtualGssId(physicalId: string): string {
  return `${GSS_PREFIX}${physicalId}`;
}

export function fromVirtualGssId(id: string): string | undefined {
  if (!id.startsWith(GSS_PREFIX)) return undefined;
  const physicalId = id.slice(GSS_PREFIX.length);
  return /^(?:\/|[A-Za-z]:\/)/.test(physicalId) && physicalId.endsWith('.gss')
    ? physicalId
    : undefined;
}
