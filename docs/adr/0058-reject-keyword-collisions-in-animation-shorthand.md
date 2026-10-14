---
status: accepted
---

# Reject local keyframe keyword collisions in animation shorthand

CSS parses a word such as `ease` in `animation: ease 2s` as a timing function before considering it an animation name, even if the Module declares `@keyframes ease`. Rewriting every matching word to a Module-local generated keyframe name changes that native meaning. For the MVP, continue rewriting proven static non-keyword local names in `animation` and explicit local names in `animation-name`, but reject an entire Module replacement if an `animation` shorthand contains a bare word that both names a local keyframe and matches a CSS animation component keyword (including Level 2 `auto`) or a dashed timeline identifier (`--name`). The rejected replacement retains the last-known-good Module; it is not converted to preserved output or silently left unrevised. This deliberately conservative boundary also rejects a shorthand whose keyword occurrence was intended for another component, rather than guessing its role.

Keyword-like local keyframe names remain usable through `animation-name` (with longhands for the other animation components). Bare CSS-wide keywords, `default`, and `none` are not valid `@keyframes` names and are rejected before renaming rather than being made valid accidentally. Dynamic `var()` references remain opaque. This does not add a shorthand grammar parser or promise to support every legal shorthand disambiguation. Grammar-aware support can be reconsidered after representative tests and an explicit scope decision. See [CSS Animations shorthand parsing](https://www.w3.org/TR/css-animations-1/#animation) and the [Level 2 shorthand grammar](https://drafts.csswg.org/css-animations-2/#animation).
