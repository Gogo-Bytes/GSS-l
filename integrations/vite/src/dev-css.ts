import type { FinalizedGssSnapshot } from '@gss-l/compiler';
import { findAtomRename } from './dev-atom-handoff.js';
import type { UpdatePayload, ViteDevServer, WebSocket } from 'vite';
import { CENTRAL_CSS_URL, LINKED_CSS_URL, resolveCentralCssId } from './virtual-id.js';

/** One stylesheet owner, refreshed through Vite's native link/CSS HMR transport. */
export function createDevCssOwner(server: ViteDevServer, readSnapshot: () => FinalizedGssSnapshot) {
  let previous = readSnapshot();
  let timestamp = 0;
  const { moduleGraph, hot } = server.environments.client!;

  function refresh(synchronizeOnly = false): UpdatePayload | undefined {
    timestamp = Math.max(Date.now(), timestamp + 1);
    const paths = new Set<string>();
    for (const [id, module] of moduleGraph.idToModuleMap) {
      if (!resolveCentralCssId(id)) continue;
      moduleGraph.invalidateModule(module, new Set(), timestamp, true);
      if (module.type !== 'css') continue;
      const linked = id.split('?')[0] === resolveCentralCssId(LINKED_CSS_URL);
      // Initial socket synchronization must not mutate framework-owned SSR hrefs before hydration.
      if (!synchronizeOnly || !linked) paths.add(linked ? LINKED_CSS_URL : CENTRAL_CSS_URL);
    }
    if (paths.size === 0 || server.config.server.hmr === false) return;
    return {
      type: 'update',
      updates: [...paths].map((path) => ({
        type: 'css-update', path, acceptedPath: path, timestamp
      }))
    };
  }

  // Initial module discovery can finish before the browser's HMR socket connects.
  // Resend the current snapshot to that client.
  function synchronize(socket: Pick<WebSocket, 'send'>) {
    const payload = refresh(true);
    if (payload) socket.send(JSON.stringify(payload));
  }
  server.ws.on('connection', synchronize);

  return {
    publish(recovered = false) {
      const next = readSnapshot();
      const prior = previous;
      previous = next;
      // A native update also clears Vite's error overlay after an identical-byte recovery.
      const unchanged = prior.css === next.css;
      if (unchanged && !recovered) return;
      const payload = refresh();
      if (!payload) return;
      if (payload.updates.some(update => update.path === CENTRAL_CSS_URL)) {
        const rename = unchanged ? undefined : findAtomRename(prior, next);
        if (rename || unchanged) hot.send({ type: 'custom', event: 'gss:atom-handoff', data: { timestamp, rename } });
      }
      hot.send(payload);
    },
    dispose() {
      server.ws.off('connection', synchronize);
    }
  };
}
