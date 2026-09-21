import type { UpdatePayload, ViteDevServer, WebSocket } from 'vite';
import { CENTRAL_CSS_URL, resolveCentralCssId } from './virtual-id.js';

/** One stylesheet owner, refreshed through Vite's native link/CSS HMR transport. */
export function createDevCssOwner(server: ViteDevServer, readCss: () => string) {
  let css = readCss();
  let timestamp = 0;
  const { moduleGraph, hot } = server.environments.client!;

  function refresh(): UpdatePayload | undefined {
    timestamp = Math.max(Date.now(), timestamp + 1);
    let hasLink = false;
    for (const [id, module] of moduleGraph.idToModuleMap) {
      if (!resolveCentralCssId(id)) continue;
      moduleGraph.invalidateModule(module, new Set(), timestamp, true);
      hasLink ||= module.type === 'css';
    }
    if (!hasLink || server.config.server.hmr === false) return;
    return {
      type: 'update',
      updates: [{
        type: 'css-update', path: CENTRAL_CSS_URL,
        acceptedPath: CENTRAL_CSS_URL, timestamp
      }]
    };
  }

  // Initial module discovery can finish before the browser's HMR socket connects.
  // Resend the current snapshot to that client; no custom browser runtime is needed.
  function synchronize(socket: Pick<WebSocket, 'send'>) {
    const payload = refresh();
    if (payload) socket.send(JSON.stringify(payload));
  }
  server.ws.on('connection', synchronize);

  return {
    publish() {
      const next = readCss();
      if (next === css) return;
      css = next;
      const payload = refresh();
      if (payload) hot.send(payload);
    },
    dispose() {
      server.ws.off('connection', synchronize);
    }
  };
}
