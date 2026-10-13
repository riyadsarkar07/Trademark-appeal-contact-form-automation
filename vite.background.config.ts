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
      input: resolve(__dirname, 'src/background/index.ts'),
      output: {
        format: 'es',
        dir: 'dist',
        entryFileNames: 'background.js',
        inlineDynamicImports: true,
      },
    },
  },
});
