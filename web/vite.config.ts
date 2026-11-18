import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

// The client imports ../shared (catalog.json, protocol schema, redaction grammar), so the dev server may read one level up.
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  plugins: [react()],
  build: { outDir: 'dist', emptyOutDir: true },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/api': { target: 'http://localhost:8080', ws: true, changeOrigin: true },
      '/s': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
});
