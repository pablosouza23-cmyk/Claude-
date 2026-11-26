import { defineConfig } from 'vite';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname);

export default defineConfig({
  root,
  publicDir: resolve(root, 'public'),
  resolve: { alias: { '@shared': resolve(root, '../shared') } },
  server: {
    host: true,
    port: Number(process.env.CLIENT_PORT ?? 5173),
    proxy: { '/ws': { target: `ws://localhost:${process.env.PORT ?? 8787}`, ws: true } },
  },
  build: {
    outDir: resolve(root, '../dist/client'),
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
});
