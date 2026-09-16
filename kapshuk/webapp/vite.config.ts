import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist', assetsDir: 'assets', sourcemap: false },
  server: {
    port: 5173,
    // У dev-режимі API бере на себе бекенд на 8080
    proxy: { '/api': 'http://127.0.0.1:8080' },
  },
})
