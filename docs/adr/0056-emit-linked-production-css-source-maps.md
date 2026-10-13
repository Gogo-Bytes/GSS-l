---
status: accepted
---

# Emit linked production CSS source maps

The Compiler exposes a source-map v3 artifact with original `.gss` contents in `sourcesContent`; the Vite Adapter emits and links a `gss.css.map` asset for a nonempty reachable stylesheet. This intentionally makes the authored GSS source available to consumers of production assets. Logical project-relative Module ids, not physical build paths, identify sources. The empty reachable stylesheet remains an empty CSS asset and emits no map.

A standard mapping can identify only one origin at each generated position. For shared declarations and resources, choose the lowest logical Module id and then earliest original offset as the stable primary origin; the manifest retains all owners. The current bounded map covers atomic declaration locations (including physical compatibility alternatives), resource starts, uniquely identified font/property descriptor starts, preserved rule starts and their physical declaration alternatives, plus uniquely identified keyframe steps/declarations (including prefixed pairs); generated preludes and other synthetic text need not claim an authored position. Ambiguous repeated keyframe steps/properties, token-level value tracing and all-origin declaration tracing remain separate acceptance work. The map filename is reserved alongside the manifest/report names, and its URL is CSS-relative even when the CSS asset is hashed or nested.
