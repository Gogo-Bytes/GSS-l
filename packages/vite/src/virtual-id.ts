const GSS_PREFIX = '\0gss-l:';
export const CENTRAL_CSS_URL = '/@gss-l/central.css';
const CENTRAL_CSS_ID = '\0gss-l:central.css';

export function resolveCentralCssId(id: string): string | undefined {
  const [path, query] = id.split('?');
  if (path !== CENTRAL_CSS_URL && path !== CENTRAL_CSS_ID) return undefined;
  return CENTRAL_CSS_ID + (query === undefined ? '' : `?${query}`);
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
