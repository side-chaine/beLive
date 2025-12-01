import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/beLive/', // Добавлено для корректного развертывания на GitHub Pages в подпапку
  plugins: [tsconfigPaths()],
  server: {
    mimeTypes: {
      '.ts': 'application/javascript',
    },
  },
})
