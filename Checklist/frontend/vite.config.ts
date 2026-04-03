import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 8080,
    proxy: {
      // Mesma origem no browser → cookie HttpOnly da API funciona em dev
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        timeout: 120000, // 2min para batch uploads grandes
      },
    },
  },
})
