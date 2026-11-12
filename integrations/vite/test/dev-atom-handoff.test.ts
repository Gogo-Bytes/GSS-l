import { createGssCompilerSession } from '@gss-l/compiler';
import { expect, it } from 'vitest';
import { findAtomRename } from '../src/dev-atom-handoff.js';

function snapshot(source: string, secondModule = false) {
  const session = createGssCompilerSession({ projectRoot: '/app' });
  expect(session.replaceStylesheet({ id: '/app/a.gss', source }).committed).toBe(true);
  if (secondModule) session.replaceStylesheet({ id: '/app/b.gss', source: '.b { color: green }' });
  return session.finalize();
}
const base = '.title { color: red }';
const extra = '\n.extra { color: blue }';

it('bridges both directions of the unchanged title atom, with no rule for the newly introduced color', () => {
  const before = snapshot(base), after = snapshot(base + extra);
  const title = (s: typeof before) => s.manifest.rules.find(r => r.value === 'red')!.className;
  expect(findAtomRename(before, after)).toEqual({ from: title(before), to: title(after) });
  expect(findAtomRename(after, before)).toEqual({ from: title(after), to: title(before) });
});

it('keeps native delivery for changed declarations, ambiguous renames, contexts, resources and other modules', () => {
  for (const prefix of ['.title:hover {width:1px}', '@media print {.title {opacity:1}}',
    '@font-face {font-family:Test;src:local(Test)}']) {
    expect(findAtomRename(snapshot(prefix + base), snapshot(prefix + base + extra))).toBeUndefined();
  }
  expect(findAtomRename(snapshot(base), snapshot('.title { color: gold }' + extra))).toBeUndefined();
  expect(findAtomRename(snapshot(base, true), snapshot(base + extra, true))).toBeUndefined();
  const two = base + '.title {width:12px}';
  expect(findAtomRename(snapshot(two), snapshot(two + extra + '.extra {width:15px}'))).toBeUndefined();
});
