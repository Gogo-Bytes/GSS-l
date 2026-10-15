import { createGssCompilerSession, type GssCompilerConfig } from '@gss-l/compiler';

// Finite, versioned capability inventory: new supported syntax adds a case here,
// not a claim that every cross-product of independently supported syntax works.
type Case = {
  id: string; family: string; title: string; source: string;
  config?: Omit<GssCompilerConfig, 'projectRoot'>;
  expected: 'atomic' | 'preserved' | 'rejected';
  diagnostic?: string;
};
const atomic = (id: string, family: string, title: string, source: string): Case =>
  ({ id, family, title, source, expected: 'atomic' });

export const compilerCases: readonly Case[] = [
  atomic('ownership-nesting', 'selector syntax', 'Local ownership paths and standard nesting',
    '.card { color: red; & .title { color: blue; } }'),
  atomic('selector-list', 'selector syntax', 'Selector lists as independent branches', '.card, .other { color: red; }'),
  { id: 'nested-selector-list', family: 'safety boundaries', title: 'List+nested local-class :is normalization is not supported',
    source: '.card, .other { color: red; & .title { color: blue; } }', expected: 'rejected' },
  ...['hover', 'focus', 'focus-visible', 'focus-within', 'active', 'disabled', 'checked'].flatMap((state) => [
    atomic(`state-${state}`, 'pseudo states', `Current :${state}`, `.demo:${state} { color: red; }`),
    atomic(`ancestor-${state}`, 'pseudo states', `Ancestor :${state}`, `.root:${state} .demo { color: red; }`)
  ]),
  ...['before', 'after', 'placeholder', 'marker', 'file-selector-button', 'backdrop', 'first-line', 'first-letter', 'selection'].map((pseudo) =>
    atomic(`pseudo-${pseudo}`, 'pseudo-elements', `::${pseudo} (compile proof; native applicability varies)`, `.demo::${pseudo} { color: red; }`)),
  ...['>', '+', '~'].map((edge, index) => atomic(`relation-${index}`, 'runtime relations', `Runtime ${edge} with ownership suffix`,
    `.root .source ${edge} .target .icon { color: red; }`)),
  atomic('equality-attributes', 'selector syntax', 'Current/ancestor data and ARIA equality',
    '.demo[data-mode="ready"] { color: red; } .root[aria-expanded="true"] .child { color: blue; }'),
  ...['not', 'is', 'where'].map((name) => atomic(`functional-${name}`, 'functional selectors', `:${name} with state/attribute branches`,
    `.demo:${name}(:hover, [data-ready="yes"]) { color: red; }`)),
  atomic('observed-relations', 'functional selectors', ':has local, relative, residual and external observations',
    '.a:has(.error) { color: red; } .b:has(> button) { color: blue; } .c:has(:global(.external)) { color: green; }'),
  atomic('external-targets', 'external integration', 'Anchored external class compound', '.editor :global(.external.focused) { color: red; }'),
  atomic('external-tag', 'external integration', 'Anchored external tag target', '.buttons :global(button) { color: blue; }'),
  atomic('external-attribute', 'external integration', 'Anchored external exact-value attribute', '.labels :global([data-ready="yes"]) { color: green; }'),
  atomic('same-node-global', 'external integration', 'External class condition on an owned node',
    '.editor { color: blue; } .editor:global(.focused) { color: red; }'),
  {
    ...atomic('conditions-layers', 'Compiler configuration', 'Registered media/supports/container and nested layers',
      '@layer framework.base { @media (min-width: 400px) { .media { color: red; } } } @supports (display: grid) { .supports { display: grid; } } @container panel (min-width: 200px) { .size { color: blue; } } @container style(--theme: dark) { .theme { color: white; } }'),
    config: { layers: ['framework.base', 'framework.utilities'], conditions: {
      media: ['(min-width: 400px)'], supports: ['(display: grid)'],
      container: ['panel (min-width: 200px)', 'style(--theme: dark)']
    } }
  },
  atomic('session-lifecycle', 'session and output', 'Replace / shared-owner invalidate / rollback / clean convergence / final cleanup', '.demo { color: blue; }'),
  atomic('identity-paths', 'session and output', 'Unicode and escaped-dot ownership identities remain distinct', '.a\\\\.b { color: red; } .a .b { color: blue; } .café { color: green; }'),
  atomic('unregistered-warning', 'Compiler configuration', 'Unregistered query emits a warning, not a precedence guarantee', '@media (min-width: 321px) { .demo { color: red; } }'),
  atomic('importance-effects', 'declarations', 'Shorthand/longhand winners and importance',
    '.demo { margin: 8px; margin-left: 16px !important; padding-left: 4px; padding: 2px; }'),
  ...['margin', 'padding', 'inset', 'scroll-margin', 'scroll-padding', 'margin-inline', 'margin-block',
    'padding-inline', 'padding-block', 'inset-inline', 'inset-block', 'scroll-margin-inline', 'scroll-margin-block',
    'scroll-padding-inline', 'scroll-padding-block', 'border', 'border-top', 'border-right', 'border-bottom', 'border-left',
    'border-width', 'border-style', 'border-color', 'border-radius', 'border-image', 'background', 'background-position',
    'overflow', 'overscroll-behavior', 'gap', 'grid-gap', 'grid-row-gap', 'grid-column-gap', 'grid', 'grid-template',
    'grid-area', 'grid-row', 'grid-column', 'grid-auto-flow', 'place-content', 'place-items', 'place-self', 'flex',
    'flex-flow', 'columns', 'column-rule', 'list-style', 'outline', 'text-decoration', 'font', 'font-variant',
    'transition', 'animation', 'mask'].map((property) => atomic(`effect-${property}`, 'property-effect inventory',
      `${property}: registered classification (not a value/cascade proof)`, `.demo { ${property}: initial; }`)),
  atomic('effect-box-shadow', 'property-effect inventory', 'Box shadow remains independent of border and background',
    '.demo { box-shadow: 0 3px 10px #20342e08; border: 1px solid blue; background: white; }'),
  atomic('effect-letter-spacing', 'property-effect inventory', 'Letter spacing is not reset by font',
    '.demo { letter-spacing: 2px; font: 16px serif; }'),
  atomic('effect-text-transform', 'property-effect inventory', 'Text transform is not reset by font',
    '.demo { text-transform: uppercase; font: 16px serif; }'),
  atomic('effect-outline-offset', 'property-effect inventory', 'Outline offset is not reset by outline',
    '.demo { outline-offset: 2px; outline: 3px solid blue; }'),
  atomic('custom-property-resource', 'resources', 'Opaque var(), native inheritance and global registration',
    '@property --playground-tone { syntax: "<color>"; inherits: true; initial-value: red; } .demo { --playground-tone: blue; color: var(--playground-tone); }'),
  atomic('font-face', 'resources', 'Global font descriptor/source order (compile only, not font rendering)',
    '@font-face { font-family: "Playground"; src: local("Arial"), url(data:font/woff2;base64,AA==) format("woff2"); font-weight: 400; } .demo { font-family: "Playground"; }'),
  atomic('keyframes', 'resources', 'Module-local definitions and static shorthand/longhand references',
    '@keyframes pulse { from { opacity: 0; } to { opacity: 1; } } .demo { animation: pulse 2s linear; } .other { animation-name: pulse; }'),
  {
    ...atomic('conditional-keyframes', 'Compiler configuration', 'Disjoint registered width keyframes — not a Vite registration API',
      '@media (max-width: 399px) { @keyframes pulse { from { opacity: 0; } to { opacity: 0.5; } } } @media (min-width: 400px) { @keyframes pulse { from { opacity: 0.5; } to { opacity: 1; } } } .demo { animation-name: pulse; }'),
    config: { conditions: { media: ['(max-width: 399px)', '(min-width: 400px)'] } }
  },
  { ...atomic('compatibility', 'Compiler configuration', 'Host-resolved target stages and indivisible physical sequence', '.demo { display: flex; }'),
    config: { compatibilityTargetStages: [{ safari: '6' }] } },
  { id: 'property-fallback', family: 'safety boundaries', title: 'Unknown property effect preserves the whole safely scoped Module',
    source: '.demo { future-property: 1; color: red; }', expected: 'preserved', config: { atomizationFallback: 'preserve-module' } },
  { id: 'strict-property', family: 'safety boundaries', title: 'Strict mode rejects an unknown property effect',
    source: '.demo { future-property: 1; }', expected: 'rejected', config: { atomizationFallback: 'error' } },
  { id: 'duplicate-property', family: 'safety boundaries', title: 'Authored duplicates reject and retain last-known-good',
    source: '.demo { color: red; color: blue; }', expected: 'rejected', diagnostic: 'GSS1204' },
  { id: 'local-compound', family: 'safety boundaries', title: 'Unsupported local compounds fail closed',
    source: '.demo.selected { color: red; }', expected: 'rejected' },
  { id: 'external-existence', family: 'safety boundaries', title: 'Deferred external attribute-existence targets reject',
    source: '.demo :global([data-ready]) { color: red; }', expected: 'rejected' },
  { id: 'logical-physical-overlap', family: 'safety boundaries', title: 'Runtime writing-mode-dependent overlap rejects',
    source: '.demo { margin-left: 1px; margin-inline-start: 2px; }', expected: 'rejected' },
  { id: 'multiple-runtime-witnesses', family: 'safety boundaries', title: 'Multiple interleaved runtime witnesses remain unsupported',
    source: '.a + .b .c > .d { color: red; }', expected: 'rejected' },
  { id: 'keyword-shorthand', family: 'safety boundaries', title: 'Ambiguous keyword-like animation shorthand rejects',
    source: '@keyframes ease { from { opacity: 0; } to { opacity: 1; } } .demo { animation: ease 2s; }', expected: 'rejected' }
];

