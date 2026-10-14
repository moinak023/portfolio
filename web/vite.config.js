import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const demo = process.env.VITE_DEMO === '1';

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react()],
  define: { __DEMO__: JSON.stringify(demo) },
  build: { outDir: demo ? '../dist-demo' : '../dist', emptyOutDir: true },
  server: { proxy: { '/api': 'http://localhost:8787' } },
});
