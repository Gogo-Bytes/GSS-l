/* global document, CSSStyleRule, CSS, URL, HTMLLinkElement, MutationObserver */
// Only the HTML link installed by the dev plugin participates. Vite still fetches,
// swaps and removes its own links; no persistent second stylesheet or React hook.
if (import.meta.hot) {
  const hot = import.meta.hot;
  const owner = 'link[data-gss-dev]';
  const selector = name => '.' + CSS.escape(name);
  let hint, active, incoming;
  const mounted = name => document.getElementsByClassName(name).length !== 0;
  const retire = new MutationObserver(() => {
    if (!active || incoming) return;
    if (!mounted(active.alias)) clear();
  });

  function clear() {
    retire.disconnect();
    if (active) active.rule.selectorText = selector(active.name);
    active = undefined;
  }

  function readPair(link, a, b) {
    // Reject host-transformed groups, duplicate selectors and nested contexts.
    let rules;
    try { rules = Array.from(link.sheet?.cssRules ?? []); }
    catch { return; } // A cross-origin host stylesheet is not ours to change.
    if (!rules.every(r => r instanceof CSSStyleRule && /^\.[\w-]+$/.test(r.selectorText) && !r.cssRules?.length)) return;
    const hits = rules.filter(r => r.selectorText === selector(a) || r.selectorText === selector(b));
    if (hits.length !== 1 || !hits[0].style.length) return;
    const rule = hits[0];
    return rule.selectorText === selector(a) ? { name: a, alias: b, rule } : { name: b, alias: a, rule };
  }

  hot.on('gss:atom-handoff', data => { hint = data; });
  hot.on('vite:beforeUpdate', ({ updates }) => {
    const update = updates.find(u => u.type === 'css-update' && u.path === '/@gss-l/central.css');
    if (!update) return;
    const plan = hint?.timestamp === update.timestamp ? hint : undefined;
    hint = undefined;
    const rename = plan?.rename;
    const link = document.querySelector(owner);
    if (!plan || !link || (!rename && !active)) { clear(); return; }
    const from = rename?.from ?? active.name;
    const to = rename?.to ?? from;
    const alias = rename ? from : active.alias;
    if (active && !([to, alias].includes(active.name) && [to, alias].includes(active.alias))) clear();
    active ??= readPair(link, to, alias);
    if (!active) return;
    incoming = { timestamp: update.timestamp, to, alias, declaration: active.rule.style.cssText };
    active.rule.selectorText = [to, alias].map(selector).join(', ');
    document.addEventListener('load', receive, true);
    document.addEventListener('error', receive, true);
  });

  function stopReceiving() {
    document.removeEventListener('load', receive, true);
    document.removeEventListener('error', receive, true);
    incoming = undefined;
  }
  // The old rule still matches both names while Vite loads its replacement.
  // Capture load before Vite's target handler detaches the old stylesheet.
  function receive(event) {
    const link = event.target, plan = incoming;
    if (!plan || !(link instanceof HTMLLinkElement) || !link.matches(owner) ||
        new URL(link.href).searchParams.get('t') !== String(plan.timestamp)) return;
    stopReceiving();
    const pair = event.type === 'load' && readPair(link, plan.to, plan.alias);
    clear();
    if (!pair || pair.rule.style.cssText !== plan.declaration) return;
    // A delayed request can already contain the next revision of this pair.
    // In that case keep the pair intact until its queued native update arrives.
    const caughtUp = pair.name === plan.to;
    if (caughtUp && !mounted(pair.alias)) return;
    active = pair;
    pair.rule.selectorText = [pair.name, pair.alias].map(selector).join(', ');
    if (caughtUp) retire.observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
  }
  hot.on('vite:afterUpdate', ({ updates }) => {
    if (incoming && updates.some(u => u.timestamp === incoming.timestamp && u.type === 'css-update')) {
      stopReceiving();
      clear();
    }
  });
}
