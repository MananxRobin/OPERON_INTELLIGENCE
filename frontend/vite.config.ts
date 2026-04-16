import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: [
        '../backend/**',
        '**/*.db',
        '**/*.db-shm',
        '**/*.db-wal',
      ],
    },
    proxy: {
      '/api/cfpb': {
        target: 'https://www.consumerfinance.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/cfpb/, '/data-research/consumer-complaints/search/api/v1'),
      },
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/deepseek/, ''),
      },
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
