---
status: accepted
---

# Keep registered condition configuration Compiler-only for this round

The accepted [ADR-0061](0061-admit-disjoint-registered-width-keyframe-variants.md) proof requires both media bounds to be registered. For this round, do **not** add a top-level `conditions`/`layers` option or a nested `compiler` option to Vite's public `gss({ adapter })` API. The standalone Compiler and independent native-browser oracle remain the supported evidence for this bounded conditional-keyframe shape; an unregistered Vite build is not evidence that the host can admit it. No implicit discovery or reinterpretation of Vite/Browserslist settings substitutes for explicit registration.

This avoids freezing a public host configuration shape before its authority, rebuild/invalidation and other registered-condition consumers are decided. It does **not** defer the accepted positive registered-condition contract from the MVP, complete S4/S7 host validation, or authorize a preserved fallback. The host configuration/API gate stays open: a future owner decision must select an explicit, allowlisted input and prove clean, dev/watch, SSR/SSG and browser behavior. Existing single-definition resource behavior and D020's cross-kind precedence deferral are unchanged.
