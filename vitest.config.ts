import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// Два проекта, потому что приложение и воркеры живут в разных мирах.
//
// Зачем это разделение. До 02.11.2026 всё гонялось в environment: 'jsdom'.
// Для React-приложения это правильно, для воркеров — нет: код воркера
// исполняется в Workers (V8 изоляты), а не в браузере, и в jsdom у него
// другой crypto.subtle.
//
// На этом уже поймались. `gateway/src/handlers/auth.ts` отдавал из
// base64UrlDecode голый ArrayBuffer, jsdom-овский SubtleCrypto отбивал его
// как «чужой» (instanceof ArrayBuffer через границу realm не срабатывает),
// catch внутри verifyJWT глотал TypeError и возвращал null — то есть ВАЛИДНЫЙ
// токен выглядел невалидным. На Node 20 это краснило тест, на Node 22 и 24
// не краснит вообще: там голый ArrayBuffer принимается, и охрана молчит.
//
// Отсюда два вывода, оба зашиты здесь:
//   1. Воркеры тестируются в environment: 'node' — ближе к рантайму, в
//      котором они на самом деле исполняются.
//   2. Версия Node — часть контракта тестов. В CI node-version: '20'
//      (pr-gate.yml), и поднимать её нельзя, не проверив, что охрана всё
//      ещё кусается.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./src/test/setup.ts'],
          include: [
            'src/**/*.{test,spec}.{ts,tsx}',
            'src/**/__tests__/**/*.{test,spec}.{ts,tsx}',
          ],
        },
      },
      {
        // Тесты воркеров. Без явного include они существуют, но никогда не
        // запускаются: `npm test` видит только то, что перечислено, а
        // gateway/ и belive-*/ лежат вне src/.
        //
        // gateway/test/ добавлен 02.11.2026: до этого 13 тестов главного
        // воркера (посты, лайки, комментарии) не шли ни локально, ни в CI —
        // у gateway свой vitest.config.ts, который в пайплайне никто не звал.
        extends: true,
        test: {
          name: 'workers',
          environment: 'node',
          globals: true,
          include: [
            'gateway/test/**/*.{test,spec}.ts',
            'belive-mvsep/**/*.test.js',
            'belive-feed-bot/**/*.test.ts',
          ],
        },
      },
    ],
  },
});
