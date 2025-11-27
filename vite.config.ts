import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/beLive/', // Добавлено для корректного развертывания на GitHub Pages в подпапку
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Убрали rollupOptions.input, чтобы Vite копировал public/ как есть
  },
})
