import { parse, type DefaultTreeAdapterMap } from 'parse5';

export function hasCentralStylesheet(html: string, href: string): boolean {
  return containsLink(parse(html), href);
}

export function injectCentralStylesheet(html: string, href: string): string {
  const document = parse(html, { sourceCodeLocationInfo: true });
  if (containsLink(document, href)) return html;
  const escaped = href.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  const link = `<link rel="stylesheet" href="${escaped}">`;
  const root = document.childNodes.find((node) => 'tagName' in node && node.tagName === 'html');
  const head = root && 'childNodes' in root
    ? root.childNodes.find((node) => 'tagName' in node && node.tagName === 'head')
    : undefined;
  if (head && 'tagName' in head && head.sourceCodeLocation?.startTag) {
    const offset = head.sourceCodeLocation.endTag?.startOffset ?? head.sourceCodeLocation.startTag.endOffset;
    return html.slice(0, offset) + link + html.slice(offset);
  }
  const rootStart = root && 'tagName' in root ? root.sourceCodeLocation?.startTag?.endOffset : undefined;
  const doctype = document.childNodes.find((node) => node.nodeName === '#documentType');
  const offset = rootStart ?? doctype?.sourceCodeLocation?.endOffset ?? 0;
  return html.slice(0, offset) + `<head>${link}</head>` + html.slice(offset);
}

function containsLink(node: DefaultTreeAdapterMap['node'], href: string): boolean {
  if ('tagName' in node && node.tagName === 'link') {
    const attributes = new Map(node.attrs.map(({ name, value }) => [name, value]));
    if (attributes.get('rel')?.toLowerCase().split(/\s+/).includes('stylesheet') &&
        attributes.get('href')?.split(/[?#]/)[0] === href) return true;
  }
  return 'childNodes' in node && node.childNodes.some((child) => containsLink(child, href));
}
