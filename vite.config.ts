import { defineConfig } from 'vite';

// Relative base so the built game also runs from a local folder when it is
// later wrapped as a desktop app.
export default defineConfig({
  base: './',
  server: { port: 5173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 1500 },
});
