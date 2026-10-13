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
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/content/index.ts'),
      output: {
        format: 'iife',
        name: 'MetaAppealContent',
        dir: 'dist',
        entryFileNames: 'content.js',
        inlineDynamicImports: true,
      },
    },
  },
});
