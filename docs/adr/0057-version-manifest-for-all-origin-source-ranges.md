---
status: accepted
---

# Version the manifest for all-origin source ranges

A source-map v3 position can identify only one original location, even when multiple authored declarations or Modules share a generated atom/resource. Keep the deterministic primary source-map location from [ADR-0056](0056-emit-linked-production-css-source-maps.md), and expose every live contributing origin in the Compiler manifest. Each atomic/contextual rule and resource has code-unit-sorted (not locale-collated), deduplicated `origins: [{ moduleId, range: { start, end } }]`; `preservedRules` contains one original rule origin per emitted preserved block in CSS order. Ranges are half-open UTF-16 offsets in the original `.gss` source; Module ids are logical project-relative ids. Origins describe surviving planned contributions, not declarations discarded by winner resolution.

Because this changes the public manifest structure, Vite emits `gss-manifest.json` with envelope `version: 2`. The existing fields and `sources` lists remain, but consumers expecting version 1 must opt into version 2. `gss-report.json` remains version 1; the linked CSS map remains source-map v3. This is a bounded all-origin rule/resource trace, not a claim of token-level value mappings or a completed report schema.
