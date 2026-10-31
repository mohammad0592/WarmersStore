/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The ASP.NET Core API (dotnet run) listens here in development.
const apiTarget = process.env.API_URL ?? 'http://localhost:5080'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/health': apiTarget,
      '/media': apiTarget, // uploaded images are served by the API

    },
  },
  test: {
    environment: 'jsdom',
    // Each worker runs its own jsdom; capping them avoids out-of-memory crashes on smaller machines.
    maxWorkers: 4,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
})
