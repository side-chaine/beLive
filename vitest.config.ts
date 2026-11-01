import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // belive-mvsep/**/*.test.js — тесты воркера. Без этой строки они бы
    // существовали, но никогда не запускались (как gateway/test/*.test.ts,
    // которые лежат вне include и в CI не идут).
    include: [
      'src/**/*.{test,spec}.{ts,tsx}',
      'src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
      'belive-mvsep/**/*.test.js',
    ],
  },
});
