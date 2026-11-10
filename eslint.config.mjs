// guard-test v3: второй коммит, чтобы PR Gate отработал под новым гейтом.
// guard-test: проверка красного сценария (файл защищённый, метки нет).
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import tseslint from "@typescript-eslint/eslint-plugin";
import globals from "globals";

// Легаси-глобалы, которые живут в js/-слое и не входят в стандартные наборы.
const legacyGlobals = {
  _: "readonly",
  ModalBlockEditor: "readonly",
  globalThis: "readonly",
};

export default [
  js.configs.recommended,

  // TypeScript-исходники: парсим TS, а не JS (было 547 ошибок парсинга).
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...legacyGlobals },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      // TS сам следит за undefined-идентификаторами через типы.
      "no-undef": "off",
      // Синтаксический unused — без type-aware, чтобы линт был быстрым.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { args: "none", varsIgnorePattern: "^_" },
      ],
      "no-console": "off",
      // N1c.2: 92/92 eqeqeq — это сравнения с null (`x == null` ловит
      // undefined и null одновременно, замена на === меняет поведение).
      "eqeqeq": ["warn", "always", { null: "ignore" }],
      "curly": "warn",
      "no-empty": "warn",
      "no-async-promise-executor": "warn",
      "no-case-declarations": "warn",
    },
  },

  // Обычный JS (легаси /js, scripts): как было, но без вложенного ignores.
  {
    files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
    languageOptions: {
      ecmaVersion: 2021,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...legacyGlobals },
    },
    rules: {
      "no-unused-vars": ["warn", { args: "none", varsIgnorePattern: "^_" }],
      "no-console": "off",
      // N1c.2: 92/92 eqeqeq — это сравнения с null (`x == null` ловит
      // undefined и null одновременно, замена на === меняет поведение).
      "eqeqeq": ["warn", "always", { null: "ignore" }],
      "curly": "warn",
      "no-empty": "warn",
      "no-async-promise-executor": "warn",
      "no-case-declarations": "warn",
    },
  },

  // AudioWorklet-процессоры: исполняются в AudioWorkletGlobalScope, а линтуются
  // как обычный JS. Глобалы этого scope не входят в browser/node наборы.
  {
    files: ["src/audio/pitch/**/*.js"],
    languageOptions: {
      globals: {
        AudioWorkletProcessor: "readonly",
        registerProcessor: "readonly",
        sampleRate: "readonly",
        currentTime: "readonly",
        currentFrame: "readonly",
      },
    },
  },

  // Игнорируемые зоны (по RULES-CORE §6 + бриф N1a: dist/node_modules/.git/public/vendor).
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      ".git/**",
      "public/**",
      "vendor/**",
      "Karaoke/**",
      "Rehearsal/**",
      "img/**",
      "js/vendor/**",
      "css/**",
      "resources/masks/png/**",
      "build/**",
      "coverage/**",
      ".opencode/**",
      "team-m/**",
      "docs/**",
      // 711 (seo): отдельный Astro-проект со своим package.json/lock и своими
      // гейтами (deploy-seo.yml). Корневой eslint его не линтует.
      "seo/**",
      // 805 (N1a): скомпилированные бандлы воркера — сгенерированы, не линтуем.
      "gateway/dist-*/",
      // 805 (N1a): vendored WASM-глue в FROZEN engine-v3 — не наш lintable-исходник.
      "src/audio/engine-v3/vendor/**",
    ],
  },
];