export function compilePlaygroundCases() {
  return compilerCases.map((entry) => {
    const session = createGssCompilerSession({ projectRoot: '/playground', ...entry.config });
    // Every negative fixture proves rollback through the real public session.
    session.replaceStylesheet({ id: '/playground/Case.gss', source: '.baseline { color: green; }' });
    const before = session.finalize();
    const result = session.replaceStylesheet({ id: '/playground/Case.gss', source: entry.source });
    const snapshot = session.finalize();
    const actual = result.committed ? result.module!.compilationMode : 'rejected';
    const rollback = result.committed ? null : JSON.stringify(before) === JSON.stringify(snapshot);
    const passed = actual === entry.expected && rollback !== false &&
      (!entry.diagnostic || result.diagnostics.some((diagnostic) => diagnostic.code === entry.diagnostic));
    if (!passed) throw new Error(`Playground case ${entry.id}: expected ${entry.expected}, got ${actual}; ${JSON.stringify(result.diagnostics)}`);
    return { ...entry, level: 'compiler-only' as const, committed: result.committed, passed, rollback,
      diagnostics: result.diagnostics, module: result.module, snapshot,
      lifecycle: entry.id === 'session-lifecycle' ? lifecycleEvidence() : undefined };
  });
}

function lifecycleEvidence() {
  const session = createGssCompilerSession({ projectRoot: '/playground' });
  const red = '.demo { color: red; }';
  const blue = '.demo { color: blue; }';
  session.replaceStylesheet({ id: '/playground/A.gss', source: red });
  session.replaceStylesheet({ id: '/playground/B.gss', source: red });
  const shared = session.finalize();
  session.invalidate('/playground/A.gss');
  const oneOwner = session.finalize();
  const rejected = session.replaceStylesheet({ id: '/playground/B.gss', source: '.demo { color: red; color: blue; }' });
  const rollback = !rejected.committed && JSON.stringify(oneOwner) === JSON.stringify(session.finalize());
  session.replaceStylesheet({ id: '/playground/B.gss', source: blue });
  const updated = session.finalize();
  const clean = createGssCompilerSession({ projectRoot: '/playground' });
  clean.replaceStylesheet({ id: '/playground/B.gss', source: blue });
  const converged = JSON.stringify({ ...updated, generation: 0 }) === JSON.stringify({ ...clean.finalize(), generation: 0 });
  session.invalidate('/playground/B.gss');
  const empty = session.finalize();
  const checks = { sharedRule: shared.manifest.rules.length === 1, firstOwnerRemoval: oneOwner.css === shared.css,
    rollback, noStaleRed: !updated.css.includes('color: red;') && updated.css.includes('color: blue;'),
    converged, finalCleanup: empty.css === '' && empty.manifest.modules.length === 0 };
  if (Object.values(checks).some((passed) => !passed)) throw new Error(`Session lifecycle failed: ${JSON.stringify(checks)}`);
  return { checks, shared, oneOwner, updated, empty };
}
