import type { LoaderDefinition } from '@rspack/core';

/** Immutable internal payload: cached modules never consult a different compilation's candidate. */
const aggregateLoader: LoaderDefinition = function () {
  const encoded = new URLSearchParams(this.resourceQuery).get('gss');
  if (!encoded) throw new Error('Missing GSS aggregate payload.');
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString()) as { css: string; sourceMap: unknown };
  this.callback(null, payload.css, JSON.stringify(payload.sourceMap));
};
export default aggregateLoader;
