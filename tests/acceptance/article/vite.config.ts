import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { gss } from '@gss-l/vite';
import { react } from '@gss-l/react';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [gss({ adapter: react() })],
  server: { host: '127.0.0.1', port: 4181, strictPort: true },
  preview: { host: '127.0.0.1', port: 4181, strictPort: true },
  build: { manifest: true }
});
