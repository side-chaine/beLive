import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Тесты воркеров. Без этих строк они существуют, но никогда не
    // запускаются: `npm test` и `npm run verify:ci` в CI видят только то,
    // что перечислено здесь, а gateway/ и belive-*/ лежат вне src/.
    //
    // gateway/test/ добавлен 02.11.2026: до этого 13 тестов главного воркера
    // (посты, лайки, комментарии) не запускались ни локально, ни в CI —
    // у gateway свой vitest.config.ts, который в пайплайне никто не вызывал.
    // Проверка JWT на gateway не проверялась вообще.
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'gateway/test/**/*.{test,spec}.ts',
      'belive-mvsep/**/*.test.js',
      'belive-feed-bot/**/*.test.ts',
    ],
  },
});
