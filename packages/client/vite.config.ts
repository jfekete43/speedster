import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command }) => ({
  // GitHub Pages serves this as a project site at /<repo>/, so production
  // builds need that prefix. The dev server stays at the root.
  base: command === 'build' ? '/speedster/' : '/',
  resolve: {
    alias: {
      '@speedster/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  server: {
    port: 5173,
  },
}));
