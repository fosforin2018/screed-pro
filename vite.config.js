import { defineConfig } from 'vite';
export default defineConfig({
  root: 'public',
  base: './',
  build: {
    target: 'es2020',
    minify: true,
    sourcemap: false,
    outDir: '../dist',
    emptyOutDir: true
  },
  server: { host: '0.0.0.0', port: 3000 }
});
