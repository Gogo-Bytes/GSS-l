---
status: accepted
---

# Take compatibility targets from the host

The host is authoritative for the browser/CSS compatibility targets of GSS output. GSS must not independently read a project Browserslist configuration when the host may have resolved or overridden its targets: doing so could emit a CSS asset for different browsers than the host's own CSS. The Compiler domain receives a host-independent description of the resolved target contract; the host adapter translates its own effective settings instead of duplicating a Browserslist parser in each adapter. A standalone Compiler caller is its own host and must supply an explicit target contract before compatibility expansion is enabled. Unsupported or inconsistent target mappings fail closed rather than silently falling back to an unrelated Browserslist/default target.

## Consequences

- The Vite adapter currently emits GSS CSS as its own asset, outside Vite's normal CSS transformation. Its compatibility output must follow the *effective Vite CSS pipeline*, not a guessed project target or merely the JavaScript target. In Vite 7, `css.lightningcss.targets` can govern the Lightning CSS transformation, while `build.cssTarget` governs CSS minification; they need not be identical. Integration must account for the relevant stages rather than arbitrarily picking one knob.
- Resolve and snapshot effective targets for a compilation session. Rebuild/invalidate when host target settings change; clean/incremental builds of the same host configuration must agree. Do not bind target decisions to process cwd, ambient Browserslist environment, or Module registration order.
- The first bounded Compiler target interface is `compatibilityTargetStages`: an ordered list of host-resolved minimum browser-version maps, with no ambient discovery or implicit target. The standalone caller is its own host. The Compiler centrally uses Lightning CSS to expand declarations; only a sequence of the same physical property is admitted as one atomic rule. A generated vendor property takes the entire safely scoped Module through the existing preserved/strict fallback policy. The session snapshots target data. Resource and bound-Asset combinations fail closed pending their compatibility proof.
- This does not connect the Vite adapter to effective transform/minifier settings or mark S4.17/S4.19 accepted. The two settings may differ and cannot be collapsed into one arbitrary version map; host translation, additional browser mappings, resources, Assets and cross-context sequence/fallback evidence remain open.
