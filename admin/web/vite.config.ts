import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// 构建产物放到 admin/public,Caddy 直接托管;本机开发时 /api 和 /uploads 转给 node server.mjs(4200,可用 API_PORT 换)
const API = `http://127.0.0.1:${process.env.API_PORT || 4200}`
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  build: { outDir: '../public', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: { port: Number(process.env.WEB_PORT) || 5190, proxy: { '/api': { target: API, changeOrigin: false }, '/uploads': { target: API, changeOrigin: false } } }
})
