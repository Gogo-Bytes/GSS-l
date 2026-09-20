const GSS_PREFIX = '\0gss-l:';

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
