import { fileURLToPath } from 'node:url';
import { defineConfig, mergeConfig } from 'vite';
import { gss } from '@gss-l/vite';
import { react } from '@gss-l/react';
import referenceConfig from '../browser/vite.config.js';
import { compilePlaygroundCases } from './compiler-cases.js';
import { transformPlaygroundCases } from './adapter-cases.js';

export default mergeConfig(referenceConfig, defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [gss({ adapter: react() }), {
    name: 'playground-compiler-cases',
    resolveId(id) {
      if (id === 'virtual:playground-compiler') return '\0virtual:playground-compiler';
      if (id === 'virtual:playground-adapter') return '\0virtual:playground-adapter';
    },
    load(id) {
      if (id === '\0virtual:playground-compiler') return `export default ${JSON.stringify(compilePlaygroundCases())};`;
      if (id === '\0virtual:playground-adapter') return `export default ${JSON.stringify(transformPlaygroundCases())};`;
    }
  }],
  server: { host: '127.0.0.1', port: 4179, strictPort: true },
  preview: { host: '127.0.0.1', port: 4179, strictPort: true }
}));
