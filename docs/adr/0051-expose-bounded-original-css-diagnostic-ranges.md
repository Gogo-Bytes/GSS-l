---
status: accepted
---

# Expose bounded original-CSS diagnostic ranges

The Compiler exports `GssSourceRange = { start: number; end: number }` and adds optional `range?: GssSourceRange` to `GssDiagnostic`. A range selects the **original caller CSS** with `source.slice(start, end)`: zero-based UTF-16 code units, half-open. CRLF and astral characters each occupy two units; a leading U+FEFF/U+FFFE remains part of caller offsets. Upstream inline source maps never redirect the range to another source.

Optional attribution is preferable to a fabricated highlight: omit `range` when origin or coordinates are unreliable. Existing diagnostics without this field remain valid. `id`, codes, emission order and transactional last-known-good behavior are unchanged; there is no public `path` field or new sorting policy.

## Bounded implementation

- `GSS1001` CSS syntax errors use PostCSS `error.input.source` and its one-based input line/column coordinates, **not** remapped top-level error fields. Input text must equal caller CSS after removal of exactly one leading BOM marker. LF line starts translate to UTF-16 offsets; the removed marker contributes one unit. Invalid/out-of-bounds/reversed/partial-end or split-surrogate coordinates are omitted.
- A genuinely supplied, validated end is exclusive. If the parser supplies only a start, the range is a **zero-width point** at that position, including EOF when explicitly reported there. No token length or last-character highlight is invented; an unclosed block normally points to its opening rule rather than EOF.
- Authored selector syntax errors reached during selector prevalidation use the **complete enclosing authored rule**, including braces. This requires a reliable Input origin; inline-map helper/lazy-lookup failures remain unranged even when raised inside selector validation. `GSS1101` unsupported-selector diagnostics likewise use the authored rule span. Selector-list branches share that span; nesting points to the original nested rule, not generated selector text or an inherited parent fragment.
- `GSS1204` duplicate exact-property declarations select the **actual repeated declaration** (property through value/importance and semicolon when present). Each normalized branch retains its own existing diagnostic position in emission order, even if multiple branches share one authored declaration.
- Other capability sites, configuration/binding errors, resource/registry conflicts and multi-origin resolution diagnostics remain unranged in this slice. Map decode/schema/lazy-lookup failures with no Input origin omit ranges. Discovery exposes parser diagnostics only; it does not acquire declaration validation.

## Consequences

The implementation reuses domain-owned `SourceSpan` metadata; no PostCSS objects enter the domain, no parallel IR is added, and provenance remains excluded from semantic identities, names, ordering and resource sharing. Default parser composition, the internal parser port and all public constructor/source-adapter interfaces are unchanged. The existing nonempty-inline-map Input/Parser data guard stays instance-local: valid CSS with lazy malformed mappings may succeed, malformed CSS/maps diagnose, and unrelated parser/custom-port failures propagate.

This is not complete S2 diagnostics acceptance. Remaining diagnostic-site attribution, semantic paths/sorting, CSS source maps, source-to-emitted-rule mappings, and IDE integration are separate work. Native Vite consumption is now implemented as an Adapter-owned follow-up using exact owned source snapshots; see [architecture](../architecture.md#diagnostics) and [real Vite regressions](../../packages/vite/test/diagnostic-location.test.ts). This does not alter the accepted range semantics or extend the attributed diagnostic sites. The independent reference renderer may omit this optional field and does not import production parsing or IR.
