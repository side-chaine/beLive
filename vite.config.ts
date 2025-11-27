import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/beLive/', // Добавлено для корректного развертывания на GitHub Pages в подпапку
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Убираем ручное копирование из package.json, Vite сам возьмет всё из public
  },
  // Убираем plugins: [tsconfigPaths()]
  server: {
    mimeTypes: {
      '.ts': 'application/javascript',
    },
  },
})
