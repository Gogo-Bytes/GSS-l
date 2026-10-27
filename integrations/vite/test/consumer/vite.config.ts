import { defineConfig } from 'vite';
import { gss } from '@gss-l/vite';
import { react } from '@gss-l/react';

export default defineConfig({
  plugins: [gss({ adapter: react() })]
});

// @ts-expect-error Vite must not implicitly choose a framework Adapter.
gss({});
