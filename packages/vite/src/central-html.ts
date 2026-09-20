import { parse, type DefaultTreeAdapterMap } from 'parse5';

export function hasCentralStylesheet(html: string, href: string): boolean {
  return containsLink(parse(html), href);
}

function containsLink(node: DefaultTreeAdapterMap['node'], href: string): boolean {
  if ('tagName' in node && node.tagName === 'link') {
    const attributes = new Map(node.attrs.map(({ name, value }) => [name, value]));
    if (attributes.get('rel')?.toLowerCase().split(/\s+/).includes('stylesheet') &&
        attributes.get('href')?.split(/[?#]/)[0] === href) return true;
  }
  return 'childNodes' in node && node.childNodes.some((child) => containsLink(child, href));
}
