import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// During `npm run dev`, proxy the API routes to the FastAPI backend on :8000.
// In production the same FastAPI process serves the built SPA, so these paths
// resolve same-origin and no proxy is involved.
const API_ROUTES = ['/games', '/analyze', '/evaluate', '/auth', '/health']

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: Object.fromEntries(
      API_ROUTES.map((r) => [r, { target: 'http://localhost:8000', changeOrigin: true }]),
    ),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
