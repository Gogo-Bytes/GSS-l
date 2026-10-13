---
status: accepted
---

# Preserve distinct Unicode sequences in readable names

A CSS string can contain either a composed character or a visually identical base character plus combining mark; those are distinct authored semantic values. The first-version readable name codec now encodes and decodes the exact Unicode scalar sequence of every identity component, rather than normalizing to NFC. This makes the reversible identity requirement of [ADR-0029](0029-use-reversible-readable-names-for-the-first-version.md) hold at this boundary and prevents different CSS values from sharing a selector. It does not change CSS parsing or normalize semantic identities upstream.

Existing names for NFC input stay stable. Names containing decomposed sequences change on rebuild, including Module-owned markers/resources where applicable; the generated class/resource names are artifacts, not authored syntax or a new public API. NFC-merging was rejected because it can cause distinct CSS string values to override each other; rejecting valid non-NFC source was rejected because it unnecessarily narrows accepted input.
