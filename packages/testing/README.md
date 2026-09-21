# @gss-l/testing — bounded independent reference

Test-only synchronous compiler; no production package depends on it.

```ts
import { compileGssReference } from '@gss-l/testing';

const result = compileGssReference({
  config: { projectRoot: '/project' },
  modules: [{ id: '/project/Card.gss', source: '.card { color: red; }' }]
});
if (result.success) {
  const card = result.scopeSchemas['/project/Card.gss']!.exports.card!;
  // Apply card.selfClassName to the reference document and install result.css there.
}
```

Success contains `css`, `scopeSchemas` keyed by original input id, and `diagnostics`. Failure contains only `diagnostics`, with no partial CSS/mappings. No input is mutated or retained. Duplicate logical Module ids fail; Module output is sorted by logical identity, while authored rule/declaration order is unchanged. Names encode project-relative Module identity and authored class, without an atomic allocator. Scope paths reuse their terminal authored class token, so actual ancestor DOM—not a winner resolver—performs accumulation.

## Current reference coverage (not product capability limits)

- Plain ASCII local classes (`[A-Za-z_][A-Za-z0-9_-]*`) and whitespace descendants, with declared scope paths and structural prefixes.
- `color`, `background-color`, `display`, `width`, `height`.
- `margin`, `padding` and their physical `-top`, `-right`, `-bottom`, `-left` longhands.
- Authored grouping/order and `!important`; values stay opaque but functions/escapes are rejected. Equal-importance duplicate exact properties fail; normal/important pairs remain intact.

Everything else fails explicitly, including lists/nesting, states, attributes, pseudo-elements, child/sibling/runtime relations, at-rules/resources, other properties, nonempty condition/layer registration and asset bindings. Empty registrations and either `atomizationFallback` policy are accepted; no reference fallback/planning occurs. The optional second argument `{ resolveAssetUrl? }` reserves the approved host port but is not called in this resource-free slice.

Production compiler types are imported only as types. Runtime reference code uses PostCSS and local lexical path infrastructure, not the production session, resolver, identities, planners, or naming allocator. Filesystem/Vite/browser code is confined to the harness, not the exported compiler.

## Reproducible browser acceptance

From the repository root:

```sh
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm --filter @gss-l/testing browser:reference
```

Open **http://127.0.0.1:4178/** with native `agent_browser`. The fixed port is strict. Stop the server with Ctrl-C when done.

The page compiles reference and atomic outputs separately on the Vite host. It renders identical fixture DOM with the corresponding mappings into separate same-size iframe documents, each with only its own stylesheet. No React adapter or browser-side compiler is involved. Both sides must match literal expected computed values, not merely each other. Fixtures cover:

1. Local ownership and isolation of equal class names in two Modules.
2. `.icon`, `.son .icon`, `.father .icon`, `.father .son .icon` accumulation with actual matching ancestors, including direct and standalone icons.
3. Margin/padding shorthand-before-longhand, longhand-before-shorthand, important shorthand, important longhand, and both-important declarations. All four physical longhands are compared.

Wait until `window.__GSS_REFERENCE_RESULT__.status !== 'running'` (also JSON text in `#result`). Acceptance requires:

```js
const r = window.__GSS_REFERENCE_RESULT__;
r.status === 'passed' &&
r.results.length === 3 &&
r.results.every(f => f.comparisons > 0 && f.differences.length === 0 && f.expectedFailures.length === 0) &&
r.negativeControl.detected === true
```

Each difference reports Module id, scope path, node, property, reference value and atomic value; each fixture also exposes complete readings. The negative control intentionally overrides atomic `#forward` with `margin-left: 123px !important`; it must detect reference `9px` versus atomic `123px`. If either compilation or frame loading fails, the page fails rather than reporting an empty comparison as success (host compilation errors also appear in Vite's overlay).

Native `agent_browser` acceptance was run by the parent agent: `status: passed`, all three fixtures had no differences/expected failures, and the negative control was detected. This is bounded manual evidence, **not** full oracle coverage, browser CI, or Pilot completion.

Fast API checks: `corepack pnpm --filter @gss-l/testing test`. Browser files are typechecked but are not automatically browser-executed by `pnpm verify`.
