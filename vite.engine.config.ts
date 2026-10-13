import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  publicDir: false,
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'mock/engine',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/content/engine.ts'),
      name: 'AppealEngine',
      formats: ['iife'],
      fileName: () => 'engine.js',
    },
  },
});
