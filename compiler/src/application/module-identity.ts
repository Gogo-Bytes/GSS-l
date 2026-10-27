type AbsolutePath = { anchor: string; segments: string[] };

/** Pure lexical conversion: the host owns filesystem resolution and canonicalization. */
export function toLogicalModuleId(projectRoot: string, id: string): string | undefined {
  const normalizedId = id.replaceAll('\\', '/');
  const source = absolutePath(normalizedId);
  // Logical ids are already relative; retain the existing direct Compiler contract.
  if (!source) return normalizedId;
  const root = absolutePath(projectRoot.replaceAll('\\', '/'));
  if (!root || root.anchor !== source.anchor) return undefined;
  let common = 0;
  while (common < root.segments.length && root.segments[common] === source.segments[common]) {
    common += 1;
  }
  return [
    ...Array<string>(root.segments.length - common).fill('..'),
    ...source.segments.slice(common)
  ].join('/');
}

function absolutePath(path: string): AbsolutePath | undefined {
  const match = /^(?:([A-Za-z]:)\/|(\/\/[^/]+\/[^/]+)(?:\/|$)|(\/))/.exec(path);
  if (!match) return undefined;
  const anchor = (match[1] ?? match[2] ?? '/').toLowerCase();
  const segments: string[] = [];
  for (const segment of path.slice(match[0].length).split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') segments.pop();
    else segments.push(segment);
  }
  return { anchor, segments };
}
