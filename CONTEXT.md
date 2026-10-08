# GSS-l compiler language

This glossary distinguishes style ownership from native selector matching.

## Language

**Owned scope**:
A local style path exported by a GSS Module and referenced by a consumer. Its class tokens are supplied through the GSS scope contract.

**External target**:
A browser element matched by an explicit global selector anchored to an owned scope, but not exported or class-managed by GSS. Its computed style may change through scoped CSS while its DOM and classes remain externally owned.

**Anchor**:
An owned scope whose class restricts where an external-target selector can match. The anchor is not itself the declaration target in a descendant selector.

**External condition**:
An externally supplied class tested on an owned scope node. The owned node remains the declaration target; GSS neither exports nor changes the external class.
